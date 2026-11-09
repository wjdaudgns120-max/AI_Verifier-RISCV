# [사전학습] RV32I Multi-Cycle CPU + APB SoC 프로젝트

이 문서는 평가 에이전트가 프로젝트를 평가하기 전에 학습해야 할 배경지식, 프로젝트 구조, 역할 분담(R&R)을 정리한 것이다.
평가 대상 자료(보고서 텍스트, RTL 소스, 테스트 프로그램)는 이 문서 뒤에 첨부된다.

---

## 0. 학습 자료 선정 기준과 이유

평가 기준 5개(커버리지, SW 시나리오, PASS/FAIL 판정, 엣지 케이스, 버스·통합)를 판단하는 데 꼭 필요한 지식만 고르고, 각 항목이 어느 기준의 판단 근거가 되는지 연결했다.

**선정 기준**
1. 평가 기준과의 직결성: 5개 기준 중 하나 이상을 판단하는 데 직접 쓰이는 지식만 넣는다.
2. 결함을 찾는 데 필요한 지식: 정상 동작 설명보다 검증에서 놓치기 쉬운 경계·예외 조건을 우선한다.
3. 프로젝트 범위 일치: 이 SoC가 구현한 범위(RV32I, multi-cycle, APB, BRAM)만 넣고, 파이프라인·캐시처럼 범위 밖 지식은 뺀다. 범위 밖 요구로 감점하지 않게 하기 위해서다.
4. 근거의 원본성: 보고서 요약만이 아니라 RTL, 기계어, 테스트벤치, 실행 로그 같은 1차 자료를 함께 넣어, 평가자가 주장과 실제를 대조할 수 있게 한다.

**Overview(도메인 지식) 선정 이유**
- RISC-V ISA(RV32I): 명령어 타입·엣지 케이스를 알아야 기준 1(커버리지)과 기준 4(엣지 케이스)의 빈틈을 판단할 수 있다.
- Single/Multi-Cycle: 명령어별 사이클 수와 MEM 단계 ready 대기를 알아야 기준 5(버스 대기·핸드셰이크)를 판단할 수 있다. 파이프라인이 아님을 명시해 해저드 관련 오감점을 막는다.
- AMBA APB: SETUP/ACCESS 순서, hold, wait state 규칙이 기준 5의 판단 기준이다.
- 메모리맵/MMIO: 주소 디코딩과 미할당 주소 처리를 판단하는 근거다(기준 4, 5).
- 검증 방법론(UVM, coverage, 샘플링 타이밍, SW 시스템 검증): 기준 2(시나리오), 기준 3(판정 신뢰성)을 판단하는 틀이다.

**세부 내용(프로젝트 자료) 선정 이유**
- Target S/W(rom_code_ex1, 디스어셈블): 기대값(dmem[122]=55 등)을 미리 알아야 기준 2의 "사전 정의된 기대값 대조"를 확인할 수 있다.
- RTL(control_unit, datapath, apb_requester, apb_bram 등): 검증이 놓친 실제 결함(디코더 default 부재 등)을 찾아 기준 4, 5를 객관적으로 판단하기 위해 넣었다.
- 테스트벤치(tb_rv32i.sv)와 UVM SW 검증 환경·실행 로그: 판정이 자동인지, 결과가 실제 실행으로 입증됐는지 확인하기 위해 넣었다(기준 3).
- 팀 R&R: 평가 대상자 책임 범위에 비중을 두기 위해 넣었다.

---

## 1. Overview: 도메인 지식

### 1-1. RISC-V Architecture / ISA
- RISC-V는 개방형 RISC 명령어 집합이다. RV32I는 32비트 정수 기본 명령어 집합으로 32개 범용 레지스터(x0~x31, x0은 항상 0)를 가진다.
- 명령어는 모두 32비트이며 opcode[6:0]로 형식을 구분한다.
  - R-type(0110011): ADD, SUB, SLL, SLT, SLTU, XOR, SRL, SRA, OR, AND. funct7[5]와 funct3로 연산을 구분한다.
  - I-type(0010011): ADDI, SLTI, SLTIU, XORI, ORI, ANDI, SLLI, SRLI, SRAI. 12비트 부호 확장 즉시값을 쓴다.
  - Load(0000011): LB, LH, LW, LBU, LHU. S-type(0100011): SB, SH, SW.
  - B-type(1100011): BEQ, BNE, BLT, BGE, BLTU, BGEU. 13비트 오프셋이며 LSB는 0이다.
  - U-type: LUI(0110111), AUIPC(0010111). J-type: JAL(1101111). JALR(1100111)은 I-type 형식이다.
