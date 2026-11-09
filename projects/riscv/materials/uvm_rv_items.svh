// rv_items.svh - 트랜잭션

// 실행할 SW 프로그램 1개 (driver 가 ROM 에 로드하고 리셋 해제)
typedef enum int { PROG_START, PROG_END } rv_prog_phase_e;
typedef enum int { ST_RUNNING, ST_HALTED, ST_TIMEOUT } rv_prog_status_e;

class rv_program_item extends uvm_sequence_item;
    string            name_s;          // 프로그램 이름 (예: alu_edge)
    string            mem_file;        // $readmemh 이미지
    string            exp_file;        // 기대값 파일 (R/M 라인), 없으면 ""
    int unsigned      max_cycles = 50000;
    bit               expect_hang;     // 음성 시나리오: hang 이 '결함 재현'
    // driver 가 채움
    rv_prog_phase_e   phase;
    rv_prog_status_e  status = ST_RUNNING;
    int unsigned      cycles;

    `uvm_object_utils_begin(rv_program_item)
        `uvm_field_string(name_s,   UVM_DEFAULT)
        `uvm_field_string(mem_file, UVM_DEFAULT)
        `uvm_field_string(exp_file, UVM_DEFAULT)
        `uvm_field_int(max_cycles,  UVM_DEFAULT | UVM_DEC)
        `uvm_field_int(expect_hang, UVM_DEFAULT)
        `uvm_field_enum(rv_prog_phase_e,  phase,  UVM_DEFAULT)
        `uvm_field_enum(rv_prog_status_e, status, UVM_DEFAULT)
        `uvm_field_int(cycles,      UVM_DEFAULT | UVM_DEC)
    `uvm_object_utils_end

    function new(string name = "rv_program_item"); super.new(name); endfunction
endclass

// 모니터가 관측한 '명령어 1개 실행' (DECODE 진입 ~ 다음 DECODE 직전)
class rv_commit_item extends uvm_sequence_item;
    // DUT 관측값
    logic [31:0] pc, instr;
    bit          rd_we;      logic [4:0]  rd;     logic [31:0] rd_val;
    bit          st_seen;    logic [31:0] st_paddr, st_data; logic [2:0] st_size;
    bit          ld_seen;    logic [31:0] ld_paddr, ld_data; logic [2:0] ld_size;
    int unsigned n_rf_writes, n_apb;
    int unsigned cycles;     // 이 명령어에 걸린 클럭 수
    longint unsigned start_cycle;
    // scoreboard 가 채움 (커버리지용, ISS 기준값)
    rv_mnem_e    mnem = I_ILLEGAL;
    bit [31:0]   rs1_val, rs2_val, imm;
    bit          taken;
    bit [31:0]   mem_addr;
    bit          st_after_ld_same;   // 직전 store 주소를 바로 load

    `uvm_object_utils(rv_commit_item)
    function new(string name = "rv_commit_item"); super.new(name); endfunction

    function string convert2string();
        string s = $sformatf("pc=%08h instr=%08h", pc, instr);
        if (rd_we)   s = {s, $sformatf(" x%0d<=%08h", rd, rd_val)};
        if (st_seen) s = {s, $sformatf(" APB W[%08h]<=%08h sz%0d", st_paddr, st_data, st_size)};
        if (ld_seen) s = {s, $sformatf(" APB R[%08h]=>%08h sz%0d", ld_paddr, ld_data, ld_size)};
        s = {s, $sformatf(" (%0d cyc)", cycles)};
        return s;
    endfunction
endclass
