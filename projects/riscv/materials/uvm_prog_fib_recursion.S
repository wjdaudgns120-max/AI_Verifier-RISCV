# fib_recursion.S - 재귀 함수 호출 SW 시나리오 (C: int fib(int n){ return n<2 ? n : fib(n-1)+fib(n-2); })
# 검증 포인트: 깊은 스택 프레임 push/pop, ra/s0/s1 저장·복원, JAL/JALR 중첩 복귀, sp 최종 복원
.equ STACK_TOP, 0x10000200
.equ SIG, 0x10000000

        li   sp, STACK_TOP
        li   s0, 0              # callee-saved 초기화 (미초기화 레지스터 저장 방지)
        li   s1, 0
        li   s2, 0              # fib 호출 횟수
        li   a0, 7
        call fib
        li   t0, SIG
        sw   a0, 0(t0)          # fib(7) = 13
        sw   s2, 4(t0)          # 호출 횟수 41
        sw   sp, 8(t0)          # sp 복원 확인
        halt

fib:    addi s2, s2, 1
        li   t0, 2
        blt  a0, t0, fib_ret    # n < 2 -> n
        addi sp, sp, -12
        sw   ra, 8(sp)
        sw   s0, 4(sp)
        sw   s1, 0(sp)
        mv   s0, a0
        addi a0, s0, -1
        call fib                # fib(n-1)
        mv   s1, a0
        addi a0, s0, -2
        call fib                # fib(n-2)
        add  a0, s1, a0
        lw   s1, 0(sp)
        lw   s0, 4(sp)
        lw   ra, 8(sp)
        addi sp, sp, 12
fib_ret: ret

# EXPECT x10 13
# EXPECT x2 0x10000200
# EXPECT x8 0
# EXPECT x9 0
# EXPECT mem 0x10000000 13
# EXPECT mem 0x10000004 41
# EXPECT mem 0x10000008 0x10000200
