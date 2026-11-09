# RV32I SoC — SW 시나리오 UVM 검증 환경

기존 `tb_rv32i.sv`는 15,000ns 동안 실행한 뒤 파형을 눈으로 보고 판정하는 방식이었습니다. 이 환경은 같은 SW 검증을 **UVM으로 자동 판정**합니다.
RTL(`rtl/`)은 **수정하지 않았습니다.** 내부 신호는 계층 경로로 관측하고, ROM·레지스터·BRAM은 백도어로 접근합니다.

## 구조

```
 prog/*.S ──rvasm.py──▶ *.mem / *.exp
                          │
   ┌──────────── UVM env ─┼──────────────────────────────────────────────┐
   │ rv_program_seq ─▶ rv_driver: 리셋 → ROM 백도어 로드 → 리셋 해제       │
   │                      │  START/END ─────────────┐                    │
   │   DUT(rv32i_top) ◀───┘                         ▼                    │
   │      │ probe(c_state, pc, rf write, APB)   rv_scoreboard             │
   │      ▼                                      ├ rv32i_iss (참조 모델) │
   │   rv_monitor ── 명령어 단위 커밋 ─────────▶ │ 명령어마다 lock-step   │
   │      (DECODE ~ 다음 DECODE)                 │ 비교 + 최종 상태 비교  │
   │                                             └▶ rv_coverage           │
   └──────────────────────────────────────────────────────────────────────┘
```

| 구성 요소 | 하는 일 |
|---|---|
| `rv_driver` | 프로그램(.mem)을 `instruction_rom`에 백도어로 로드합니다. 레지스터와 BRAM은 X로 초기화(전원 인가 직후 상태 모사)하고, 리셋을 해제한 뒤 halt 또는 watchdog을 기다립니다. |
| `rv_monitor` | DECODE 상태 진입을 명령어 경계로 삼아, 한 명령어 동안의 레지스터 쓰기와 APB 전송을 커밋 1건으로 묶습니다. 버스 hang(MEM 상태에서 64사이클 동안 ready 없음)과 FSM 정지도 검출합니다. |
| `rv32i_iss` | SystemVerilog로 작성한 RV32I 명령어 집합 시뮬레이터입니다. 메모리 모델은 APB/BRAM의 실제 동작(512B, 비정렬 처리)에 맞췄습니다. |
| `rv_scoreboard` | 명령어마다 PC, 레지스터 쓰기(대상·값), store(PADDR·PWDATA·크기), load 주소를 비교합니다. 프로그램이 끝나면 레지스터 31개, BRAM, `.exp` 기대값을 비교합니다. 초기화되지 않은 레지스터를 store하면 경고합니다. |
| `rv_coverage` | 명령어 37종, 분기 6종 × taken/not-taken, Load/Store × 오프셋, ALU 경계값(0/1/-1/MAX/MIN), 시프트 양, x0 쓰기, JALR 홀수 타깃, 명령어별 사이클 수 |

## SW 시나리오 (prog/)

| 프로그램 | 내용 | 기대값(.exp) |
|---|---|---|
| `sum_loop` | 팀 원본 `rom_code_ex1.mem` (1~10 누적합) | dmem[122]=55, dmem[123]=10 |
| `alu_edge` | 오버플로, SLT/SLTU 부호 경계, SRA, 시프트 양 하위 5비트, 즉시값 부호 확장, x0 쓰기 무시 | 25개 |
| `branch_jump` | 분기 6종 taken/not-taken(signed/unsigned 경계), backward 루프, JAL 링크, JALR 홀수 타깃·rd==rs1, AUIPC, LUI | 6개 |
| `mem_access` | SB 4 레인, SH 상/하위, LB/LBU/LH/LHU 확장, 음수 오프셋, store 직후 load | 18개 |
| `fib_recursion` | 재귀 fib(7): 스택 push/pop, ra/s0/s1 저장·복원, 중첩 복귀 | 7개 |
| `bubble_sort` | C 형태 중첩 루프, 메모리 swap, signed 정렬, 오버플로 합 | 10개 |
| `unmapped_access` | **음성 시나리오**: 미할당 주소(0x3000_0000) store | 아래 참고 |

모든 프로그램은 `halt`(= `jal x0, 0`, 0x0000006F)로 끝납니다. ROM 크기 제한 때문에 각 프로그램은 128워드 이하입니다.

## 실행 (VCS + Verdi 기준)

```bash
make iss                                   # (선택) 시뮬레이터 없이 Python ISS 로 프로그램·기대값 확인
make comp                                  # 컴파일
make run TEST=rv_regression_test           # 정상 시나리오 6개 연속 실행 + 커버리지 합산
make run TEST=rv_alu_edge_test             # 개별 시나리오
make run TEST=rv_base_test PLUS="+PROGS=alu_edge,mem_access"
make run TEST=rv_unmapped_test             # 결함 재현용 음성 테스트
make cov                                   # URG 코드/기능 커버리지 리포트
make comp FSDB=1 && make run && make verdi # 파형
```

