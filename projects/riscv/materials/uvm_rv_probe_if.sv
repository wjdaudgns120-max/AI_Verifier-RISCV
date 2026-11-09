// rv_probe_if.sv
// DUT(rv32i_top) 관측용 인터페이스. 신호는 tb top 에서 계층 경로로 연결(white-box probe).
// rst_n 만 driver 가 구동하고, 나머지는 모두 입력(관측) 전용.
interface rv_probe_if (input logic clk);
    logic        rst_n;

    // control_unit
    logic [ 2:0] c_state;        // FETCH=0 DECODE=1 EXECUTE=2 MEM=3 WB=4
    // instruction fetch
    logic [31:0] pc;             // instr_addr
    logic [31:0] instr;          // instr_code
    // register file write port
    logic        rf_we;
    logic [ 4:0] rf_wa;
    logic [31:0] rf_wd;
    // CPU <-> APB requester
    logic        transfer;
    logic        ready;
    // APB (BRAM = slave 0)
    logic [31:0] paddr;
    logic [31:0] pwdata;
    logic        pwrite;
    logic        penable;
    logic        psel0;
    logic        pready0;
    logic [31:0] prdata0;
    logic [ 2:0] itype;

    // 모니터: posedge 직전(#1step) 값을 샘플 = 방금 끝난 사이클의 값
    clocking mon_cb @(posedge clk);
        default input #1step;
        input rst_n, c_state, pc, instr, rf_we, rf_wa, rf_wd, transfer, ready,
              paddr, pwdata, pwrite, penable, psel0, pready0, prdata0, itype;
    endclocking
endinterface
