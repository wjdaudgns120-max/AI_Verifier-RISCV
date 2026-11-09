// rv32i_iss.svh - 참조 모델(Reference model): RV32I 명령어 집합 시뮬레이터
// scoreboard 가 DUT 커밋 1건마다 step() 1회를 호출해 결과를 비교한다.
// tools/rviss.py 와 동일한 동작(메모리 모델은 apb_requester + apb_bram 에 맞춤).
//   - 레지스터/메모리마다 '값이 정의됨(known)' 비트를 추적: DUT 는 리셋이 없어 초기값이 X
//   - RAM: addr[31:28]==1, BRAM 인덱스 = (addr & 0x0FFF_FFFF) >> 2, 구현 128 워드
//   - SH/LH/LHU: addr[1:0] = 0/2 만 정의 (RTL: 그 외 쓰기 없음 / 읽기 0)

typedef struct {
    bit [31:0] pc, instr, next_pc, imm;
    rv_mnem_e  mnem;
    bit [31:0] rs1_val, rs2_val;
    bit        rs1_known, rs2_known;
    bit        rd_we;   bit [4:0] rd;    bit [31:0] rd_val;  bit rd_known;
    bit        st;      bit [31:0] st_addr, st_data; bit [2:0] st_size; bit st_known;
    bit        ld;      bit [31:0] ld_addr;          bit [2:0] ld_size;
    bit        mapped;                  // RAM(BRAM) 범위 안의 접근인가
    bit        is_branch, taken;
} rv_iss_result_t;

