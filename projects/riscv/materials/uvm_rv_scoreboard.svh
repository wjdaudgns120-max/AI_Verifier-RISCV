// rv_scoreboard.svh - ISS 기반 명령어 단위 비교 + 프로그램 종료 시 최종 상태/기대값 비교

`uvm_analysis_imp_decl(_commit)
`uvm_analysis_imp_decl(_prog)

class rv_scoreboard extends uvm_scoreboard;
    `uvm_component_utils(rv_scoreboard)

    uvm_analysis_imp_commit #(rv_commit_item,  rv_scoreboard) commit_imp;
    uvm_analysis_imp_prog   #(rv_program_item, rv_scoreboard) prog_imp;
    uvm_analysis_port       #(rv_commit_item)                 cov_ap;

    rv_backdoor bd;
    rv32i_iss   iss;

    // 현재 프로그램 상태
    bit          active, diverged;
    string       cur_name;
    int unsigned n_instr, n_checks, n_err, n_xstore, n_lat_mismatch;
    longint unsigned n_cycles_sum;
    int unsigned exp_total, exp_pass;
    bit [31:0]   last_st_addr; bit last_st_valid;
    int          max_err_print = 20;

    // 결과 요약
    string       summary[$];
    int unsigned total_err;

    function new(string name, uvm_component parent); super.new(name, parent); endfunction

    function void build_phase(uvm_phase phase);
        super.build_phase(phase);
        commit_imp = new("commit_imp", this);
        prog_imp   = new("prog_imp",   this);
        cov_ap     = new("cov_ap",     this);
        iss        = rv32i_iss::type_id::create("iss");
        if (!uvm_config_db#(rv_backdoor)::get(this, "", "bd", bd))
            `uvm_fatal("NOBD", "rv_backdoor 가 config_db 에 없음")
    endfunction

    function void err(string id, string msg);
        n_err++;
        if (n_err <= max_err_print) `uvm_error(id, $sformatf("[%s] %s", cur_name, msg))
        else if (n_err == max_err_print + 1) `uvm_error(id, $sformatf("[%s] 오류가 많아 이후 출력 생략", cur_name))
    endfunction

    function void flush_iss_warnings();
        while (iss.warns.size() > 0) begin
            `uvm_warning("ISS", $sformatf("[%s] %s", cur_name, iss.warns.pop_front()))
        end
    endfunction

    // ---------------- 프로그램 시작/종료 ----------------
    function void write_prog(rv_program_item p);
        if (p.phase == PROG_START) begin
            cur_name = p.name_s;
            iss.reset();
            for (int i = 0; i < RV_ROM_WORDS; i++) iss.imem[i] = bd.rom(i);
            active = 1; diverged = 0;
            n_instr = 0; n_checks = 0; n_err = 0; n_xstore = 0; n_lat_mismatch = 0; n_cycles_sum = 0;
            exp_total = 0; exp_pass = 0; last_st_valid = 0;
        end else begin
            final_check(p);
            active = 0;
        end
    endfunction

    // ---------------- 명령어 1개 비교 ----------------
    function void write_commit(rv_commit_item t);
        rv_iss_result_t e;
        if (!active || diverged) return;

        if (t.instr === RV_HALT_INSTR && t.pc === iss.pc) return;   // 종료 명령어
        e = iss.step();
        n_instr++;
        n_cycles_sum += t.cycles;

        // 1) 제어 흐름
        n_checks++;
        if (t.pc !== e.pc) begin
            err("PC_MISMATCH", $sformatf("PC 불일치: DUT %08h, 기대 %08h (직전 명령어의 분기/점프 결과 오류). 이 프로그램의 이후 비교 중단", t.pc, e.pc));
            diverged = 1;
            return;
        end
        if (t.instr !== e.instr)
            err("INSTR_MISMATCH", $sformatf("pc=%08h 명령어 불일치: DUT %08h, ROM 이미지 %08h", t.pc, t.instr, e.instr));

        // 2) 레지스터 쓰기
        n_checks++;
        if (e.rd_we) begin
            if (!t.rd_we)
                err("RD_MISSING", $sformatf("pc=%08h %s: x%0d 쓰기가 없음 (기대 %08h)", t.pc, e.mnem.name(), e.rd, e.rd_val));
            else if (t.rd !== e.rd)
                err("RD_ADDR", $sformatf("pc=%08h %s: 쓰기 대상 x%0d, 기대 x%0d", t.pc, e.mnem.name(), t.rd, e.rd));
            else if (e.rd_known && t.rd_val !== e.rd_val)
                err("RD_VALUE", $sformatf("pc=%08h %s: x%0d = %08h, 기대 %08h (rs1=%08h rs2=%08h imm=%08h)",
                                          t.pc, e.mnem.name(), e.rd, t.rd_val, e.rd_val, e.rs1_val, e.rs2_val, e.imm));
            else if (!e.rd_known && !$isunknown(t.rd_val)) begin
                // ISS 기준 미정의 값에서 나온 결과 → DUT 값으로 동기화(이후 비교 지속)
                iss.x[e.rd] = t.rd_val;
            end
        end else if (t.rd_we) begin
            err("RD_UNEXPECTED", $sformatf("pc=%08h %s: 예상치 못한 레지스터 쓰기 x%0d <= %08h (x0 쓰기 무시 실패?)",
                                           t.pc, e.mnem.name(), t.rd, t.rd_val));
        end

        // 3) Store (APB 쓰기)
        if (e.st) begin
            bit [31:0] exp_paddr = {4'b0000, e.st_addr[27:0]};
            bit [31:0] mask      = (e.st_size == 3'd0) ? 32'h0000_00FF : (e.st_size == 3'd1) ? 32'h0000_FFFF : 32'hFFFF_FFFF;
            n_checks++;
            if (!t.st_seen) begin
                if (e.mapped) err("ST_MISSING", $sformatf("pc=%08h %s: APB 쓰기 전송 없음 (주소 %08h)", t.pc, e.mnem.name(), e.st_addr));
            end else begin
                if (t.st_paddr !== exp_paddr)
                    err("ST_ADDR", $sformatf("pc=%08h %s: PADDR %08h, 기대 %08h", t.pc, e.mnem.name(), t.st_paddr, exp_paddr));
                if (t.st_size !== e.st_size)
                    err("ST_SIZE", $sformatf("pc=%08h %s: itype %0d, 기대 %0d", t.pc, e.mnem.name(), t.st_size, e.st_size));
                if (e.st_known) begin
                    if ((t.st_data & mask) !== (e.st_data & mask))
                        err("ST_DATA", $sformatf("pc=%08h %s: PWDATA %08h, 기대 %08h (mask %08h)", t.pc, e.mnem.name(), t.st_data, e.st_data, mask));
                end else begin
                    n_xstore++;
                    `uvm_warning("X_STORE", $sformatf("[%s] pc=%08h %s: 초기화되지 않은 레지스터 값을 메모리에 저장 (PWDATA=%08h)",
                                                      cur_name, t.pc, e.mnem.name(), t.st_data))
                end
            end
            last_st_addr = e.st_addr; last_st_valid = 1;
        end else if (t.st_seen)
            err("ST_UNEXPECTED", $sformatf("pc=%08h: 예상치 못한 APB 쓰기 %08h", t.pc, t.st_paddr));

        // 4) Load (APB 읽기 주소)
        if (e.ld) begin
            n_checks++;
            if (!t.ld_seen) begin
                if (e.mapped) err("LD_MISSING", $sformatf("pc=%08h %s: APB 읽기 전송 없음 (주소 %08h)", t.pc, e.mnem.name(), e.ld_addr));
            end else if (t.ld_paddr !== {4'b0000, e.ld_addr[27:0]})
                err("LD_ADDR", $sformatf("pc=%08h %s: PADDR %08h, 기대 %08h", t.pc, e.mnem.name(), t.ld_paddr, {4'b0000, e.ld_addr[27:0]}));
        end

        // 5) 사이클 수 (성능 모델과 비교, 정보성)
        if (t.cycles != rv_expected_cycles(e.mnem)) n_lat_mismatch++;

        flush_iss_warnings();

        // 커버리지용 정보 채워서 전달
        t.mnem     = e.mnem;
        t.rs1_val  = e.rs1_val;
        t.rs2_val  = e.rs2_val;
        t.imm      = e.imm;
        t.taken    = e.taken;
        t.mem_addr = e.st ? e.st_addr : e.ld_addr;
        t.st_after_ld_same = e.ld && last_st_valid && (e.ld_addr[31:2] == last_st_addr[31:2]) && !e.st;
        cov_ap.write(t);
    endfunction

    // ---------------- 프로그램 종료 시 최종 상태 ----------------
    function void final_check(rv_program_item p);
        int    fd;
        string kind;
        bit [31:0] a, v;
        logic [31:0] got;
        string status;
        real cpi;

        if (p.status == ST_TIMEOUT) begin
            if (p.expect_hang)
                err("KNOWN_BUG", $sformatf("예상한 RTL 결함 재현: %0d 사이클 안에 halt 도달 못함 (버스/FSM hang). 설계 의도대로면 정상 종료해야 함", p.max_cycles));
            else
                err("TIMEOUT", $sformatf("%0d 사이클 안에 halt 에 도달하지 못함", p.max_cycles));
        end

        // (a) 레지스터 최종값: ISS 가 값을 아는 레지스터만
        for (int r = 1; r < 32; r++) begin
            if (!iss.xv[r] || diverged) continue;
            got = bd.reg_val(r);
            n_checks++;
            if (got !== iss.x[r]) err("FINAL_REG", $sformatf("최종 x%0d = %08h, 기대 %08h", r, got, iss.x[r]));
        end
        // (b) BRAM 최종값: ISS 가 쓴 워드 중 4바이트 모두 정의된 것
        if (!diverged) foreach (iss.mem[i]) begin
            if (iss.memv[i] != 4'hF) continue;
            got = bd.dmem(i);
            n_checks++;
            if (got !== iss.mem[i]) err("FINAL_MEM", $sformatf("최종 dmem[%0d] = %08h, 기대 %08h", i, got, iss.mem[i]));
        end
        // (c) 프로그램 작성자가 명시한 기대값(.exp): DUT 실제 값으로 확인
        if (p.exp_file != "") begin
            fd = $fopen(p.exp_file, "r");
            if (fd == 0) `uvm_warning("NOEXP", $sformatf("기대값 파일 없음: %s", p.exp_file))
            else begin
                while ($fscanf(fd, "%s %h %h\n", kind, a, v) == 3) begin
                    exp_total++;
                    if (kind == "R") got = bd.reg_val(a);
                    else             got = bd.dmem((a & 32'h0FFF_FFFF) >> 2);
                    if (got === v) exp_pass++;
                    else err("EXPECT", $sformatf("기대값 불일치 %s %08h: DUT %08h, 기대 %08h", kind, a, got, v));
                end
                $fclose(fd);
            end
        end

        status = (n_err == 0) ? "PASS" : "FAIL";
        cpi = (n_instr > 0) ? real'(n_cycles_sum) / n_instr : 0.0;
        summary.push_back($sformatf("%-16s %-4s  instr %5d  cycles %6d  CPI %4.2f  checks %6d  expect %2d/%-2d  X-store %2d  err %0d%s",
                                    p.name_s, status, n_instr, p.cycles, cpi, n_checks, exp_pass, exp_total, n_xstore, n_err,
                                    (p.status == ST_TIMEOUT) ? "  (TIMEOUT)" : ""));
        total_err += n_err;
        `uvm_info("SCB", $sformatf("■ 프로그램 [%s] %s: 명령어 %0d개 비교, 기대값 %0d/%0d, 오류 %0d", p.name_s, status, n_instr, exp_pass, exp_total, n_err), UVM_LOW)
    endfunction

    function void report_phase(uvm_phase phase);
        string s = "\n================ SW 시나리오 검증 결과 (ISS 비교) ================\n";
        foreach (summary[i]) s = {s, summary[i], "\n"};
        s = {s, "=================================================================="};
        `uvm_info("SCB", s, UVM_NONE)
    endfunction
endclass
