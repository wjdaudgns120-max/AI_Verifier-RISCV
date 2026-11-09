# unmapped_access.S - [음성(negative) 시나리오] 메모리맵에 없는 주소 접근
# 0x3000_0000 은 address_decoder 의 어떤 PSEL 에도 해당하지 않음.
# 기대(설계 의도): 버스 오류 응답 또는 무시 후 다음 명령어 진행 -> a0 = 1 로 정상 종료.
# 현 RTL 예상 동작: PSEL 없음 -> apb_mux 기본값 ready = PREADY0 = 0 -> CPU 가 MEM 상태에서 영구 대기(hang).
# 이 테스트는 그 결함을 드러내기 위한 것으로, 현 RTL 에서는 watchdog timeout 으로 FAIL 이 정상이다.

        li   t0, 0x30000000
        li   t1, 0xA5
        sw   t1, 0(t0)
        li   a0, 1
        halt

# EXPECT x10 1