- 검증에서 자주 놓치는 엣지 케이스: x0 쓰기 무시, 즉시값 부호 확장, 시프트 양은 하위 5비트만 사용, SRA/SRAI의 부호 유지, SLT와 SLTU의 부호 차이, 분기 오프셋 음수, JALR 결과의 LSB 클리어, 서브워드 Load/Store의 정렬 및 부호/제로 확장, 오버플로(RV32I는 예외 없이 wrap-around).

### 1-2. Single-Cycle vs Multi-Cycle
- Single-cycle CPU는 가장 긴 경로(보통 Load)에 맞춘 고정 클럭이라 짧은 명령어에서 slack이 낭비된다.
- Multi-cycle CPU는 명령어를 FETCH, DECODE, EXECUTE, MEM, WB 단계로 나누고 FSM으로 제어한다. 단계 사이 레지스터로 경로를 끊어 클럭 주기를 줄인다. 명령어별 사이클 수가 다르다(R/I/B/U/J 3사이클, S 4사이클 이상, L 5사이클 이상, MEM 단계는 버스 ready 대기).
- 파이프라인은 여러 명령어를 단계별로 겹쳐 실행한다. 이 프로젝트는 파이프라인이 아니라 multi-cycle이므로 해저드/포워딩은 평가 대상이 아니다.

### 1-3. AMBA APB (Advanced Peripheral Bus)
- 저속 주변장치용 단순 버스다. 신호는 PCLK, PRESETn, PADDR, PSELx, PENABLE, PWRITE, PWDATA, PRDATA, PREADY(, PSLVERR)이다.
- 전송 FSM: IDLE → SETUP(PSEL=1, PENABLE=0, 1사이클) → ACCESS(PSEL=1, PENABLE=1, PREADY=1이 될 때까지 대기) → 다음 전송이 있으면 SETUP, 없으면 IDLE.
- 규칙: SETUP~ACCESS 동안 PADDR, PWRITE, PWDATA를 유지해야 한다. PREADY는 ACCESS 단계에서만 의미가 있다. 주소 디코더가 PSELx를 하나만 선택한다. 읽기 데이터는 선택된 슬레이브의 PRDATA를 MUX로 전달한다.
- 검증 포인트: 프로토콜 순서, 주소/데이터 hold, 디코딩 범위 밖 주소 처리, wait state(PREADY 지연) 처리, back-to-back 전송, 리셋 중 동작.

### 1-4. Memory Hierarchy / Memory-mapped I/O
- CPU는 Load/Store 주소로 RAM과 주변장치(GPI, GPO, GPIO, FND, UART)를 구분해 접근한다(MMIO).
- 이 프로젝트의 메모리맵(보고서 기준): RAM은 0x1000_0000~0x1000_FFFF(64KB), 주변장치는 0x2000_xxxx 영역이며 PADDR[11:8]로 GPI/GPO/GPIO/FND/UART를 선택한다.

