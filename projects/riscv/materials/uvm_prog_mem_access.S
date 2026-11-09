# mem_access.S - Load/Store 크기·오프셋·부호/제로 확장 SW 시나리오 (APB → BRAM 경로)
# 검증 포인트: SB 4개 바이트 레인, SH 상/하위 하프워드, LB/LBU/LH/LHU 확장, 음수 오프셋,
#             store 직후 load(같은 주소), SH/SB 가 상위 비트를 무시하는지
.equ BUF, 0x10000000
.equ OUT, 0x10000040

        li   s0, BUF
        li   s1, OUT
        li   t0, 0x80FF7F01
        sw   t0, 0(s0)          # BUF[0] = 0x80FF7F01

        lb   a0, 0(s0)          # 0x01        -> 0x00000001
        lb   a1, 1(s0)          # 0x7F        -> 0x0000007F
        lb   a2, 2(s0)          # 0xFF        -> 0xFFFFFFFF
        lb   a3, 3(s0)          # 0x80        -> 0xFFFFFF80
        lbu  a4, 3(s0)          # 0x80        -> 0x00000080
        lbu  a5, 2(s0)          # 0xFF        -> 0x000000FF
        lh   a6, 0(s0)          # 0x7F01      -> 0x00007F01
        lh   a7, 2(s0)          # 0x80FF      -> 0xFFFF80FF
        lhu  t1, 2(s0)          # 0x80FF      -> 0x000080FF
        sw   a0, 0(s1)
        sw   a1, 4(s1)
        sw   a2, 8(s1)
        sw   a3, 12(s1)
        sw   a4, 16(s1)
        sw   a5, 20(s1)
        sw   a6, 24(s1)
        sw   a7, 28(s1)
        sw   t1, 32(s1)

        sw   x0, 4(s0)          # SB 4개 레인으로 워드 조립
        li   t2, 0x111
        sb   t2, 4(s0)          # 상위 비트(0x100) 무시 -> 0x11
        li   t2, 0x22
        sb   t2, 5(s0)
        li   t2, 0x33
        sb   t2, 6(s0)
        li   t2, 0x44
        sb   t2, 7(s0)          # BUF[1] = 0x44332211
        lw   s2, 4(s0)          # store 직후 load

        sw   x0, 8(s0)
        li   t3, 0x1234BEEF
        sh   t3, 8(s0)          # 하위 하프워드 0xBEEF 만
        li   t3, 0xCAFE
        sh   t3, 10(s0)         # BUF[2] = 0xCAFEBEEF
        lhu  s3, 10(s0)         # 0x0000CAFE
        lh   s4, 8(s0)          # 0xFFFFBEEF

        li   t4, -1
        sw   t4, 12(s0)
        li   t5, 0x12345678
        sh   t5, 12(s0)         # 0xFFFF5678
        sb   t5, 14(s0)         # 0xFF785678

        addi s5, s0, 32
        sw   t0, -16(s5)        # 음수 오프셋 -> BUF[4] = 0x80FF7F01
        lw   s6, -16(s5)
        sw   s2, 36(s1)
        sw   s3, 40(s1)
        sw   s4, 44(s1)
        halt

# EXPECT mem 0x10000000 0x80FF7F01
# EXPECT mem 0x10000004 0x44332211
# EXPECT mem 0x10000008 0xCAFEBEEF
# EXPECT mem 0x1000000C 0xFF785678
# EXPECT mem 0x10000010 0x80FF7F01
# EXPECT mem 0x10000040 0x00000001
# EXPECT mem 0x10000044 0x0000007F
# EXPECT mem 0x10000048 0xFFFFFFFF
# EXPECT mem 0x1000004C 0xFFFFFF80
# EXPECT mem 0x10000050 0x00000080
# EXPECT mem 0x10000054 0x000000FF
# EXPECT mem 0x10000058 0x00007F01
# EXPECT mem 0x1000005C 0xFFFF80FF
# EXPECT mem 0x10000060 0x000080FF
# EXPECT mem 0x10000064 0x44332211
# EXPECT mem 0x10000068 0x0000CAFE
# EXPECT mem 0x1000006C 0xFFFFBEEF
# EXPECT x22 0x80FF7F01
