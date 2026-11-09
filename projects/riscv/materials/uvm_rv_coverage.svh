// rv_coverage.svh - SW 시나리오 기능 커버리지 (scoreboard 가 ISS 값으로 채운 커밋을 샘플)

class rv_coverage extends uvm_subscriber #(rv_commit_item);
    `uvm_component_utils(rv_coverage)

    rv_commit_item t;
    rv_vclass_e    c1, c2;
    bit            x0_dst;
    bit [4:0]      shamt;
    bit [1:0]      off;

    // 1) 명령어 커버리지: RV32I 37개 (FENCE/ECALL/EBREAK 제외)
    covergroup cg_instr;
        cp_mnem: coverpoint t.mnem {
            bins all[] = {[I_LUI:I_AND]};
            illegal_bins ill = {I_ILLEGAL};
        }
    endgroup

    // 2) 분기: 6종 x taken/not-taken
    covergroup cg_branch;
        cp_br:    coverpoint t.mnem { bins b[] = {I_BEQ, I_BNE, I_BLT, I_BGE, I_BLTU, I_BGEU}; }
        cp_taken: coverpoint t.taken;
        x_br_taken: cross cp_br, cp_taken;
    endgroup

    // 3) Load/Store: 종류 x 바이트 오프셋 (정렬된 경우만)
    covergroup cg_mem;
        cp_ls:  coverpoint t.mnem { bins m[] = {I_LB, I_LH, I_LW, I_LBU, I_LHU, I_SB, I_SH, I_SW}; }
        cp_off: coverpoint off;
        x_ls_off: cross cp_ls, cp_off {
            ignore_bins misalign_h = binsof(cp_ls) intersect {I_LH, I_LHU, I_SH} && binsof(cp_off) intersect {1, 3};
            ignore_bins misalign_w = binsof(cp_ls) intersect {I_LW, I_SW}        && binsof(cp_off) intersect {[1:3]};
        }
    endgroup

    // 4) ALU 피연산자 경계값: 연산 x rs1 값 분류 (R-type 은 rs2 도)
    covergroup cg_alu;
        cp_op: coverpoint t.mnem {
            bins r[] = {I_ADD, I_SUB, I_SLT, I_SLTU, I_SRA};
            bins i[] = {I_ADDI, I_SLTI, I_SLTIU};
        }
        cp_rs1: coverpoint c1;
        cp_rs2: coverpoint c2 iff (rv_is_rtype(t.mnem));
        x_op_rs1: cross cp_op, cp_rs1;
    endgroup

    // 5) 시프트 양: 0 / 1~30 / 31, 레지스터 시프트의 상위 비트(>31) 무시
    covergroup cg_shift;
        cp_sh: coverpoint t.mnem { bins s[] = {I_SLL, I_SRL, I_SRA, I_SLLI, I_SRLI, I_SRAI}; }
        cp_amt: coverpoint shamt { bins zero = {0}; bins mid = {[1:30]}; bins max = {31}; }
        x_sh_amt: cross cp_sh, cp_amt;
        cp_reg_big: coverpoint (t.rs2_val[31:5] != 0) iff (t.mnem inside {I_SLL, I_SRL, I_SRA}) { bins over31 = {1}; }
    endgroup

    // 6) 기타 코너: x0 쓰기 시도, JALR 홀수 타깃, store 직후 같은 주소 load, 사이클 수
    covergroup cg_misc;
        cp_x0_write: coverpoint x0_dst { bins hit = {1}; }
        cp_jalr_odd: coverpoint ((t.rs1_val + t.imm) & 1) iff (t.mnem == I_JALR) { bins even = {0}; bins odd = {1}; }
        cp_st_ld:    coverpoint t.st_after_ld_same { bins hit = {1}; }
        cp_latency:  coverpoint t.cycles { bins c3 = {3}; bins c6 = {6}; bins c7 = {7}; bins other = default; }
    endgroup

    function new(string name, uvm_component parent);
        super.new(name, parent);
        cg_instr  = new();
        cg_branch = new();
        cg_mem    = new();
        cg_alu    = new();
        cg_shift  = new();
        cg_misc   = new();
    endfunction

    function void write(rv_commit_item tr);
        t = tr;
        c1 = rv_vclass(t.rs1_val);
        c2 = rv_vclass(t.rs2_val);
        off = t.mem_addr[1:0];
        shamt = rv_is_ialu(t.mnem) ? t.imm[4:0] : t.rs2_val[4:0];
        x0_dst = (t.instr[11:7] == 5'd0) &&
                 (rv_is_rtype(t.mnem) || rv_is_ialu(t.mnem) || rv_is_load(t.mnem) || t.mnem inside {I_LUI, I_AUIPC});
        cg_instr.sample();
        if (rv_is_branch(t.mnem)) cg_branch.sample();
        if (rv_is_load(t.mnem) || rv_is_store(t.mnem)) cg_mem.sample();
        if (rv_is_rtype(t.mnem) || rv_is_ialu(t.mnem)) cg_alu.sample();
        if (t.mnem inside {I_SLL, I_SRL, I_SRA, I_SLLI, I_SRLI, I_SRAI}) cg_shift.sample();
        cg_misc.sample();
    endfunction

    function void report_phase(uvm_phase phase);
        `uvm_info("COV", $sformatf({"\n================ 기능 커버리지 ================\n",
            "  명령어(37종)            : %6.2f %%\n",
            "  분기 x taken/not-taken  : %6.2f %%\n",
            "  Load/Store x 오프셋     : %6.2f %%\n",
            "  ALU 피연산자 경계값     : %6.2f %%\n",
            "  시프트 양               : %6.2f %%\n",
            "  기타 코너(x0/JALR/...)  : %6.2f %%\n",
            "=============================================="},
            cg_instr.get_inst_coverage(), cg_branch.get_inst_coverage(), cg_mem.get_inst_coverage(),
            cg_alu.get_inst_coverage(), cg_shift.get_inst_coverage(), cg_misc.get_inst_coverage()), UVM_NONE)
    endfunction
endclass
