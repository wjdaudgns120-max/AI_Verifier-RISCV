# bubble_sort.S - C 프로그램 형태 SW 시나리오 (signed 정렬 + 합계)
#   int a[8] = {5, -3, 100, 0, -100, 7, INT_MAX, -1};
#   for (i = 7; i > 0; i--) for (j = 0; j < i; j++) if (a[j+1] < a[j]) swap;
#   sum = a[0] + ... + a[7];      // INT_MAX + 8 -> wrap 0x80000007
# 검증 포인트: 중첩 루프, 메모리 swap(LW/SW 연속), signed 비교 분기, 오버플로 합
.equ ARR, 0x10000080
.equ N, 8

        li   s0, ARR
        li   t0, 5
        sw   t0, 0(s0)
        li   t0, -3
        sw   t0, 4(s0)
        li   t0, 100
        sw   t0, 8(s0)
        sw   x0, 12(s0)
        li   t0, -100
        sw   t0, 16(s0)
        li   t0, 7
        sw   t0, 20(s0)
        li   t0, 0x7FFFFFFF
        sw   t0, 24(s0)
        li   t0, -1
        sw   t0, 28(s0)

        li   s1, 7              # i = N-1
outer:  li   t1, 0              # j = 0
        mv   t2, s0             # p = &a[0]
inner:  lw   t3, 0(t2)          # a[j]
        lw   t4, 4(t2)          # a[j+1]
        bge  t4, t3, noswap
        sw   t4, 0(t2)
        sw   t3, 4(t2)
noswap: addi t2, t2, 4
        addi t1, t1, 1
        blt  t1, s1, inner
        addi s1, s1, -1
        bgtz s1, outer

        li   a0, 0
        mv   t2, s0
        li   t1, N
sum:    lw   t3, 0(t2)
        add  a0, a0, t3
        addi t2, t2, 4
        addi t1, t1, -1
        bnez t1, sum
        sw   a0, 32(s0)
        halt

# EXPECT mem 0x10000080 -100
# EXPECT mem 0x10000084 -3
# EXPECT mem 0x10000088 -1
# EXPECT mem 0x1000008C 0
# EXPECT mem 0x10000090 5
# EXPECT mem 0x10000094 7
# EXPECT mem 0x10000098 100
# EXPECT mem 0x1000009C 0x7FFFFFFF
# EXPECT mem 0x100000A0 0x80000007
# EXPECT x10 0x80000007
