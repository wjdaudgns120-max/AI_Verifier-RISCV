# branch_jump.S - 분기 6종(taken/not-taken, signed/unsigned 경계) + JAL/JALR/AUIPC/LUI
# s1 = 올바른 경로 통과 수, s2 = 오류 수 (0 이어야 함)
.equ SIG, 0x10000000

        li   s1, 0
        li   s2, 0
        li   t0, -1
        li   t1, 1
        li   a6, 0x7FFFFFFF
        li   a7, 0x80000000

# ---- taken 케이스: 분기 안 하면 s2 증가 ----
        beq  t1, t1, T1
        addi s2, s2, 1
T1:     addi s1, s1, 1
        bne  t0, t1, T2
        addi s2, s2, 1
T2:     addi s1, s1, 1
        blt  t0, t1, T3         # signed -1 < 1
        addi s2, s2, 1
T3:     addi s1, s1, 1
        bge  t1, t0, T4         # signed 1 >= -1
        addi s2, s2, 1
T4:     addi s1, s1, 1
        bge  t1, t1, T5         # 같은 값 -> taken
        addi s2, s2, 1
T5:     addi s1, s1, 1
        bltu t1, t0, T6         # unsigned 1 < 0xFFFFFFFF
        addi s2, s2, 1
T6:     addi s1, s1, 1
        bgeu t0, t1, T7         # unsigned 0xFFFFFFFF >= 1
        addi s2, s2, 1
T7:     addi s1, s1, 1
        bgeu t1, t1, T8         # 같은 값 -> taken
        addi s2, s2, 1
T8:     addi s1, s1, 1
        blt  a7, a6, T9         # signed MIN < MAX
        addi s2, s2, 1
T9:     addi s1, s1, 1
        bltu a6, a7, T10        # unsigned 0x7FFFFFFF < 0x80000000
        addi s2, s2, 1
T10:    addi s1, s1, 1

# ---- not-taken 케이스: 분기하면 E 로 가서 s2 증가 ----
        beq  t0, t1, E
        bne  t1, t1, E
        blt  t1, t0, E          # signed 1 < -1 거짓
        bge  t0, t1, E          # signed -1 >= 1 거짓
        bltu t0, t1, E          # unsigned 0xFFFFFFFF < 1 거짓
        bgeu t1, t0, E          # unsigned 1 >= 0xFFFFFFFF 거짓
        blt  a6, a7, E          # signed MAX < MIN 거짓
        addi s1, s1, 1          # not-taken 7건 통과
        j    LOOP0
E:      addi s2, s2, 1

# ---- backward 분기 루프 ----
LOOP0:  li   t3, 3
        li   t4, 0
LOOP:   addi t4, t4, 1
        addi t3, t3, -1
        bnez t3, LOOP           # 3회 반복 -> t4 = 3

# ---- JAL 링크 값 ----
        jal  ra, FUNC
RET1:   la   t5, RET1
        beq  s3, t5, J1
        addi s2, s2, 1
J1:
# ---- JALR: 홀수 타깃 LSB 클리어, rd == rs1 ----
        la   t6, TGT
        addi t6, t6, 1          # 홀수 주소
        jalr ra, 0(t6)          # -> TGT (LSB 클리어), ra = 복귀 주소
RET2:   la   t5, RET2
        beq  s4, t5, J2
        addi s2, s2, 1
J2:     la   a0, TGT2
        jalr a0, 0(a0)          # rd == rs1: 이전 a0 로 점프, a0 = 복귀 주소
RET3:   la   t5, RET3
        beq  a0, t5, J3
        addi s2, s2, 1
# ---- AUIPC / LUI ----
J3:
AUI:    auipc a1, 0             # a1 = AUI 주소
        auipc a2, 1             # a2 = (AUI+4) + 0x1000
        la   t5, AUI
        beq  a1, t5, J4
        addi s2, s2, 1
J4:     addi t5, t5, 4
        li   t3, 0x1000
        add  t5, t5, t3
        beq  a2, t5, J5
        addi s2, s2, 1
J5:     lui  a3, 0xFFFFF        # 0xFFFFF000
        li   t3, SIG
        sw   s1, 0(t3)
        sw   s2, 4(t3)
        sw   t4, 8(t3)
        sw   a3, 12(t3)
        halt

FUNC:   mv   s3, ra
        ret
TGT:    mv   s4, ra
        jalr x0, 0(ra)
TGT2:   jalr x0, 0(a0)          # a0 = RET3

# EXPECT x9 11
# EXPECT x18 0
# EXPECT x29 3
# EXPECT x13 0xFFFFF000
# EXPECT mem 0x10000000 11
# EXPECT mem 0x10000004 0
