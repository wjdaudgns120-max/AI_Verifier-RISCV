// rv_env_seq_test.svh - env, sequence, tests

class rv_env extends uvm_env;
    `uvm_component_utils(rv_env)
    rv_agent      agent;
    rv_scoreboard scb;
    rv_coverage   cov;

    function new(string name, uvm_component parent); super.new(name, parent); endfunction

    function void build_phase(uvm_phase phase);
        super.build_phase(phase);
        agent = rv_agent::type_id::create("agent", this);
        scb   = rv_scoreboard::type_id::create("scb", this);
        cov   = rv_coverage::type_id::create("cov", this);
    endfunction

    function void connect_phase(uvm_phase phase);
        agent.mon.ap.connect(scb.commit_imp);
        agent.drv.prog_ap.connect(scb.prog_imp);
        scb.cov_ap.connect(cov.analysis_export);
    endfunction
endclass

// -----------------------------------------------------------------------------
// 프로그램 목록을 차례로 실행하는 시퀀스
// -----------------------------------------------------------------------------
class rv_program_seq extends uvm_sequence #(rv_program_item, rv_program_item);
    `uvm_object_utils(rv_program_seq)

    string       progs[$];          // 프로그램 이름 (prog/<name>.mem, prog/<name>.exp)
    string       prog_dir = "prog";
    int unsigned max_cycles = 50000;
    bit          expect_hang;

    function new(string name = "rv_program_seq"); super.new(name); endfunction

    task body();
        foreach (progs[i]) begin
            rv_program_item it = rv_program_item::type_id::create($sformatf("prog_%0d", i));
            start_item(it);
            it.name_s      = progs[i];
            it.mem_file    = {prog_dir, "/", progs[i], ".mem"};
            it.exp_file    = {prog_dir, "/", progs[i], ".exp"};
            it.max_cycles  = max_cycles;
            it.expect_hang = expect_hang;
            finish_item(it);
        end
    endtask
endclass

// -----------------------------------------------------------------------------
// Tests
//   +PROGS=a,b,c    실행할 프로그램 목록 덮어쓰기
//   +PROG_DIR=dir   .mem/.exp 위치 (기본 prog)
//   +MAX_CYCLES=n   프로그램당 watchdog
// -----------------------------------------------------------------------------
class rv_base_test extends uvm_test;
    `uvm_component_utils(rv_base_test)
    rv_env       env;
    string       progs[$];
    int unsigned max_cycles = 50000;
    bit          expect_hang;

    function new(string name, uvm_component parent); super.new(name, parent); endfunction

    virtual function void set_programs();
        progs = '{"sum_loop"};
    endfunction

    function void build_phase(uvm_phase phase);
        string s;
        super.build_phase(phase);
        env = rv_env::type_id::create("env", this);
        set_programs();
        if ($value$plusargs("PROGS=%s", s)) begin
            progs.delete();
            split(s, progs);
        end
        void'($value$plusargs("MAX_CYCLES=%d", max_cycles));
    endfunction

    function void split(string s, ref string q[$]);
        string cur = "";
        for (int i = 0; i < s.len(); i++) begin
            if (s[i] == ",") begin if (cur != "") q.push_back(cur); cur = ""; end
            else cur = {cur, string'(s[i])};
        end
        if (cur != "") q.push_back(cur);
    endfunction

    task run_phase(uvm_phase phase);
        rv_program_seq seq = rv_program_seq::type_id::create("seq");
        string dir;
        phase.raise_objection(this);
        seq.progs       = progs;
        seq.max_cycles  = max_cycles;
        seq.expect_hang = expect_hang;
        if ($value$plusargs("PROG_DIR=%s", dir)) seq.prog_dir = dir;
        seq.start(env.agent.sqr);
        phase.drop_objection(this);
    endtask

    function void report_phase(uvm_phase phase);
        uvm_report_server rs = uvm_report_server::get_server();
        int n = rs.get_severity_count(UVM_ERROR) + rs.get_severity_count(UVM_FATAL);
        `uvm_info("TEST", (n == 0) ? "\n***  TEST PASSED  ***" : $sformatf("\n***  TEST FAILED (%0d errors)  ***", n), UVM_NONE)
    endfunction
endclass

// 팀 원본 SW 테스트 (rom_code_ex1.mem: 1~10 누적합, dmem[122]=55)
class rv_sum_loop_test extends rv_base_test;
    `uvm_component_utils(rv_sum_loop_test)
    function new(string name, uvm_component parent); super.new(name, parent); endfunction
    function void set_programs(); progs = '{"sum_loop"}; endfunction
endclass

class rv_alu_edge_test extends rv_base_test;
    `uvm_component_utils(rv_alu_edge_test)
    function new(string name, uvm_component parent); super.new(name, parent); endfunction
    function void set_programs(); progs = '{"alu_edge"}; endfunction
endclass

class rv_branch_jump_test extends rv_base_test;
    `uvm_component_utils(rv_branch_jump_test)
    function new(string name, uvm_component parent); super.new(name, parent); endfunction
    function void set_programs(); progs = '{"branch_jump"}; endfunction
endclass

class rv_mem_access_test extends rv_base_test;
    `uvm_component_utils(rv_mem_access_test)
    function new(string name, uvm_component parent); super.new(name, parent); endfunction
    function void set_programs(); progs = '{"mem_access"}; endfunction
endclass

class rv_fib_recursion_test extends rv_base_test;
    `uvm_component_utils(rv_fib_recursion_test)
    function new(string name, uvm_component parent); super.new(name, parent); endfunction
    function void set_programs(); progs = '{"fib_recursion"}; endfunction
endclass

class rv_bubble_sort_test extends rv_base_test;
    `uvm_component_utils(rv_bubble_sort_test)
    function new(string name, uvm_component parent); super.new(name, parent); endfunction
    function void set_programs(); progs = '{"bubble_sort"}; endfunction
endclass

// 회귀: 정상 시나리오 6개를 한 시뮬레이션에서 연속 실행 → 커버리지 합산
class rv_regression_test extends rv_base_test;
    `uvm_component_utils(rv_regression_test)
    function new(string name, uvm_component parent); super.new(name, parent); endfunction
    function void set_programs();
        progs = '{"sum_loop", "alu_edge", "branch_jump", "mem_access", "fib_recursion", "bubble_sort"};
    endfunction
endclass

// 음성 시나리오: 미할당 주소 접근 → 현 RTL 은 hang (결함 재현용, FAIL 이 정상)
class rv_unmapped_test extends rv_base_test;
    `uvm_component_utils(rv_unmapped_test)
    function new(string name, uvm_component parent); super.new(name, parent); endfunction
    function void set_programs();
        progs       = '{"unmapped_access"};
        max_cycles  = 2000;
        expect_hang = 1;
    endfunction
endclass