### 1-5. 하드웨어 검증 방법론
- Directed test: 명령어별 시나리오를 정해 파형으로 확인한다.
- UVM: sequence → driver → DUT → monitor → scoreboard 구조다. constrained random 자극을 넣고, 예측 모델(reference model)과 비교해 PASS/FAIL을 판정한다.
- Functional coverage: covergroup/cross로 "무엇을 검증했는지"를 측정한다. 예: 명령어 × rs1 × rs2, 명령어 × imm 범위.
- 샘플링 타이밍: drive는 negedge, monitor는 posedge 직후(#1step)처럼 race를 피하도록 설계해야 한다. 잘못 잡으면 대량 false FAIL이 생긴다.
- SW 레벨(시스템) 검증: C 코드 → 컴파일 → 기계어(.mem) → ROM 로드 → CPU 실행 → APB → BRAM 결과 확인. 단위 검증에서 보이지 않는 명령어 조합, 스택/함수 호출, 버스 경로를 한 번에 확인한다.

---

## 2. 세부 내용: 이 프로젝트의 구현

### 2-1. Target S/W
- `rom_code_ex1.mem`: 1부터 10까지 누적합을 함수 호출(add)로 계산해 RAM에 저장하는 C 프로그램의 기계어다. 디스어셈블 결과와 복원 C 코드는 `rom_code_ex1_disasm.txt`에 있다.
- 기대값: dmem[122] = 55(sum), dmem[123] = 10(a). 루프 종료 후 PC = 0x4C에서 자기 자신으로 점프하며 정지한다.
- 이 프로그램이 사용하는 명령어는 LUI, ADDI, SW, LW, JAL, JALR, BGE, ADD로, 스택 프레임 생성과 함수 호출/복귀를 포함한다.

### 2-2. Multi-Cycle CPU (control_unit.sv, datapath.sv)
- control_unit: FETCH(pc_en=1) → DECODE → EXECUTE(opcode별 제어) → (S/L만) MEM(transfer=1, ready 대기) → (L만) WB 순서의 5상태 FSM이다.
- datapath: reg_file은 x1~x31만 저장하며 x0 읽기 시 0을 반환한다. 단계 레지스터는 DEC(rs1/rs2/imm), EXE(alu/rs2), MEM(rdata)이다. 그 외 ALU, imm_extend, PC 로직(branch/jal/jalr, U_EXE_PC_NEXT 레지스터)과 WB MUX(alu/mem/imm/pc_imm/pc_4)로 구성된다.

### 2-3. APB 기반 메모리/주변장치 인터페이스 (apb_requester.sv, apb_bram.sv)
- apb_requester: CPU 버스(bus_addr, bus_wdata, transfer, bus_we)를 APB로 변환하는 IDLE/SETUP/ACCESS FSM이다. IDLE에서 주소/데이터를 래치해 hold한다.
- address_decoder: PADDR[31:28]=1이면 RAM(PSEL0), 2이면 PADDR[11:8]로 PSEL1~6을 선택한다.
- apb_mux: 선택된 슬레이브의 PRDATA/PREADY를 CPU로 되돌린다.
- apb_bram: 128워드 메모리다. itype(funct3)으로 SB/SH/SW 쓰기와 LB/LH/LW/LBU/LHU 읽기(부호/제로 확장)를 처리한다. PREADY = PSEL & PENABLE(wait state 없음).
- GPI/GPO: 보고서에 CTR/IDR/ODR 레지스터 구조와 시뮬레이션이 있다. 제출된 RTL에는 GPI/GPO 소스가 포함되지 않았고, rv32i_top은 BRAM만 연결되어 있다.

### 2-4. 검증 결과(보고서 기준)
- 명령어 타입별 directed 시뮬레이션(R/S/I/IL/B/L/J): 파형 캡처로 확인했다.
- UVM: R/I 타입 19개 명령어 대상, 명령어마다 init_sequence로 리셋 및 레지스터 초기화. Coverage cross는 R: 10×1024(rs1×rs2), I: 6×4096(imm), I-shift: 3×32. 결과는 PASS 541,489건(예상과 일치)이고 coverage 100%다.
- 트러블슈팅: 모니터 샘플링 타이밍 문제로 FAIL 332,527건이 발생했다. 결과 값을 clocking에 맞춰 샘플링하도록 수정해 FAIL 0이 되었다.
- APB 시뮬레이션: STATE 순서, Address Decode, Address/Data HOLD, BRAM R/W, GPI CTR/IDR, GPO CTR/ODR, LED 출력.
- SW 검증: Jump, BGE, a++, Result(dmem[122]=55), Loop(PC=0x4C 고정)를 파형으로 확인했다.
- SW 검증 테스트벤치(`tb_rv32i.sv`): rv32i_top을 인스턴스하고 10ns 클럭(100MHz)을 사용한다. 10ns 후 리셋을 해제하고 15,000ns(약 1,500사이클) 동안 실행한 뒤 종료한다. FSDB 파형을 덤프해 Verdi에서 파형으로 판정한다. instruction_rom은 `./rtl/rom_code_ex1.mem`을 $readmemh로 로드한다.

---

## 3. Role & Responsibility (R&R)

| 팀원 | 역할 |
|---|---|
| 김기원 | RV32I Multi-Cycle CPU 설계 및 검증 |
| 김민식 | CPU UVM 검증 |
| 김태수 | APB Requester & Completer 설계 및 검증 |
| **정명훈 (평가 대상자)** | **CPU SW 검증**: C 코드 → 기계어 → ROM 로드 → CPU/APB/BRAM 경로의 시스템 레벨 동작 검증 |

- 평가 대상자의 책임 범위: SW 테스트 프로그램 시나리오 설계, 기대값 정의, 시뮬레이션 파형 기반 PASS 판정, SW 경로에서 발견되는 CPU/버스 결함 식별.
- 목표: 함수 호출/스택/분기/메모리 접근이 섞인 실제 프로그램이 SoC에서 기대값대로 동작함을 입증한다.
- 평가 관점: 이 프로젝트는 **검증(Verification) 관점**으로 평가한다. 설계 자체의 우수성보다 "검증이 충분하고 신뢰할 수 있는가"를 본다. 다만 검증 과정에서 놓친 설계 결함이 RTL에서 보이면 해당 검증 기준의 감점 근거로 사용한다.

---

## 4. 추가 자료: SW 시나리오 UVM 검증 환경 (최종 보고서 이후 보완)

- 최종 보고서 제출 이후, 평가 대상자의 SW 검증(기존 `tb_rv32i.sv`: 파형 육안 판정)을 자동 판정으로 보완하기 위해 UVM 기반 SW 시나리오 검증 환경(`rv32i_uvm_sw`)을 추가로 작성했다. 작성에는 AI(Claude)의 도움을 받았다. 파일명이 `uvm_`로 시작하는 첨부 자료가 이 환경이다.
- RTL은 수정하지 않았다. 계층 경로로 내부 신호를 관측하고, ROM/레지스터/BRAM은 백도어로 접근한다. 단, Verilator(2-state) 실행에서만 `apb_bram`의 `PRDATA = 32'dz`를 `32'd0`으로 바꾼 `uvm_apb_bram_verilator.sv`를 사용했다.
- 구성: driver(ROM 백도어 로드, 리셋 제어), monitor(DECODE 경계 기준 명령어 단위 커밋, 버스 hang 검출), SystemVerilog RV32I ISS(참조 모델), scoreboard(명령어마다 lock-step 비교 + 최종 레지스터/BRAM/.exp 기대값 비교), coverage.
- SW 시나리오 7개: sum_loop(팀 원본 rom_code_ex1), alu_edge, branch_jump, mem_access, fib_recursion, bubble_sort, unmapped_access(음성 시나리오).
- 실행 환경: Verilator 5.053(개발판) + UVM 2020. VCS에서는 실행하지 않았다.
- 실행 결과(첨부 로그 `uvm_log_*.log` 기준):
  - rv_regression_test: TEST PASSED. 6개 프로그램, 명령어 1,211개 ISS 비교, 기대값 68/68 일치, 오류 0.
  - 기능 커버리지: 명령어 37종 100%, 분기×taken/not-taken 100%, Load/Store×오프셋 95.00%, ALU 피연산자 경계값 83.93%, 시프트 양 84.72%, 기타 코너 100%.
  - rv_unmapped_test: 의도한 FAIL. 미할당 주소 store 시 address_decoder default 부재로 BUS_HANG 재현.
  - SLTU를 signed 비교로 바꾼 변이 RTL: 의도한 FAIL(19 errors). 환경이 실제 버그를 검출함을 확인.
- 평가 시 이 추가 자료도 평가 대상자의 SW 검증 산출물로 포함해 판단한다. 단, 보고서 이후 보완된 것임을 감안하고, 로그와 코드로 입증된 범위만 인정한다.
