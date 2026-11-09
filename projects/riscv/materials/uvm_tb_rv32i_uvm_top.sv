// tb_rv32i_uvm_top.sv - UVM top. DUT(rv32i_top)는 수정하지 않고 계층 경로로 관측/백도어 접근
`timescale 1ns/1ps

`ifndef RV_DEFAULT_TEST
`define RV_DEFAULT_TEST "rv_regression_test"
`endif

module tb_rv32i_uvm_top;
    import uvm_pkg::*;
    import rv_uvm_pkg::*;
    `include "uvm_macros.svh"

    logic clk = 1'b0;
    always #5 clk = ~clk;            // 100 MHz (기존 tb_rv32i.sv 와 동일)

    rv_probe_if probe (clk);

    rv32i_top dut (
        .clk   (clk),
        .rst_n (probe.rst_n)
    );

    // ---------------- white-box probe 연결 ----------------
    assign probe.c_state  = dut.U_RV32I_CPU.U_CONTROL_UNIT.c_state;
    assign probe.pc       = dut.instr_addr;
    assign probe.instr    = dut.instr_code;
    assign probe.rf_we    = dut.U_RV32I_CPU.U_DATAPATH.U_REG_FILE.we;
    assign probe.rf_wa    = dut.U_RV32I_CPU.U_DATAPATH.U_REG_FILE.wa;
    assign probe.rf_wd    = dut.U_RV32I_CPU.U_DATAPATH.U_REG_FILE.wd;
    assign probe.transfer = dut.transfer;
    assign probe.ready    = dut.ready;
    assign probe.paddr    = dut.PADDR;
    assign probe.pwdata   = dut.PWDATA;
    assign probe.pwrite   = dut.PWRITE;
    assign probe.penable  = dut.PENABLE;
    assign probe.psel0    = dut.PSEL0;
    assign probe.pready0  = dut.PREADY0;
    assign probe.prdata0  = dut.PRDATA0;
    assign probe.itype    = dut.itype;

    // ---------------- 백도어 구현 (모듈 안 클래스라 계층 경로 사용 가능) ----------------
    class rv_backdoor_impl extends rv_backdoor;
        function new(string name = "rv_backdoor_impl"); super.new(name); endfunction

        virtual function void fill_rom(bit [31:0] word);
            for (int i = 0; i < RV_ROM_WORDS; i++) dut.U_INSTR_ROM.instr_rom[i] = word;
        endfunction
        virtual function void load_rom(string file);
            $readmemh(file, dut.U_INSTR_ROM.instr_rom);
        endfunction
        virtual function logic [31:0] rom(int idx);
            return dut.U_INSTR_ROM.instr_rom[idx];
        endfunction
        virtual function logic [31:0] reg_val(int idx);
            return (idx == 0) ? 32'h0 : dut.U_RV32I_CPU.U_DATAPATH.U_REG_FILE.ram_file[idx];
        endfunction
        virtual function logic [31:0] dmem(int idx);
            return dut.U_APB_BRAM.dmem[idx];
        endfunction
        virtual function void poison_state();
            for (int i = 1; i < 32; i++)            dut.U_RV32I_CPU.U_DATAPATH.U_REG_FILE.ram_file[i] = 'x;
            for (int i = 0; i < RV_BRAM_WORDS; i++) dut.U_APB_BRAM.dmem[i] = 'x;
        endfunction
    endclass

    initial begin
        rv_backdoor_impl bd = new();
        uvm_config_db#(virtual rv_probe_if)::set(null, "uvm_test_top.*", "vif", probe);
        uvm_config_db#(rv_backdoor)::set(null, "uvm_test_top.*", "bd", bd);
        run_test(`RV_DEFAULT_TEST);   // +UVM_TESTNAME 이 있으면 그것이 우선
    end

`ifdef FSDB
    initial begin
        $fsdbDumpfile("wave_uvm.fsdb");
        $fsdbDumpvars(0, tb_rv32i_uvm_top);
    end
`endif
endmodule