class rv32i_iss extends uvm_object;
    `uvm_object_utils(rv32i_iss)

    bit [31:0] imem[RV_ROM_WORDS];
    bit [31:0] x[32];
    bit        xv[32];
    bit [31:0] mem[int unsigned];
    bit [3:0]  memv[int unsigned];
    bit [31:0] pc;
    string     warns[$];

    function new(string name = "rv32i_iss"); super.new(name); endfunction

    function void reset();
        pc = 0;
        foreach (x[i]) begin x[i] = 0; xv[i] = (i == 0); end
        mem.delete();
        memv.delete();
        warns.delete();
    endfunction

    function void warn(string s); warns.push_back($sformatf("pc=%08h: %s", pc, s)); endfunction

    function bit map_idx(bit [31:0] addr, output int unsigned idx);
        idx = 0;
        if (addr[31:28] != 4'h1) begin
            warn($sformatf("RAM 영역 밖 접근 %08h (주변장치/미할당 주소)", addr));
            return 0;
        end
        idx = (addr & 32'h0FFF_FFFF) >> 2;
        if (idx >= RV_BRAM_WORDS) begin
            warn($sformatf("구현된 BRAM(512B) 범위 밖 접근 %08h (메모리맵 64KB 와 불일치)", addr));
            return 0;
        end
        return 1;
    endfunction

    function void do_store(bit [31:0] addr, bit [31:0] data, bit [2:0] size, bit known);
        int unsigned i;
        bit [31:0] w;
        bit [3:0]  v;
        bit [1:0]  off = addr[1:0];
        if (!map_idx(addr, i)) return;
        w = mem.exists(i)  ? mem[i]  : 32'h0;
        v = memv.exists(i) ? memv[i] : 4'h0;
        case (size)
            3'd0: begin
                w[off*8 +: 8] = data[7:0];
                v[off] = known;
            end
            3'd1: begin
                if (off == 2'd1 || off == 2'd3) begin
                    warn($sformatf("비정렬 SH %08h (RTL: 쓰기 없음)", addr));
                    return;
                end
                w[off*8 +: 16] = data[15:0];
                v[off]   = known;
                v[off+1] = known;
            end
            default: begin
                if (off != 0) warn($sformatf("비정렬 SW %08h (RTL: 하위 2비트 무시)", addr));
                w = data;
                v = known ? 4'hF : 4'h0;
            end
        endcase
        mem[i]  = w;
        memv[i] = v;
    endfunction

    function bit [31:0] do_load(bit [31:0] addr, bit [2:0] f3, output bit known);
        int unsigned i;
        bit [31:0] w;
        bit [3:0]  v;
        bit [1:0]  off = addr[1:0];
        known = 0;
        if (!map_idx(addr, i)) return 32'h0;
        w = mem.exists(i)  ? mem[i]  : 32'h0;
        v = memv.exists(i) ? memv[i] : 4'h0;
        case (f3)
            3'd0: begin known = v[off]; return {{24{w[off*8+7]}}, w[off*8 +: 8]}; end   // LB
            3'd4: begin known = v[off]; return {24'h0, w[off*8 +: 8]};             end   // LBU
            3'd1, 3'd5: begin                                                            // LH / LHU
                if (off == 2'd1 || off == 2'd3) begin
                    warn($sformatf("비정렬 LH %08h (RTL: 0 반환)", addr));
                    known = 1;
                    return 32'h0;
                end
                known = v[off] & v[off+1];
                return (f3 == 3'd1) ? {{16{w[off*8+15]}}, w[off*8 +: 16]} : {16'h0, w[off*8 +: 16]};
            end
            default: begin                                                               // LW
                if (off != 0) warn($sformatf("비정렬 LW %08h (RTL: 하위 2비트 무시)", addr));
                known = &v;
                return w;
            end
        endcase
    endfunction

    function bit [31:0] alu(bit [3:0] fn, bit [31:0] a, bit [31:0] b);
        case (fn)
            4'b0_000: return a + b;
            4'b1_000: return a - b;
            4'b0_001: return a << b[4:0];
            4'b0_010: return ($signed(a) < $signed(b)) ? 32'd1 : 32'd0;
            4'b0_011: return (a < b) ? 32'd1 : 32'd0;
            4'b0_100: return a ^ b;
            4'b0_101: return a >> b[4:0];
            4'b1_101: return $signed(a) >>> b[4:0];
            4'b0_110: return a | b;
            4'b0_111: return a & b;
            default:  return 32'h0;
        endcase
    endfunction

    // 명령어 1개 실행
    function rv_iss_result_t step();
        rv_iss_result_t r;
        bit [31:0] ins = imem[pc[8:2]];
        bit [6:0]  op  = ins[6:0];
        bit [4:0]  rd  = ins[11:7];
        bit [2:0]  f3  = ins[14:12];
        bit [4:0]  rs1 = ins[19:15];
        bit [4:0]  rs2 = ins[24:20];
        bit [31:0] a   = x[rs1];
        bit [31:0] b   = x[rs2];
        bit        av  = xv[rs1];
        bit        bv  = xv[rs2];
        bit [31:0] imm_i = {{20{ins[31]}}, ins[31:20]};
        bit [31:0] imm_s = {{20{ins[31]}}, ins[31:25], ins[11:7]};
        bit [31:0] imm_b = {{19{ins[31]}}, ins[31], ins[7], ins[30:25], ins[11:8], 1'b0};
        bit [31:0] imm_u = {ins[31:12], 12'h0};
        bit [31:0] imm_j = {{11{ins[31]}}, ins[31], ins[19:12], ins[20], ins[30:21], 1'b0};
        bit        wr = 0;
        bit [31:0] wv;
        bit        wk;
        bit        lk;

        r.pc = pc; r.instr = ins; r.mnem = rv_decode(ins);
        r.rs1_val = a; r.rs2_val = b; r.rs1_known = av; r.rs2_known = bv;
        r.mapped = 1;
        r.next_pc = pc + 4;

        case (op)
            7'b0110011: begin wr = 1; wv = alu({ins[30], f3}, a, b); wk = av & bv; end
            7'b0010011: begin
                wr = 1; wk = av; r.imm = imm_i;
                wv = alu((f3 == 3'b101) ? {ins[30], f3} : {1'b0, f3}, a, imm_i);
            end
            7'b0110111: begin wr = 1; wv = imm_u;      wk = 1; r.imm = imm_u; end
            7'b0010111: begin wr = 1; wv = pc + imm_u; wk = 1; r.imm = imm_u; end
            7'b1101111: begin
                wr = 1; wv = pc + 4; wk = 1; r.imm = imm_j;
                r.next_pc = pc + imm_j;
            end
            7'b1100111: begin
                wr = 1; wv = pc + 4; wk = 1; r.imm = imm_i;
                r.next_pc = (a + imm_i) & 32'hFFFF_FFFE;
                if (!av) warn($sformatf("JALR 기준 레지스터 x%0d 값 미정의", rs1));
            end
            7'b1100011: begin
                r.is_branch = 1; r.imm = imm_b;
                case (f3)
                    3'd0: r.taken = (a == b);
                    3'd1: r.taken = (a != b);
                    3'd4: r.taken = ($signed(a) <  $signed(b));
                    3'd5: r.taken = ($signed(a) >= $signed(b));
                    3'd6: r.taken = (a <  b);
                    3'd7: r.taken = (a >= b);
                    default: r.taken = 0;
                endcase
                if (!(av && bv)) warn("분기 비교 레지스터 값 미정의");
                if (r.taken) r.next_pc = pc + imm_b;
            end
            7'b0000011: begin
                r.ld = 1; r.ld_addr = a + imm_i; r.ld_size = f3; r.imm = imm_i;
                r.mapped = (r.ld_addr[31:28] == 4'h1) && (((r.ld_addr & 32'h0FFF_FFFF) >> 2) < RV_BRAM_WORDS);
                wr = 1; wv = do_load(r.ld_addr, f3, lk); wk = lk & av;
            end
            7'b0100011: begin
                r.st = 1; r.st_addr = a + imm_s; r.st_data = b; r.st_size = f3; r.st_known = bv & av; r.imm = imm_s;
                r.mapped = (r.st_addr[31:28] == 4'h1) && (((r.st_addr & 32'h0FFF_FFFF) >> 2) < RV_BRAM_WORDS);
                do_store(r.st_addr, b, f3, bv & av);
            end
            default: warn($sformatf("미정의 opcode %08h", ins));
        endcase

        if (wr) begin
            r.rd_we = (rd != 0); r.rd = rd; r.rd_val = wv; r.rd_known = wk;
            if (rd != 0) begin x[rd] = wv; xv[rd] = wk; end
        end
        pc = r.next_pc;
        return r;
    endfunction
endclass
