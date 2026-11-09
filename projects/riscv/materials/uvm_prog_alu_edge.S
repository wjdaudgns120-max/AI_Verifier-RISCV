# alu_edge.S - ALU 경계값 / 부호 / 시프트 / x0 쓰기 SW 시나리오
# 검증 포인트: 오버플로 wrap-around, SLT vs SLTU 부호 경계, SRA 부호 유지,
#             레지스터 시프트 양의 하위 5비트 사용, I-type 즉시값 부호 확장, x0 쓰기 무시
.equ SIG, 0x10000000            # 결과 저장 영역 (BRAM word 0~)

        li   s0, SIG
        li   t0, 0x7FFFFFFF     # INT_MAX
        li   t1, 0x80000000     # INT_MIN
        li   t2, -1
        li   t3, 1

        add  a0, t0, t3         # INT_MAX + 1 -> 0x80000000 (wrap)
        sw   a0, 0(s0)
        sub  a1, t1, t3         # INT_MIN - 1 -> 0x7FFFFFFF (wrap)
        sw   a1, 4(s0)
        slt  a2, t1, t0         # signed   MIN < MAX -> 1
        sltu a3, t1, t0         # unsigned 0x80000000 < 0x7FFFFFFF -> 0
        slt  a4, t2, t3         # -1 < 1 -> 1
        sltu a5, t2, t3         # 0xFFFFFFFF < 1 -> 0
        sw   a2, 8(s0)
        sw   a3, 12(s0)
        sw   a4, 16(s0)
        sw   a5, 20(s0)

        li   t4, 31
        sra  a6, t1, t4         # MIN >>> 31 -> 0xFFFFFFFF (부호 유지)
        srl  a7, t1, t4         # MIN >> 31  -> 1
        li   t5, 33             # 시프트 양 33 -> 하위 5비트 = 1
        sll  s1, t3, t5         # 1 << 1 -> 2
        sw   a6, 24(s0)
        sw   a7, 28(s0)
        sw   s1, 32(s0)

        srai s2, t1, 4          # 0xF8000000
        srli s3, t1, 4          # 0x08000000
        slli s4, t2, 31         # 0x80000000
        slli s5, t3, 0          # shamt 0 -> 1
        sw   s2, 36(s0)
        sw   s3, 40(s0)
        sw   s4, 44(s0)
        sw   s5, 48(s0)

        xori s6, t2, -1         # ~(-1) -> 0
        ori  s7, x0, -2048      # 즉시값 최소(-2048) 부호 확장 -> 0xFFFFF800
        andi s8, t2, 2047       # 즉시값 최대(2047) -> 0x7FF
        slti s9, t1, 0          # MIN < 0 -> 1
        sltiu s10, t3, -1       # 1 <u 0xFFFFFFFF -> 1 (즉시값 부호 확장 후 unsigned 비교)
        sltiu s11, t2, 1        # 0xFFFFFFFF <u 1 -> 0
        sw   s6, 52(s0)
        sw   s7, 56(s0)
        sw   s8, 60(s0)
        sw   s9, 64(s0)
        sw   s10, 68(s0)
        sw   s11, 72(s0)

        xor  t6, t0, t1         # 0xFFFFFFFF
        and  a0, t0, t1         # 0
        or   a1, t0, t1         # 0xFFFFFFFF
        sw   t6, 76(s0)
        sw   a0, 80(s0)
        sw   a1, 84(s0)

        addi x0, x0, 5          # x0 쓰기 -> 무시되어야 함
        add  x0, t0, t0
        lui  x0, 0x12345
        add  a2, x0, x0         # 0
        sw   a2, 88(s0)
        sw   x0, 92(s0)
        sub  a3, x0, t3         # 0 - 1 -> 0xFFFFFFFF
        sw   a3, 96(s0)
        halt

# EXPECT mem 0x10000000 0x80000000
# EXPECT mem 0x10000004 0x7FFFFFFF
# EXPECT mem 0x10000008 1
# EXPECT mem 0x1000000C 0
# EXPECT mem 0x10000010 1
# EXPECT mem 0x10000014 0
# EXPECT mem 0x10000018 0xFFFFFFFF
# EXPECT mem 0x1000001C 1
# EXPECT mem 0x10000020 2
# EXPECT mem 0x10000024 0xF8000000
# EXPECT mem 0x10000028 0x08000000
# EXPECT mem 0x1000002C 0x80000000
# EXPECT mem 0x10000030 1
# EXPECT mem 0x10000034 0
# EXPECT mem 0x10000038 0xFFFFF800
# EXPECT mem 0x1000003C 0x7FF
# EXPECT mem 0x10000040 1
# EXPECT mem 0x10000044 1
# EXPECT mem 0x10000048 0
# EXPECT mem 0x1000004C 0xFFFFFFFF
# EXPECT mem 0x10000050 0
# EXPECT mem 0x10000054 0xFFFFFFFF
# EXPECT mem 0x10000058 0
# EXPECT mem 0x1000005C 0
# EXPECT mem 0x10000060 0xFFFFFFFF
