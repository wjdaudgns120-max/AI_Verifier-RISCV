// rv_types.svh - 공통 타입, 명령어 디코더, DUT 백도어 추상 클래스

localparam bit [31:0] RV_HALT_INSTR = 32'h0000_006F;   // jal x0, 0  (프로그램 종료 표시)
localparam int        RV_ROM_WORDS  = 128;
localparam int        RV_BRAM_WORDS = 128;

typedef enum int {
    I_LUI, I_AUIPC, I_JAL, I_JALR,
    I_BEQ, I_BNE, I_BLT, I_BGE, I_BLTU, I_BGEU,
    I_LB, I_LH, I_LW, I_LBU, I_LHU,
    I_SB, I_SH, I_SW,
    I_ADDI, I_SLTI, I_SLTIU, I_XORI, I_ORI, I_ANDI, I_SLLI, I_SRLI, I_SRAI,
    I_ADD, I_SUB, I_SLL, I_SLT, I_SLTU, I_XOR, I_SRL, I_SRA, I_OR, I_AND,
    I_ILLEGAL
} rv_mnem_e;

// 피연산자 값 분류 (경계값 커버리지용)
typedef enum int { V_ZERO, V_ONE, V_NEG1, V_MAXP, V_MINN, V_POS, V_NEG } rv_vclass_e;

function automatic rv_vclass_e rv_vclass(bit [31:0] v);
    if (v == 32'h0)          return V_ZERO;
    if (v == 32'h1)          return V_ONE;
    if (v == 32'hFFFF_FFFF)  return V_NEG1;
    if (v == 32'h7FFF_FFFF)  return V_MAXP;
    if (v == 32'h8000_0000)  return V_MINN;
    if (v[31])               return V_NEG;
    return V_POS;
endfunction

function automatic rv_mnem_e rv_decode(bit [31:0] ins);
    bit [6:0] op = ins[6:0];
    bit [2:0] f3 = ins[14:12];
    bit       f75 = ins[30];
    case (op)
        7'b0110111: return I_LUI;
        7'b0010111: return I_AUIPC;
        7'b1101111: return I_JAL;
        7'b1100111: return (f3 == 3'd0) ? I_JALR : I_ILLEGAL;
        7'b1100011: case (f3)
                        3'd0: return I_BEQ;  3'd1: return I_BNE;
                        3'd4: return I_BLT;  3'd5: return I_BGE;
                        3'd6: return I_BLTU; 3'd7: return I_BGEU;
                        default: return I_ILLEGAL;
                    endcase
        7'b0000011: case (f3)
                        3'd0: return I_LB;  3'd1: return I_LH; 3'd2: return I_LW;
                        3'd4: return I_LBU; 3'd5: return I_LHU;
                        default: return I_ILLEGAL;
                    endcase
        7'b0100011: case (f3)
                        3'd0: return I_SB; 3'd1: return I_SH; 3'd2: return I_SW;
                        default: return I_ILLEGAL;
                    endcase
        7'b0010011: case (f3)
                        3'd0: return I_ADDI;  3'd2: return I_SLTI; 3'd3: return I_SLTIU;
                        3'd4: return I_XORI;  3'd6: return I_ORI;  3'd7: return I_ANDI;
                        3'd1: return I_SLLI;
                        3'd5: return f75 ? I_SRAI : I_SRLI;
                    endcase
        7'b0110011: case (f3)
                        3'd0: return f75 ? I_SUB : I_ADD;
                        3'd1: return I_SLL;  3'd2: return I_SLT; 3'd3: return I_SLTU;
                        3'd4: return I_XOR;  3'd5: return f75 ? I_SRA : I_SRL;
                        3'd6: return I_OR;   3'd7: return I_AND;
                    endcase
        default: return I_ILLEGAL;
    endcase
    return I_ILLEGAL;
endfunction

function automatic bit rv_is_branch(rv_mnem_e m); return m inside {I_BEQ, I_BNE, I_BLT, I_BGE, I_BLTU, I_BGEU}; endfunction
function automatic bit rv_is_load  (rv_mnem_e m); return m inside {I_LB, I_LH, I_LW, I_LBU, I_LHU};              endfunction
function automatic bit rv_is_store (rv_mnem_e m); return m inside {I_SB, I_SH, I_SW};                             endfunction
function automatic bit rv_is_rtype (rv_mnem_e m); return m inside {I_ADD, I_SUB, I_SLL, I_SLT, I_SLTU, I_XOR, I_SRL, I_SRA, I_OR, I_AND}; endfunction
function automatic bit rv_is_ialu  (rv_mnem_e m); return m inside {I_ADDI, I_SLTI, I_SLTIU, I_XORI, I_ORI, I_ANDI, I_SLLI, I_SRLI, I_SRAI}; endfunction

// 명령어 종류별 기대 사이클 수 (Multi-cycle FSM + APB 3-phase 기준)
//   R/I/U/J/B : FETCH-DECODE-EXECUTE                      = 3
//   Store     : + MEM(IDLE 래치 / SETUP / ACCESS)         = 6
//   Load      : + MEM(3) + WB                             = 7
function automatic int rv_expected_cycles(rv_mnem_e m);
    if (rv_is_store(m)) return 6;
    if (rv_is_load(m))  return 7;
    return 3;
endfunction

// DUT 내부 메모리 접근(백도어). 실제 구현은 tb top 모듈 안의 클래스(계층 경로 사용)
virtual class rv_backdoor extends uvm_object;
    function new(string name = "rv_backdoor"); super.new(name); endfunction
    pure virtual function void          fill_rom(bit [31:0] word);
    pure virtual function void          load_rom(string file);
    pure virtual function logic [31:0]  rom(int idx);
    pure virtual function logic [31:0]  reg_val(int idx);
    pure virtual function logic [31:0]  dmem(int idx);
    pure virtual function void          poison_state();   // 레지스터/BRAM 을 X 로 (전원 인가 직후 상태 모사)
endclass