로그 끝에 다음 세 가지가 출력됩니다.
- 프로그램별 결과표: 명령어 수, 사이클 수, CPI, 비교 횟수, 기대값 일치 수, 오류 수
- 기능 커버리지 %
- `TEST PASSED` 또는 `TEST FAILED`

Questa/Xcelium에서 실행할 때는 `-ntb_opts uvm-1.2` 대신 각 툴의 UVM 옵션(`-uvm`, `-L uvm` 등)을 쓰세요.

## 실행 결과 (Verilator 5.053 + UVM 2020, `logs/`)

VCS는 사용하지 않았습니다. 오픈소스 Verilator로 실제 RTL에 실행한 결과입니다.

| 테스트 | 결과 |
|---|---|
| `rv_regression_test` | **TEST PASSED**: 6개 프로그램, 명령어 1,211개를 ISS와 lock-step으로 비교했고 기대값 68/68이 일치했습니다. |
| `rv_unmapped_test` | **FAIL (의도한 결과)**: `BUS_HANG`, `KNOWN_BUG`로 미할당 주소 hang 결함이 재현되었습니다. |
| SLTU 변이(mutant) RTL | **FAIL (의도한 결과)**: SLTU를 signed 비교로 바꾼 RTL에서 `RD_VALUE`, `FINAL_REG` 오류가 검출되었습니다. 검증 환경이 실제 버그를 잡는다는 확인입니다. |

| 프로그램 | 명령어 | 사이클 | CPI | 비교 횟수 | 기대값 |
|---|---|---|---|---|---|
| sum_loop | 252 | 1,274 | 5.05 | 662 | 2/2 |
| alu_edge | 60 | 257 | 4.25 | 197 | 25/25 |
| branch_jump | 84 | 266 | 3.14 | 193 | 6/6 |
| mem_access | 55 | 294 | 5.31 | 186 | 18/18 |
| fib_recursion | 475 | 1,856 | 3.90 | 1,101 | 7/7 |
| bubble_sort | 285 | 1,218 | 4.27 | 686 | 10/10 |

기능 커버리지(회귀 1회 기준):

| 항목 | 커버리지 |
|---|---|
| 명령어 37종 | 100% |
| 분기 × taken/not-taken | 100% |
| Load/Store × 오프셋 | 95% |
| ALU 경계값 | 84% |
| 시프트 양 | 85% |
| 기타 코너 | 100% |

남은 구멍은 새 `.S` 시나리오를 추가해서 채우면 됩니다.

참고 사항:
- 팀 원본 `sum_loop`에서 X-store 경고가 2건 나옵니다. `main`이 초기화되지 않은 `ra`와 `s0`를 스택에 저장하기 때문이고, 결과에는 영향이 없습니다.
- Verilator는 2-state 시뮬레이터입니다. 그래서 `apb_bram`의 `else PRDATA = 32'dz;`를 처리하는 방식이 VCS와 달라, 읽기 값이 갱신되지 않는 현상이 있었습니다. Verilator 실행에서만 이 줄을 `32'd0`으로 바꾼 `smoke/apb_bram_verilator.sv`를 썼고, VCS(4-state)에서는 원본을 그대로 쓰면 됩니다. 다만 버스 내부 로직에서 `'z`를 쓰는 것은 툴에 따라 결과가 달라질 수 있으니 `32'd0`으로 바꾸는 것을 권장합니다.
- Verilator로 직접 실행하려면 `UVM_HOME=<uvm-verilator>/src ./scripts/run_verilator.sh rv_regression_test`를 쓰세요.

## 결함 재현 테스트 (rv_unmapped_test)

`address_decoder`에는 미할당 주소에 대한 default 처리가 없습니다. 이 경우 PSEL이 하나도 선택되지 않고, `apb_mux`는 기본값 `ready = PREADY0 = 0`을 냅니다. 그래서 CPU가 MEM 상태에서 영구히 멈춥니다.
이 테스트는 그 결함을 드러내기 위한 것이므로, **현재 RTL에서는 FAIL(BUS_HANG / KNOWN_BUG)이 나오는 것이 정상입니다.** 디코더에 default 응답(예: 에러 슬레이브가 PREADY=1, PSLVERR=1을 반환)을 추가하면 PASS로 바뀝니다.

## 새 시나리오 추가

1. `prog/my_test.S`를 작성합니다. 형식은 `prog/*.S`를 참고하고, 기대값은 `# EXPECT x10 55` 또는 `# EXPECT mem 0x10000000 0x1234`로 적습니다.
2. `make asm && make iss`로 Python ISS에서 PASS인지 확인합니다.
3. `make run TEST=rv_base_test PLUS="+PROGS=my_test"`로 실행합니다.

C 코드를 쓰려면 `riscv32-unknown-elf-gcc -march=rv32i -mabi=ilp32 -nostdlib -O0`로 컴파일하고 `objcopy -O verilog`로 .mem을 만들면 됩니다. 다음 세 가지에 맞춰야 합니다.
- 시작 주소 0
- 마지막에 `while(1);`(halt)
- 스택은 `sp = 0x1000_0200` 이하(BRAM 512B)
