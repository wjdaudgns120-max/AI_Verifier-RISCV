// rv_agent.svh - 프로그램 로더 driver + 커밋 monitor

class rv_sequencer extends uvm_sequencer #(rv_program_item, rv_program_item);
    `uvm_component_utils(rv_sequencer)
    function new(string name, uvm_component parent); super.new(name, parent); endfunction
endclass

// -----------------------------------------------------------------------------
// Driver: 프로그램 1개 = 리셋 → ROM 백도어 로드 → 리셋 해제 → halt 또는 timeout 대기
// -----------------------------------------------------------------------------
class rv_driver extends uvm_driver #(rv_program_item, rv_program_item);
    `uvm_component_utils(rv_driver)

    virtual rv_probe_if vif;
    rv_backdoor         bd;
    uvm_event           halt_ev;
    uvm_analysis_port #(rv_program_item) prog_ap;   // START/END 알림 → scoreboard

    function new(string name, uvm_component parent); super.new(name, parent); endfunction

    function void build_phase(uvm_phase phase);
        super.build_phase(phase);
        prog_ap = new("prog_ap", this);
        if (!uvm_config_db#(virtual rv_probe_if)::get(this, "", "vif", vif))
            `uvm_fatal("NOVIF", "rv_probe_if 가 config_db 에 없음")
        if (!uvm_config_db#(rv_backdoor)::get(this, "", "bd", bd))
            `uvm_fatal("NOBD", "rv_backdoor 가 config_db 에 없음")
        halt_ev = uvm_event_pool::get_global("rv_halt");
    endfunction

    task run_phase(uvm_phase phase);
        vif.rst_n <= 1'b0;
        forever begin
            rv_program_item p;
            seq_item_port.get_next_item(p);
            run_program(p);
            seq_item_port.item_done();
        end
    endtask

    task run_program(rv_program_item p);
        rv_program_item s, e;
        longint unsigned t0;
        int unsigned cyc = 0;

        // 1) 리셋 유지 상태에서 ROM 로드 + 내부 상태 X 초기화
        vif.rst_n <= 1'b0;
        repeat (3) @(posedge vif.clk);
        bd.fill_rom(RV_HALT_INSTR);           // 프로그램 밖으로 벗어나면 halt 로 멈추도록
        bd.load_rom(p.mem_file);
        bd.poison_state();
        halt_ev.reset();

        $cast(s, p.clone());
        s.phase = PROG_START;
        prog_ap.write(s);
        `uvm_info("DRV", $sformatf("▶ 프로그램 [%s] 시작 (%s, max %0d cycles)", p.name_s, p.mem_file, p.max_cycles), UVM_LOW)

        // 2) 리셋 해제 후 halt 또는 timeout
        @(negedge vif.clk) vif.rst_n <= 1'b1;
        fork
            begin
                halt_ev.wait_trigger();
                p.status = ST_HALTED;
            end
            begin
                forever begin
                    @(posedge vif.clk);
                    cyc++;
                    if (cyc >= p.max_cycles) break;
                end
                p.status = ST_TIMEOUT;
            end
        join_any
        disable fork;
        p.cycles = cyc;
        repeat (2) @(posedge vif.clk);

        // 3) 종료 알림 → scoreboard 최종 상태 비교
        $cast(e, p.clone());
        e.phase = PROG_END;
        prog_ap.write(e);
        vif.rst_n <= 1'b0;
        @(posedge vif.clk);
    endtask
endclass

// -----------------------------------------------------------------------------
// Monitor: DECODE 진입을 명령어 경계로 삼아 레지스터 쓰기 / APB 전송을 묶어 커밋 1건으로 출력
//   - pc/instr 는 DECODE 사이클 값 (multi-cycle 에서 PC 는 FETCH 끝에 갱신됨)
//   - 레지스터 쓰기: rf_we && rf_wa != 0 (x0 쓰기는 무효)
//   - APB 완료: PSEL0 && PENABLE && PREADY0
//   - halt(jal x0,0) 을 DECODE 하면 halt 이벤트 발생
// -----------------------------------------------------------------------------
class rv_monitor extends uvm_monitor;
    `uvm_component_utils(rv_monitor)

    virtual rv_probe_if vif;
    uvm_analysis_port #(rv_commit_item) ap;
    uvm_event        halt_ev;
    longint unsigned cycle;
    int unsigned     stuck_cnt;

    function new(string name, uvm_component parent); super.new(name, parent); endfunction

    function void build_phase(uvm_phase phase);
        super.build_phase(phase);
        ap = new("ap", this);
        if (!uvm_config_db#(virtual rv_probe_if)::get(this, "", "vif", vif))
            `uvm_fatal("NOVIF", "rv_probe_if 가 config_db 에 없음")
        halt_ev = uvm_event_pool::get_global("rv_halt");
    endfunction

    task run_phase(uvm_phase phase);
        rv_commit_item cur;
        bit halted;
        forever begin
            @(vif.mon_cb);
            cycle++;
            if (vif.mon_cb.rst_n !== 1'b1) begin
                cur = null; halted = 0; stuck_cnt = 0;
                continue;
            end
            if (halted) continue;

            if (vif.mon_cb.c_state == 3'd1) begin             // DECODE: 새 명령어 시작
                if (cur != null) begin
                    cur.cycles = cycle - cur.start_cycle;
                    ap.write(cur);
                end
                cur = rv_commit_item::type_id::create("cur");
                cur.pc          = vif.mon_cb.pc;
                cur.instr       = vif.mon_cb.instr;
                cur.start_cycle = cycle;
                if (vif.mon_cb.instr === RV_HALT_INSTR) begin
                    cur.cycles = 3;
                    ap.write(cur);
                    cur    = null;
                    halted = 1;
                    `uvm_info("MON", $sformatf("halt 감지 (pc=%08h)", vif.mon_cb.pc), UVM_MEDIUM)
                    halt_ev.trigger();
                    continue;
                end
            end
            if (cur == null) continue;

            // 레지스터 파일 쓰기
            if (vif.mon_cb.rf_we === 1'b1 && vif.mon_cb.rf_wa != 5'd0) begin
                cur.n_rf_writes++;
                cur.rd_we  = 1;
                cur.rd     = vif.mon_cb.rf_wa;
                cur.rd_val = vif.mon_cb.rf_wd;
            end
            // APB 전송 완료 (BRAM)
            if (vif.mon_cb.psel0 === 1'b1 && vif.mon_cb.penable === 1'b1 && vif.mon_cb.pready0 === 1'b1) begin
                cur.n_apb++;
                if (vif.mon_cb.pwrite) begin
                    cur.st_seen  = 1;
                    cur.st_paddr = vif.mon_cb.paddr;
                    cur.st_data  = vif.mon_cb.pwdata;
                    cur.st_size  = vif.mon_cb.itype;
                end else begin
                    cur.ld_seen  = 1;
                    cur.ld_paddr = vif.mon_cb.paddr;
                    cur.ld_data  = vif.mon_cb.prdata0;
                    cur.ld_size  = vif.mon_cb.itype;
                end
            end
            // MEM 상태에서 ready 를 못 받고 오래 머무르면 bus hang 경고
            if (vif.mon_cb.c_state == 3'd3 && vif.mon_cb.ready !== 1'b1) begin
                stuck_cnt++;
                if (stuck_cnt == 64)
                    `uvm_error("BUS_HANG", $sformatf("pc=%08h instr=%08h: MEM 상태에서 64 사이클 동안 ready 없음 (APB 주소 %08h, transfer=%0b) → 버스 hang",
                                                     cur.pc, cur.instr, vif.mon_cb.paddr, vif.mon_cb.transfer))
            end else stuck_cnt = 0;
            // 미정의 opcode 등으로 EXECUTE 에 갇히는 경우
            if (vif.mon_cb.c_state == 3'd2 && (cycle - cur.start_cycle) == 64)
                `uvm_error("FSM_STUCK", $sformatf("pc=%08h instr=%08h: EXECUTE 상태에서 64 사이클 정지 (미정의 opcode?)", cur.pc, cur.instr))
        end
    endtask
endclass

// -----------------------------------------------------------------------------
class rv_agent extends uvm_agent;
    `uvm_component_utils(rv_agent)
    rv_sequencer sqr;
    rv_driver    drv;
    rv_monitor   mon;

    function new(string name, uvm_component parent); super.new(name, parent); endfunction

    function void build_phase(uvm_phase phase);
        super.build_phase(phase);
        mon = rv_monitor::type_id::create("mon", this);
        if (get_is_active() == UVM_ACTIVE) begin
            sqr = rv_sequencer::type_id::create("sqr", this);
            drv = rv_driver::type_id::create("drv", this);
        end
    endfunction

    function void connect_phase(uvm_phase phase);
        if (get_is_active() == UVM_ACTIVE)
            drv.seq_item_port.connect(sqr.seq_item_export);
    endfunction
endclass
