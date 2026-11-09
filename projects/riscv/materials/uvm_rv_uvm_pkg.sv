// rv_uvm_pkg.sv - RV32I SoC SW 시나리오 UVM 검증 패키지
package rv_uvm_pkg;
    import uvm_pkg::*;
    `include "uvm_macros.svh"

    `include "rv_types.svh"
    `include "rv_items.svh"
    `include "rv32i_iss.svh"
    `include "rv_agent.svh"
    `include "rv_scoreboard.svh"
    `include "rv_coverage.svh"
    `include "rv_env_seq_test.svh"
endpackage
