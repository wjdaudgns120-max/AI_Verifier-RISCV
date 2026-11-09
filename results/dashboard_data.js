// evaluator.py 가 자동 생성. 직접 수정하지 마세요.
window.EVAL_DATA = {
 "ondevice": {
  "project_id": "ondevice",
  "project_name": "YOLO26s 교육장 출입 인원 관리 시스템",
  "dashboard_title": "On-Device AI Architecture Evaluation",
  "team": "6조",
  "evaluator_type": "design",
  "role": {
   "member": "정명훈",
   "title": "추론 알고리즘 구축",
   "summary": "Raspberry Pi 4대 분산 추론 파이프라인(master/worker/masker), 모델 경량화, ByteTrack 기반 출입 판정 구현."
  },
  "model": "Claude (claude-opus-5-5)",
  "evaluated_at": "2026-10-20 17:21:24",
  "run_id": "20261020_172124",
  "final_score": 71,
  "criteria_average": [
   {
    "id": 1,
    "name": "컴포넌트 모듈화 및 결합도",
    "score": 77,
    "per_session": [
     76,
     80,
     76
    ]
   },
   {
    "id": 2,
    "name": "경량화 설계 및 목표 성능 근거",
    "score": 69,
    "per_session": [
     70,
     70,
     68
    ]
   },
   {
    "id": 3,
    "name": "분산 아키텍처 확장성",
    "score": 74,
    "per_session": [
     73,
     76,
     73
    ]
   },
   {
    "id": 4,
    "name": "추적·출입 판정 알고리즘 정합성",
    "score": 72,
    "per_session": [
     72,
     73,
     72
    ]
   },
   {
    "id": 5,
    "name": "예외 처리 및 운영 안정성",
    "score": 60,
    "per_session": [
     60,
     60,
     61
    ]
   }
  ],
  "sessions": [
   {
    "id": 1,
    "label": "1차 (모델)",
    "focus": "모델·경량화 설계 관점: 모델 선택, imgsz, NCNN, FP16, 스레드 설정 결정의 근거와 목표 FPS 달성을 중심으로 검토하라.",
    "score": 70,
    "pretrain_summary": "## 1. 프로젝트 개요\n- Raspberry Pi 5(GPU/NPU 미사용) 4대에서 yolo26s-seg(NCNN, FP16, imgsz 320)로 사람을 검출·추적해 교육장 출입 인원을 세는 On-Device AI 시스템(6조).\n- 문 쪽 A구역과 실내 B구역 사이의 전이(A→B는 IN, B 출신이 A에서 2.5초 사라지면 OUT)로 인원을 판정하고, 웹페이지(app.py, 포트 8000)에서 모니터링한다.\n- 목표: 2명 이상 동시 출입 누락 없음, FPS 12 이상(근거: 달리기 12 m/s 가정 시 1m 이상 이동 정보 손실 방지, 슬라이드 5).\n\n## 2. 핵심 아키텍처/구성 요소\n- door_master.py: 웹캠 640x480 캡처(최신 1장 보관) → JPEG Q80 → ack 기반 pull 방식으로 작업자 2대에 분배. RUN_ID로 재시작 식별.\n- door_worker.py(x2): NCNN FP16 추론(conf 0.20, IOU 0.60, classes=[0]), 폴리곤 단순화(approxPolyDP) 후 마스커로 직접 전송, 마스터에 ack. 마스커 재연결 2초 주기.\n- door_masker.py: 프레임 번호 재정렬(REORDER_TIMEOUT 0.6s), BYTETracker, A/B 구역 판정(경계 띠, LINK_GUARD, BIRTH_BAND, 마스크 가림), 그리기, X11 출력, 웹 연동 파일/제어 포트 6200, door_total.json 영속화.\n- 통신은 TCP 고정 헤더(struct \"!IIdI\", \"!IIf\", \"!IIdfII\")로 각 파일 머리말에 명세되어 있다.\n- 실측: master CPU 1~2%, worker 45~55%, masker+app 4~5%(슬라이드 31~33). 모델 메타데이터는 imgsz 320, quantize 16.\n\n## 3. 평가 대상자 R&R과 책임 범위\n- 정명훈: 추론 알고리즘 구축 및 실행 파일(.py) 제작. master/worker/masker 분산 파이프라인, 모델 선택·경량화, ByteTrack 추적과 IN/OUT 판정.\n- 실행 파일의 안정성까지 책임지며, app.py(웹)는 평가 범위에서 제외된다.\n\n## 4. 설계 관점 중점 사항\n- 모델·imgsz·NCNN·FP16·스레드 결정이 Pi 실측 정량 비교로 뒷받침되는지, FPS 12 목표의 근거 타당성과 종단 FPS 실측 여부.\n- 노드 역할 분리, 프로토콜 명세, 설정 집중도, 파일 내부 단일 책임 여부.\n- pull 부하 분산, 재정렬, 최신 프레임 우선 처리의 실시간성, 작업자 추가 시 변경 범위, 마스커 단일 병목.\n- 판정 로직(ByteTrack 임계값과 conf의 관계, 히스테리시스, 출신 승계, LOST_SEC)과 IOU 0.75→0.6 조정 근거, 카운트 정확도 검증 데이터.\n- 연결 끊김·재연결, 카메라 프레임 정지 대비(보고서의 Future work), 인원 영속화, 종료 처리.\n",
    "criteria": [
     {
      "id": 1,
      "name": "컴포넌트 모듈화 및 결합도",
      "score": 76,
      "evidence": [
       "door_master.py / door_worker.py / door_masker.py 머리말에 4대 구성과 역할(분배/추론/판정·출력)이 명시되어 있고, 마스터는 추론 결과를 받지 않고 작업자가 마스커로 직접 전송하는 구조라 노드 간 결합도가 낮다.",
       "통신 프로토콜이 struct로 명세화됨: HDR_TO_WORKER/HDR_FROM_MASTER '!IIdI', ACK '!IIf', HDR_TO_MASKER/HDR '!IIdfII'이고 세 파일의 정의가 서로 일치한다. 제어 포트 JSON 명령도 door_masker.py 주석에 명세되어 있다.",
       "각 파일 상단에 '설정' 블록(WORKERS, JPEG_QUALITY, IMGSZ/CONF/IOU, REORDER_TIMEOUT, TRACK_ARGS, 구역 비율 등)이 모여 있고, door_masker.py는 수신/제어/판정/그리기/처리 루프/화면 출력이 번호가 매겨진 섹션으로 나뉘어 있다."
      ],
      "weaknesses": [
       "공통 모듈이 없어 recv_exact와 헤더 struct 정의가 3개 파일에 중복 정의되어 있다. 프로토콜을 바꾸면 세 파일을 동시에 고쳐야 한다.",
       "노드 주소가 각 파일에 하드코딩되어 분산되어 있다(door_master.py WORKERS, door_worker.py MASKER, app.py PI_HOST). README에서도 vim으로 직접 수정하도록 안내하며, 공용 설정 파일이나 CLI 인자가 없다.",
       "door_masker.py는 전역 상태(total, origin_of, zone_of, tracker 등)에 의존하는 단일 대형 파일이고, judge() 하나에 추적, 가림 승계, 출신 판정, IN 카운트가 몰려 있어 단일 책임 분리와 테스트 용이성이 낮다."
      ],
      "rationale": "노드 역할 분리와 프로토콜 명세는 명확하지만, 공통 코드와 설정이 중복·분산되어 있고 마스커 내부가 전역 상태 기반이라 일부 보완이 필요하다."
     },
     {
      "id": 2,
      "name": "경량화 설계 및 목표 성능 근거",
      "score": 70,
      "evidence": [
       "슬라이드 16~18에서 단계별 정량 비교를 제시: imgsz 640→320 추론 701.0→225.1ms, pt→NCNN 213.5→66.1ms, FP32→FP16 크기 41.7→21.0MB(mAP Box 0.4835/0.4836, Mask 0.357 유지). model_metadata.yaml의 imgsz [320,320], quantize 16과 door_worker.py의 export 명령(half=True imgsz=320)이 최종 설정과 일치한다.",
       "스레드 설계가 코드에 반영됨: door_worker.py는 OMP_WAIT_POLICY=PASSIVE와 TORCH_THREADS=1(NCNN과 코어 경합 방지), door_masker.py는 OMP/BLAS 1스레드와 BUSY_WAIT 비교 스위치, door_master.py는 cv2.setNumThreads(2)를 쓴다. 실측 CPU/RAM은 슬라이드 31~33에 있다.",
       "door_worker.py의 SPIKE_MS=120(평소 60ms대)과 cpu_state()(클럭/온도/throttle)로 추론 지연과 쓰로틀링을 모니터링한다."
      ],
      "weaknesses": [
       "FPS 12 근거(슬라이드 5)가 '달리기 12 m/s'라는 비현실적 가정(보행 약 1.4 m/s, 전력질주도 약 10 m/s)과 임의의 '1m 손실' 기준에 기대고 있다. 정작 종단 FPS 실측값은 보고서에 없고(슬라이드 31~33은 CPU/RAM만), 슬라이드 50의 'FPS 12 이상 확보'는 수치로 입증되지 않았다.",
       "seg 선택(슬라이드 15)의 근거가 Intel Xeon, imgsz 640에서 측정한 수치이고 seg가 36% 더 느림(87.2 vs 118.4ms)에도 Pi에서 비교하지 않았다. 320 축소에 따른 정확도 하락(Box 0.591→0.486, Mask 0.468→0.357, 슬라이드 16)이 카운팅 요구에 미치는 영향도 분석하지 않았다.",
       "슬라이드 13의 'YOLO26n 1대 CPU 과부하'는 정량 데이터가 없고 '보드 3대 분업'이라 적혀 최종 4대 구성과도 불일치한다. FP16은 추론 시간 이득이 없음(67.5 vs 67.8ms)을 밝히지 않았고, NCNN 스레드 수는 명시 설정이 없으며, door_masker.py BUSY_WAIT 실험 결과도 보고되지 않았다."
      ],
      "rationale": "경량화 각 단계는 Pi 정량 비교로 대체로 뒷받침되나, 핵심 목표인 FPS 12의 근거가 약하고 달성 실측이 없으며 seg 선택은 타 플랫폼 데이터에 의존해 부분 충족에 머문다."
     },
     {
      "id": 3,
      "name": "분산 아키텍처 확장성",
      "score": 73,
      "evidence": [
       "door_master.py의 FrameGrabber는 CAP_PROP_BUFFERSIZE=1에 최신 프레임 1장만 보관하고, take_frame()에서 비어 있는 작업자가 최신 프레임을 가져가며 disp_lock으로 같은 프레임을 중복 분배하지 않는다(pull 기반 자동 부하 분산과 백프레셔).",
       "door_masker.py process_loop가 expect 기반으로 재정렬하고, REORDER_TIMEOUT 0.6s 또는 버퍼 30장 초과 시 건너뛴다. RUN_ID 변경을 감지하면 old_runs로 늦게 온 옛 프레임을 버리고 추적을 초기화한다.",
       "작업자 추가는 door_master.py의 WORKERS 리스트에 항목을 추가하는 것으로 충분하다. 마스커는 접속마다 스레드(worker_conn)를 만들어 IP:포트로 구분하고, 판정은 t_cap(마스터 단일 시계) 기준이라 노드 간 시계 차이의 영향을 받지 않는다."
      ],
      "weaknesses": [
       "작업자당 in-flight 프레임이 1장인 stop-and-wait 구조다(sendall → recv ack). 네트워크 왕복과 JPEG 인코딩이 매 프레임 직렬로 더해지는데, 이 오버헤드를 측정하거나 파이프라이닝을 검토하지 않았다.",
       "작업자가 프레임 처리 도중 끊기면 마스커가 REORDER_TIMEOUT 0.6s 동안 다음 번호를 기다리며 출력과 판정이 정지한다(약 7~9프레임분 지연). 작업자 상태를 알면서도 마스터가 이를 마스커에 알려 즉시 건너뛰게 하는 경로가 없다.",
       "마스커(door_masker.py)가 판정, 렌더링, JPEG 재인코딩, 웹 연동을 혼자 맡는 단일 장애점이자 병목이며 이중화가 없다. 작업자는 수신한 JPEG를 마스커로 다시 전송하므로 작업자 수에 비례해 마스커 수신 대역이 늘어나는 점도 확장성 분석에 없다."
      ],
      "rationale": "pull 분배, 최신 프레임 우선, 재정렬과 재시작 감지까지 실시간 분산 설계의 요소는 잘 갖췄으나, 작업자 장애 시 지연, 직렬 ack 오버헤드, 마스커 단일 병목에 대한 정량 분석과 대응이 부족하다."
     },
     {
      "id": 4,
      "name": "추적·출입 판정 알고리즘 정합성",
      "score": 72,
      "evidence": [
       "door_masker.py get_zone()은 BAND(경계 띠) 안에서 이전 구역을 유지하는 히스테리시스를 쓰고, 마스크 무게중심(judge_point, MASK_MIN_FILL 미만이면 박스 중심)으로 판정점을 잡는다.",
       "가림·재등장 대응: occlusion_map()의 마스크 기반 가림자 추적, visible_anchor()를 통한 '가림자 뒤 재등장' 승계, MERGE_DIST 근처 끊김 승계, LINK_GUARD=2와 BIRTH_BAND_RATIO로 출신 오승계를 막는다. LOST_SEC/REAPPEAR_SEC 2.5s는 track_buffer(약 1.8s)보다 길게 잡은 근거가 주석에 있다.",
       "IN은 출신 A인 ID의 A→B 전이 시점에 즉시 세고 출신을 B로 바꿔 중복 IN을 막는다. OUT은 finalize()에서 '출신 B, 마지막 구역 A, 소실'일 때만 세어 통과자(A→A)나 실내 소실(B→B)을 무효 처리한다. NMS IOU 0.75→0.6 조정은 슬라이드 45에 문제/원인/조치/결과로 기록되어 있다."
      ],
      "weaknesses": [
       "TRACK_ARGS의 track_low_thresh=0.1이 검출 CONF=0.20(door_worker.py)보다 낮아, ByteTrack 2차 매칭 대상이 사실상 0.20~0.25 구간뿐이다. 가림 시 저신뢰 박스를 살리는 ByteTrack의 핵심 이점이 상당 부분 사라지는데 이를 인지한 흔적이 없다. TRACK_FPS=30도 실제 처리율(12~16fps)과 달라 칼만/버퍼 시간 해석이 부정확하다.",
       "IOU 0.75→0.6 조정은 정성 서술뿐이다(슬라이드 45). NMS IOU를 낮추면 겹쳐 지나가는 두 사람 중 한 명이 억제될 위험이 커지는데, 이는 '동시 출입 누락 없음' 목표와 상충하며 그 트레이드오프를 검증하지 않았다.",
       "보고서의 OUT 정의(슬라이드 24 'B→A' 또는 '2.5초 미탐지')와 코드가 다르다. 코드에서 B→A 전이는 '[이동]' 로그만 남기고, OUT은 A에서 2.5s 소실 후에만 확정되므로 OUT 반영이 지연되고 A에 머무는 사람은 세지 않는다. 동시 출입 정확도의 정량 검증(시나리오별 정답 대비 카운트)이 없고, door_sim.py는 제출되지 않았다."
      ],
      "rationale": "히스테리시스, 가림 승계, 출신 보완 등 판정 로직은 정교하게 설계되었으나, ByteTrack 임계값과 conf의 불일치, NMS 조정의 트레이드오프 미검증, 정량 정확도 검증 부재로 정합성 입증이 부분적이다."
     },
     {
      "id": 5,
      "name": "예외 처리 및 운영 안정성",
      "score": 60,
      "evidence": [
       "재연결 설계: door_master.py worker_loop는 작업자 연결 실패나 끊김 시 2초 후 재접속하고, door_worker.py MaskerLink는 마스커 단절 중에도 추론과 ack를 계속하며 2초마다 재연결한다. 작업자는 마스터가 끊기면 accept로 복귀한다.",
       "door_masker.py는 RUN_ID로 마스터 재시작을 감지해 추적만 초기화하고 인원 수는 유지한다. door_total.json에 write_atomic(tmp 저장 후 os.replace)으로 total을 영속화하고, 제어 포트에는 timeout(3s), ctrl_done.wait(2), 음수 검증이 있다.",
       "보고서 슬라이드 50, 54가 장기 구동 시 door_master 정지 현상을 한계로 인정하고 재연결 코드, 로그 수집, 24시간 테스트를 Future work로 제시한다."
      ],
      "weaknesses": [
       "보고서에서 확인된 카메라 정지 문제가 코드 수준에서 대비되어 있지 않다. door_master.py FrameGrabber._run은 read 실패 시 5ms 대기 후 무한 재시도만 하고 cap 재오픈, 워치독, 경고가 없다. cap.read()가 블로킹되면 스레드가 영구 정지하고 take_frame()은 0.5s timeout으로 무한 루프만 돈다. 상태 출력에 '카메라 0fps'가 찍혀도 아무 조치가 없다.",
       "예외 범위가 좁다. door_worker.py에서 imdecode가 None을 반환하면 model.predict 예외가 (ConnectionError, OSError) 밖이라 작업자 프로세스 전체가 종료된다. door_masker.py process_loop/judge에서 예외가 나면 데몬 스레드가 조용히 죽고, SHOW=True이면 화면 루프만 살아 있어 장애가 감지되지 않는다(워치독 없음).",
       "파일 로그와 헬스체크가 없다(print만 사용). in_cnt/out_cnt는 영속화되지 않으며, door_master.py 종료 시 cap.release()와 소켓 정리가 없다. 마스커는 프레임 유입 중단(마스터 정지)을 웹/stats에 경보로 알리지 않는다."
      ],
      "rationale": "네트워크 재연결과 인원 영속화는 설계되어 있으나, 보고서가 스스로 지적한 카메라 정지에 대한 코드 대비가 전무하고 처리 스레드의 예외 및 워치독 설계가 없어 운영 안정성에 주요 누락이 있다."
     }
    ],
    "summary": "경량화 비교는 정량적이나 FPS 실측과 장애 대비가 미흡한 설계",
    "improvements": [
     "종단 FPS(마스커 기준)와 프레임별 지연을 Pi에서 실측해 보고하고, FPS 목표 근거를 보행 속도(약 1.5 m/s)와 ByteTrack 매칭 허용 이동량으로 다시 산정할 것",
     "door_master.py FrameGrabber에 '마지막 프레임 시각' 워치독을 두어 N초 무응답 시 cap.release()와 재오픈을 하고, 처리 스레드 예외 포착과 파일 로그, 24시간 구동 테스트를 추가할 것",
     "track_low_thresh를 검출 conf보다 높게 맞추거나(예: 검출 conf 0.1) TRACK_FPS를 실제 처리율에 맞추고, NMS IOU 0.6/0.75와 동시 출입 시나리오별 카운트 정확도를 정량 비교하며, 공통 프로토콜/설정 모듈로 중복을 제거할 것"
    ]
   },
   {
    "id": 2,
    "label": "2차 (분산)",
    "focus": "분산 시스템 설계 관점: 4-보드 역할 분리, 통신 프로토콜, 부하 분산·재정렬·재연결 구조를 중심으로 검토하라.",
    "score": 72,
    "pretrain_summary": "## 사전학습 확인 요약\n\n**1. 프로젝트 개요**\n- YOLO26s-seg 기반으로 교육장 출입 인원(IN/OUT)을 세는 On-Device AI 시스템 (Raspberry Pi 5 4대, CPU 전용)\n- 목표: 2명 이상 동시 출입 시 누락 없는 카운트, 웹페이지 제공, FPS 12 이상 (근거: 12 m/s 이동 가정)\n- 최종 설정: yolo26s-seg, NCNN, FP16, imgsz 320, conf 0.2, IOU 0.6, person class (슬라이드 19, model_metadata.yaml)\n\n**2. 핵심 아키텍처/구성 요소**\n- door_master.py: 웹캠 640x480 캡처, JPEG Q80, 작업자 ack 기반 pull 분배, RUN_ID로 재시작 식별\n- door_worker.py(x2): NCNN FP16 seg 추론, 폴리곤 단순화, 마스커로 직접 전송 후 마스터에 ack, 마스커 2초 재연결\n- door_masker.py: 프레임 번호 재정렬(REORDER_TIMEOUT 0.6s), ByteTrack, A/B 구역 판정(마스크 무게중심, 가림, LINK_GUARD, BIRTH_BAND), X11 출력, 제어 포트 6200\n- 통신: TCP + struct 헤더(!IIdI / !IIf / !IIdfII), 촬영시각(t_cap)을 마스터 기준 시계로 사용\n- app.py(웹, 포트 8000)는 평가 대상자 담당이 아니라 소스가 제외됨\n\n**3. 평가 대상자(정명훈)의 R&R**\n- 추론 알고리즘 구축 및 실행 파일 제작: master/worker/masker 분산 파이프라인, 모델 경량화, 추적 및 IN/OUT 판정\n- 책임 범위: 모델 선택·경량화 결정, 4보드 분산·통신 설계, ByteTrack 판정 로직, 실행 파일 안정성\n\n**4. 설계 관점 중점 사항**\n- 경량화 결정(n/s, seg, imgsz, NCNN, FP16)이 목표 하드웨어 위 정량 비교로 뒷받침되는지, FPS 12 근거와 실측 입증 여부\n- 노드 역할 분리, 프로토콜 명세, 설정 집중도와 결합도\n- pull 부하 분산, 재정렬, 백프레셔, 마스커 단일 노드 병목 등 확장성\n- 동시 출입·가림·재등장·이중 검출에서 판정 정합성(ByteTrack 파라미터와 conf 사이 정합 포함)\n- 연결 끊김/재연결, 카메라 정지(보고서 한계) 대응, 인원 영속화 등 운영 안정성\n",
    "criteria": [
     {
      "id": 1,
      "name": "컴포넌트 모듈화 및 결합도",
      "score": 80,
      "evidence": [
       "door_master.py / door_worker.py / door_masker.py 상단 주석에 4대 역할(캡처·분배 / 추론·윤곽 추출 / 재정렬·추적·판정·출력)이 명시되고, 마스터는 opencv·numpy만 사용해 torch 비의존(door_master.py 주석)",
       "통신 헤더가 파일 주석과 코드에 명세되고 서로 일치함: HDR_TO_WORKER/HDR_FROM_MASTER '!IIdI', ACK '!IIf', HDR_TO_MASKER/HDR '!IIdfII' (door_master.py, door_worker.py, door_masker.py)",
       "작업자가 결과를 마스커로 직접 보내고 마스터에는 ack만 반환해 마스터가 결과 경로에서 분리됨(door_worker.py 주석, 슬라이드 26~29)",
       "설정값이 각 파일 상단 '설정' 블록에 모여 있음(WORKERS, MASKER, IMGSZ/CONF/IOU, TRACK_ARGS, 구역·판정 상수)"
      ],
      "weaknesses": [
       "프로토콜 struct 정의와 recv_exact가 세 파일에 중복 정의되어 공용 모듈이 없음. 헤더에 magic/버전 필드가 없어 한쪽만 바뀌면 조용히 스트림이 어긋남",
       "노드 IP가 WORKERS(door_master.py), MASKER(door_worker.py)에 하드코딩되어 README.md가 vi로 직접 수정하도록 안내함. 설정 파일이나 CLI 인자가 없음",
       "door_masker.py 한 파일이 수신·재정렬·추적·판정·그리기·웹 IPC·X11을 모두 맡고, total/in_cnt/origin_of 등 전역 가변 상태에 의존함(섹션 구분은 되어 있음)"
      ],
      "rationale": "노드 간 역할 분리와 헤더 명세가 명확하고 코드와 일치해 결합도가 낮다. 다만 프로토콜·설정이 파일마다 중복·하드코딩되어 있고 마스커 내부가 단일 책임으로 나뉘지 않아 일부 보완이 필요하다."
     },
     {
      "id": 2,
      "name": "경량화 설계 및 목표 성능 근거",
      "score": 70,
      "evidence": [
       "단계별 정량 비교가 있음: 11n vs 26n(슬라이드 12), imgsz 640 701.0ms vs 320 225.1ms(슬라이드 16), pt 213.5ms vs NCNN 66.1ms(슬라이드 17), FP32 41.7MB vs FP16 21.0MB에 정확도 0.4835/0.4836 유지(슬라이드 18)",
       "최종 설정이 model_metadata.yaml(task: segment, imgsz 320, quantize: 16)과 door_worker.py(IMGSZ=320, CONF=0.20, IOU=0.60, classes=[0])에서 일치함",
       "스레드 설계가 코드로 확인됨: door_worker.py에서 OMP_WAIT_POLICY=PASSIVE, TORCH_THREADS=1, door_master.py에서 OMP 4/cv2 2, door_masker.py에서 BUSY_WAIT 비교 스위치",
       "실측 CPU/RAM 제시: master 1~2%/0.5~0.6GB, worker 45~55%/0.9~1.0GB, masker+app 4~5%/0.8~0.9GB(슬라이드 31~33)"
      ],
      "weaknesses": [
       "FPS 12 근거가 부정확함: 실내 출입 인원의 이동 속도로 12 m/s(세계 기록급 질주 속도)를 가정했고, '프레임당 1m 이동' 기준이 추적 매칭이나 BAND 폭과 연결되어 있지 않음(슬라이드 5)",
       "FPS 12 달성이 실측 수치로 제시되지 않음. 슬라이드 31~33은 CPU/RAM만 보여주고, 약 16fps는 door_masker.py 주석(LOST_SEC)에서만 간접적으로 나옴",
       "n→s 전환(슬라이드 13)과 det vs seg 결정(슬라이드 15, Intel Xeon 측정)이 목표 보드인 Pi 5 위의 정량 비교로 뒷받침되지 않음. 320 전환 시 person Box mAP 0.591→0.486, Mask 0.468→0.357 하락의 영향도 분석되지 않음",
       "NCNN 추론 스레드 수는 명시적으로 설정하지 않았고 worker CPU 45~55%의 여유분을 어떻게 활용할지 근거가 없음"
      ],
      "rationale": "엔진·해상도·정밀도 결정은 실측 표로 잘 뒷받침된다. 그러나 FPS 목표 근거가 물리적으로 부정확하고, 목표 FPS 달성 실측과 모델 크기·task 선택의 타깃 보드 비교가 빠져 있어 부분 충족으로 본다."
     },
     {
      "id": 3,
      "name": "분산 아키텍처 확장성",
      "score": 76,
      "evidence": [
       "pull 기반 분배: door_master.py worker_loop가 ack(recv_exact(ACK)) 이후에만 take_frame()으로 다음 최신 프레임을 가져가고, FrameGrabber는 최신 1장만 보관(CAP_PROP_BUFFERSIZE=1)해 master→worker 구간에 백프레셔와 자동 부하 분산이 있음",
       "door_masker.py process_loop가 expect 번호 기반으로 재정렬하고 REORDER_TIMEOUT=0.6 또는 len(buffer)>30이면 건너뜀. RUN_ID/old_runs로 마스터 재시작 시 번호를 다시 맞춤",
       "판정 시간을 각 Pi의 로컬 시계가 아닌 마스터의 촬영시각 t_cap 기준으로 써서 노드 간 시계 차이를 피함(judge의 now_t = t_cap)",
       "작업자 추가는 WORKERS 리스트에 항목만 더하면 되고 마스커 accept_loop가 연결마다 스레드를 띄워 개수 제한이 없음. X11 출력은 display_loop로 분리되어 판정을 막지 않음"
      ],
      "weaknesses": [
       "worker→masker 구간에는 최신 프레임 우선 처리가 없음: expect가 buffer에 있으면 순서대로 pop만 하므로 마스커가 느려지면 buffer와 지연이 무한정 커짐(len>30 조건은 elif 분기에서만 동작)",
       "process_loop에서 buffer가 비어 있지 않은데 expect가 없으면 wait 없이 루프를 돌아 최대 0.6s 동안 busy-spin함",
       "마스커가 단일 노드(SPOF)이자 수렴점이고, 작업자마다 한 번에 1프레임만 처리하는 stop-and-wait 구조라 JPEG 인코딩·네트워크 시간이 작업자 유휴 시간으로 그대로 남음",
       "작업자가 끊기면 그 프레임마다 마스커가 0.6s 동안 멈췄다가 건너뛰어 실시간성이 일시적으로 떨어짐(door_master.py 끊김 로그 주석)"
      ],
      "rationale": "pull 분배, RUN_ID 기반 재정렬, 마스터 시계 기준 판정은 분산 설계로서 타당하고 작업자 확장도 쉽다. 다만 마스커 단계의 백프레셔·최신 프레임 정책이 없고 단일 마스커 병목이 남아 있다."
     },
     {
      "id": 4,
      "name": "추적·출입 판정 알고리즘 정합성",
      "score": 73,
      "evidence": [
       "get_zone이 ±BAND(BAND_RATIO 0.025) 히스테리시스로 경계 진동을 막고, 출신(origin_of) 기반으로 A출신이 A→B면 IN, B출신이 A에서 LOST_SEC 뒤 사라지면 finalize에서 OUT으로 처리해 이중 카운트를 막음(door_masker.py judge/finalize, 슬라이드 24)",
       "가림·재등장 대응: occlusion_map(마스크 가림 비율), visible_anchor, MERGE_DIST 기반 ID 연결, LINK_GUARD=2, BIRTH_BAND_RATIO 0.05가 각 설계 의도 주석과 함께 구현됨",
       "LOST_SEC/REAPPEAR_SEC 2.5s를 ByteTrack track_buffer 30프레임(약 16fps에서 1.8초)보다 길게 잡은 근거가 코드 주석에 있음",
       "model_metadata.yaml end2end: false로 NMS가 실제로 쓰이므로, IOU 0.75→0.6 조정(슬라이드 45)은 중복 박스 억제 방향으로 맞는 조치임"
      ],
      "weaknesses": [
       "door_worker.py CONF=0.20이 TRACK_ARGS track_low_thresh=0.1보다 높아 ByteTrack 2차(저신뢰) 매칭 범위가 0.20~0.25로 좁아짐. 보고서가 내세운 저신뢰 박스 매칭의 장점(슬라이드 21)이 거의 무력화됨",
       "동시 출입·가림 시나리오에서 카운트 정확도를 정량 검증한 결과(시도 수, 오카운트 수)가 없음. LINK_GUARD 값의 근거인 door_sim.py는 자료에 없어 확인할 수 없음",
       "IOU 0.6 하향은 붙어서 들어오는 2인을 하나로 합칠 위험이 있는데, 동시 출입 목표와의 trade-off나 전후 수치 비교가 없음(슬라이드 45는 정성 서술만)",
       "마스터 재시작 시 reset_tracking이 origin_of/last_seen을 지워 OUT 확정 대기 중인 트랙이 집계되지 않고 사라짐"
      ],
      "rationale": "히스테리시스, 출신 기반 판정, 가림 연결 등 판정 로직은 상황별로 정교하게 설계되었다. 그러나 conf와 ByteTrack 임계값이 서로 맞지 않고 카운트 정합성을 정량 검증하지 않아 일부만 입증된다."
     },
     {
      "id": 5,
      "name": "예외 처리 및 운영 안정성",
      "score": 60,
      "evidence": [
       "재연결이 구현됨: door_master.py worker_loop가 끊기면 2초 뒤 재접속(소켓 timeout 5s), door_worker.py MaskerLink가 2초 간격으로 재연결하고 마스커가 끊겨도 추론을 계속함, 마스터 연결이 끊기면 다시 accept",
       "door_masker.py가 door_total.json을 write_atomic(tmp 파일 후 os.replace)으로 IN/OUT마다 저장하고 재시작 시 불러옴. RUN_ID로 마스터 재시작을 감지함",
       "제어 포트에 3s timeout, ctrl_done.wait(2)가 있고 DISPLAY가 없으면 X11 출력을 자동으로 끔(door_masker.py main)"
      ],
      "weaknesses": [
       "보고서가 밝힌 장기 구동 시 카메라 정지(슬라이드 50, 54)에 대한 코드 대비가 없음: FrameGrabber._run은 read 실패 시 sleep(0.005) 후 무한 재시도할 뿐 VideoCapture를 다시 열지 않고, read가 블록되는 경우를 감시하는 watchdog도 없음. take_frame은 timeout 0.5로 무한히 기다림",
       "시작 시 'while grab.frame is None' 루프가 타임아웃 없이 무한 대기함(door_master.py)",
       "door_worker.py에서 imdecode가 None을 돌려주면 cv2.imwrite나 model.predict 예외가 (ConnectionError, OSError)로 잡히지 않아 작업자 프로세스 전체가 종료됨",
       "door_masker.py worker_conn에 recv timeout이나 keepalive가 없어 half-open 연결이 남을 수 있음. 로그는 stdout에만 출력되고 파일 로그·자동 재시작(systemd 등)이 없음. in_cnt/out_cnt는 영속화되지 않음"
      ],
      "rationale": "네트워크 재연결과 인원 영속화는 잘 설계되었다. 그러나 보고서가 인정한 핵심 장애인 카메라 정지에 대해 감지·재오픈·감시 장치가 전혀 없고 작업자 예외 처리에도 구멍이 있어 주요 누락으로 본다."
     }
    ],
    "summary": "분산 구조·재정렬 설계는 탄탄하나 카메라 장애 대응과 성능 검증이 미흡함",
    "improvements": [
     "FrameGrabber에 프레임 정지 감시(watchdog, 예: N초간 fid 미증가)를 넣고 VideoCapture 재오픈·로그 기록을 추가한 뒤 24시간 구동 시험으로 검증",
     "worker CONF를 track_low_thresh 이하(예: 0.1)로 낮추고 ByteTrack 임계값을 재정렬한 다음, 동시 출입·가림 시나리오별 카운트 정확도를 정량 표로 측정(IOU 0.75 vs 0.6 포함)",
     "프로토콜·설정을 공용 모듈과 설정 파일로 통합(magic/버전 헤더 포함)하고, 마스커 재정렬 버퍼에 최신 프레임 우선 드롭 정책과 조건 대기를 넣으며, 실측 FPS(마스커 fps_now)를 보고서에 수치로 제시"
    ]
   },
   {
    "id": 3,
    "label": "3차 (판정)",
    "focus": "알고리즘 설계 관점: ByteTrack 추적과 IN/OUT 판정 로직의 정합성, 엣지 상황 대응을 중심으로 검토하라.",
    "score": 70,
    "pretrain_summary": "## 1. 프로젝트 개요\n- YOLO26s-seg로 사람을 검출·추적하고 A(문 쪽)→B(실내) 구역 전이로 IN/OUT을 판정해 교육장 인원을 세는 On-Device AI 시스템 (6조).\n- Raspberry Pi 5 4대(GPU/NPU 미사용)로 분산 추론하고, 웹(app.py, 8000번 포트)에서 초기 인원 설정과 모니터링을 한다.\n- 목표: 2명 이상 동시 출입 시 누락 없는 카운트, FPS 12 이상 (근거: 달리기 12 m/s 가정, 슬라이드 5).\n\n## 2. 핵심 아키텍처/구성 요소\n- door_master.py: 웹캠 640×480 → 최신 프레임만 보관 → JPEG Q80 → ack 기반 pull 분배(작업자 2대), RUN_ID/seq 헤더.\n- door_worker.py ×2: NCNN FP16 yolo26s-seg(imgsz 320, conf 0.20, IOU 0.60, class 0) → 박스+단순화 폴리곤을 마스커로 직접 전송, 마스터에 ack, 2초 재연결.\n- door_masker.py: seq 재정렬(REORDER_TIMEOUT 0.6s) → ByteTrack → 마스크 무게중심/가림 기반 A/B 판정(BAND, LINK_GUARD, BIRTH_BAND, LOST_SEC 2.5s) → 렌더링/X11, /tmp 파일 + 제어 포트 6200, door_total.json 영속화.\n- 경량화: 26n→26s(보드 분업), seg, 320, NCNN, FP16, OMP PASSIVE/스레드 제한 (슬라이드 12~19).\n- 실측: master CPU 1~2%, worker 45~55%, masker+app 4~5% (슬라이드 31~33).\n\n## 3. 평가 대상자 R&R과 책임 범위\n- 정명훈: 추론 알고리즘 구축 및 실행 파일(.py) 제작 (이기광과 공동, 슬라이드 7).\n- 책임 범위: 모델 선택·경량화, 4-보드 분산 구조와 통신, ByteTrack 추적·출입 판정 로직, 실행 파일 안정성 (app.py 제외).\n\n## 4. 설계 관점 중점 사항\n- 설계 결정(모델/imgsz/NCNN/FP16/스레드)이 Pi 실측 정량 비교로 뒷받침되는지, FPS 12 근거와 달성 실측이 있는지.\n- master/worker/masker 분리, 프로토콜 헤더 명세 일관성, 설정 집중도와 파일 내부 책임 분리.\n- pull 분배·재정렬·최신 프레임 우선의 실시간성, 노드 추가·장애 시 영향과 마스커 단일 병목.\n- 추적·판정 로직이 동시 출입·가림·재등장·이중 검출에서 정합한지, 파라미터 간 일관성(conf vs track 임계값, track_buffer vs LOST_SEC)과 검증 근거.\n- 재연결·카메라 정지 대비·인원 영속화·종료 처리 등 운영 안정성이 코드에 반영되었는지.\n",
    "criteria": [
     {
      "id": 1,
      "name": "컴포넌트 모듈화 및 결합도",
      "score": 76,
      "evidence": [
       "door_master.py/door_worker.py/door_masker.py 상단 주석에 3역할과 TCP 헤더 형식이 명세되어 있고, struct 정의(HDR_TO_WORKER '!IIdI', ACK '!IIf', HDR_TO_MASKER/HDR '!IIdfII')가 세 파일에서 서로 일치함",
       "door_master.py는 ultralytics/torch 없이 opencv·numpy만 쓰고 결과를 받지 않으며, 작업자가 마스커로 직접 전송함(door_worker.py MaskerLink). 노드 간 결합이 ack 하나로 최소화됨",
       "door_masker.py는 웹 앱과 /tmp/door_frame.jpg, /tmp/door_stats.json, 제어 포트 6200의 JSON 한 줄 프로토콜로만 연결됨(APP_LINK 스위치)"
      ],
      "weaknesses": [
       "IP·포트가 각 파일에 하드코딩(WORKERS, MASKER, PORT)되어 README가 vi로 직접 수정하도록 안내함. 공통 설정 파일이나 CLI 인자가 없음",
       "recv_exact가 세 파일에 중복되어 있고 공통 프로토콜 모듈이 없음. door_worker.py의 counts는 '>u4'(빅엔디언)인데 박스/윤곽 float32는 네이티브 엔디언이라 프로토콜 바이트 순서가 섞여 있음",
       "door_masker.py 한 파일(약 700줄)에 수신·재정렬·추적·판정·그리기·웹 IPC가 전역 변수(total, tracker, origin_of 등)를 공유하며 섞여 있어 단일 책임 분리가 약함"
      ],
      "rationale": "노드 간 역할 분리와 헤더 명세는 코드와 일치해 명확하다. 다만 설정이 흩어져 있고, 마스커 내부가 전역 상태 기반의 단일 파일이라 모듈화가 일부 부족하다."
     },
     {
      "id": 2,
      "name": "경량화 설계 및 목표 성능 근거",
      "score": 68,
      "evidence": [
       "슬라이드 16~18의 단계별 정량 비교: 640→320 추론 701.0→225.1ms, pt→NCNN 213.5→66.1ms, FP32→FP16 41.7→21.0MB(정확도 0.4835/0.4836 유지). 슬라이드 19와 model_metadata.yaml(imgsz 320, quantize 16, task segment), door_worker.py(IMGSZ 320, CONF 0.20, IOU 0.60)가 일치함",
       "door_worker.py는 OMP_WAIT_POLICY=PASSIVE, TORCH_THREADS=1로 NCNN과 코어 경합을 피하고, SPIKE_MS 120과 cpu_state()로 쓰로틀링을 진단함. door_masker.py는 BUSY_WAIT 비교 스위치를 둠",
       "슬라이드 31~33에서 노드별 CPU/RAM 실측(worker 45~55%, master 1~2%, masker+app 4~5%)을 제시함"
      ],
      "weaknesses": [
       "FPS 12 근거(슬라이드 5)의 '달리기 속도 12 m/s'는 사실상 단거리 세계기록 수준이라 실내 출입 상황에 맞지 않음. 또 '1m 정보 소실'과 추적 매칭 성공 조건(프레임 간 IoU) 사이의 연결이 없음",
       "최종 시스템 FPS 실측값이 보고서에 없음. 슬라이드 50의 'FPS 12 이상 확보'는 수치 근거 없이 주장만 있고, 슬라이드 31~33에는 CPU/RAM만 있음",
       "슬라이드 13의 26n→26s 결정에 정량 비교가 없음. 슬라이드 15의 seg 속도는 Intel Xeon·640 기준이라 Pi 결정 근거로 부적합하고, 320 전환에 따른 mAP 하락(Box 0.591→0.486, Mask 0.468→0.357)의 영향 분석도 없음"
      ],
      "rationale": "경량화 각 단계를 정량 비교로 결정한 점은 좋다. 그러나 핵심 목표인 FPS 12의 근거 가정이 비현실적이고, 달성을 입증하는 실측 FPS가 없어 부분 충족이다."
     },
     {
      "id": 3,
      "name": "분산 아키텍처 확장성",
      "score": 73,
      "evidence": [
       "door_master.py의 FrameGrabber는 최신 1장만 보관(CAP_PROP_BUFFERSIZE 1)하고, take_frame()·worker_loop()는 ack를 받은 작업자가 가장 최신 프레임을 가져가는 pull 방식으로 자동 부하 분산과 백프레셔를 구현함",
       "door_masker.py의 process_loop는 seq 기반 재정렬, REORDER_TIMEOUT 0.6s 또는 buffer 30장 초과 시 건너뛰기, RUN_ID 변경 감지(need_reset)로 마스터 재시작에 대응함",
       "작업자 추가는 door_master.py의 WORKERS 목록에 한 줄을 넣으면 되고, 마스커는 연결마다 스레드를 띄워(accept_loop) 코드 변경이 필요 없음"
      ],
      "weaknesses": [
       "작업자마다 처리 중인 프레임이 1장뿐인 stop-and-wait 구조라 인코딩·전송·ack 왕복 시간이 처리량을 직접 깎음. 파이프라이닝이 없음",
       "작업자가 프레임 처리 중에 끊기면 해당 seq가 사라져 마스커 전체가 최대 0.6s 정지함. 판정·JPEG 재인코딩·그리기가 마스커 한 스레드에 몰린 단일 병목임",
       "작업자 1대 vs 2대(N대) FPS 확장 실측이 없고, 슬라이드 26의 'N/2 fps'는 균등 분배를 가정한 것뿐임"
      ],
      "rationale": "pull 분배·최신 프레임 우선·재정렬 설계가 코드로 확인되어 실시간성은 잘 고려되었다. 다만 확장성 실측이 없고, 마스커 단일 노드와 stop-and-wait 구조가 병목으로 남아 있다."
     },
     {
      "id": 4,
      "name": "추적·출입 판정 알고리즘 정합성",
      "score": 72,
      "evidence": [
       "door_masker.py judge(): IN은 prev A→new B이면서 origin_of가 A일 때만 세고 이후 origin을 B로 바꿔 이중 IN을 막음. OUT은 finalize()에서 출신 B·마지막 구역 A로 LOST_SEC/REAPPEAR_SEC 2.5s 동안 사라진 경우에만 확정해 문 앞에서 되돌아오는 경우의 오카운트를 막음",
       "get_zone()은 BAND(±2.5%) 히스테리시스로 경계 진동을 억제함. tracks[:, -1](det_idx)로 마스크를 트랙에 정확히 매핑해 judge_point() 마스크 무게중심과 occlusion_map() 가림 판정에 사용함",
       "가림 후 재등장은 occluder_of/visible_anchor로 출신을 승계하고 MERGE_DIST로 보조함. LINK_GUARD=2와 BIRTH_BAND_RATIO로 잘못된 출신 승계를 제한함. IOU 0.75→0.6 조정(슬라이드 45)이 door_worker.py IOU=0.60에 반영됨"
      ],
      "weaknesses": [
       "door_worker.py CONF=0.20 때문에 0.1~0.2 검출은 아예 전달되지 않아 TRACK_ARGS track_low_thresh=0.1이 무의미함. ByteTrack 2차(저신뢰) 매칭이 0.20~0.25 구간으로만 축소되어, 슬라이드 21에서 강조한 가림 대응 효과가 약해지는 파라미터 불일치가 있음",
       "TRACK_FPS=30이 하드코딩되어 track_buffer가 실제 FPS에 따라 늘어남(12fps에서 2.5s). FPS가 12 미만이면 LOST_SEC 확정 뒤 같은 ID가 되살아나 prev=None 새 트랙으로 처리될 수 있음. MERGE_DIST(화면 폭 19%, 약 120px)가 커서 동시 출입 시 잘못된 ID 출신 승계 위험이 있음",
       "LINK_GUARD 등은 '가상 상황 실험(door_sim.py)'으로 골랐다고 주석에 있으나 해당 자료와 결과가 없음. 동시 출입·가림 시나리오별 카운트 정확도 실측이 없어 슬라이드 6의 '누락 없이 카운트' 주장의 근거가 없음. IOU 조정도 전후 수치가 없음"
      ],
      "rationale": "출신 기반 전이, 지연 OUT 확정, 히스테리시스, 가림 승계 등 엣지 상황을 겨냥한 판정 로직은 정교하고 코드와 정합한다. 다만 검출 conf와 ByteTrack 임계값의 불일치, FPS 의존 파라미터, 정량 검증 부재가 주요 누락이다."
     },
     {
      "id": 5,
      "name": "예외 처리 및 운영 안정성",
      "score": 61,
      "evidence": [
       "재연결이 구현되어 있음: door_master.py worker_loop는 2초마다 재연결하고 send/recv 타임아웃은 5s, door_worker.py MaskerLink는 마스커가 끊겨도 추론을 계속하며 2초마다 재연결, 마스커 측은 작업자 연결마다 스레드와 finally에서 정리함",
       "door_masker.py는 door_total.json에 write_atomic(tmp→os.replace)으로 인원을 영속화해 재시작해도 유지하고, RUN_ID로 마스터 재시작을 감지하며, 제어 포트는 3s 타임아웃과 ctrl_done 2s 대기로 응답함",
       "종료 처리: master는 q 입력/KeyboardInterrupt, masker는 stop_event·finally 로그가 있음. 장기 구동 시 door_master 정지 문제를 슬라이드 50·54에서 스스로 밝힘"
      ],
      "weaknesses": [
       "보고서가 인정한 카메라 정지 문제에 코드 대비가 없음. door_master.py FrameGrabber._run은 read 실패 시 5ms 대기 후 무한 재시도만 하고 VideoCapture 재오픈·워치독·cam_fps 0 감지 후 복구가 없으며, cap.read()가 블로킹되면 스레드가 영구 정지함. cap.release()도 없음",
       "door_worker.py는 ConnectionError/OSError만 잡아 model.predict나 imdecode 실패(None 이미지)로 예외가 나면 프로세스가 종료됨. door_masker.py process_loop에도 예외 처리가 없어 판정 스레드가 죽어도 X11 모드에서는 화면만 남은 채 멈춤",
       "로그가 stdout에만 있어 파일 로그나 헬스체크가 없음. 작업자 연결 끊김으로 프레임이 빠지면 판정이 끊기는데, 이를 상위(웹)에 알리는 상태값은 workers 수뿐임"
      ],
      "rationale": "네트워크 재연결과 인원 영속화는 잘 설계되었다. 그러나 이미 확인된 핵심 장애인 카메라 정지에 대한 코드 대비가 전혀 없고, 처리 스레드 예외 처리도 빠져 있어 주요 누락이 있다."
     }
    ],
    "summary": "판정 로직은 정교하나 정량 검증·카메라 장애 대비 부족",
    "improvements": [
     "동시 출입·가림·재등장·경계 진동 시나리오별로 반복 실측(실제 인원 대비 카운트 오차율)을 수행하고 door_sim.py 결과를 함께 제시해 LINK_GUARD·MERGE_RATIO·IOU 값을 정량 근거로 확정할 것",
     "ByteTrack 파라미터를 검출과 정합시킬 것: 작업자 conf를 track_low_thresh(0.1)까지 낮추고 high/new 임계값으로 거르며, TRACK_FPS를 실측 FPS에 연동해 track_buffer 시간이 LOST_SEC보다 확실히 짧도록 보장",
     "door_master.py에 카메라 워치독을 추가할 것: 일정 시간 새 프레임이 없으면 VideoCapture를 release 후 재오픈하고 실패 시 프로세스를 재시작(systemd Restart=always)하며, 파일 로그와 24시간 구동 테스트로 검증"
    ]
   }
  ]
 },
 "riscv": {
  "project_id": "riscv",
  "project_name": "RV32I Multi-Cycle CPU + APB SoC",
  "dashboard_title": "RISC-V SoC Verification",
  "team": "1조",
  "evaluator_type": "verification",
  "role": {
   "member": "정명훈",
   "title": "CPU SW 검증",
   "summary": "C 코드 → 기계어 → ROM 로드 → CPU·APB·BRAM 경로의 시스템 레벨 동작 검증 주도."
  },
  "model": "Claude (claude-opus-5-5)",
  "evaluated_at": "2026-11-09 15:05:00",
  "run_id": "20261109_150500",
  "final_score": 76,
  "criteria_average": [
   {
    "id": 1,
    "name": "명령어·기능 커버리지 확보",
    "score": 75,
    "per_session": [
     77,
     78,
     71
    ]
   },
   {
    "id": 2,
    "name": "SW 시나리오 기반 시스템 검증",
    "score": 79,
    "per_session": [
     82,
     79,
     75
    ]
   },
   {
    "id": 3,
    "name": "PASS/FAIL 판정 정확성",
    "score": 75,
    "per_session": [
     77,
     75,
     73
    ]
   },
   {
    "id": 4,
    "name": "엣지 케이스 대응 시나리오",
    "score": 77,
    "per_session": [
     80,
     76,
     76
    ]
   },
   {
    "id": 5,
    "name": "버스 프로토콜·통합 안정성",
    "score": 71,
    "per_session": [
     72,
     71,
     69
    ]
   }
  ],
  "sessions": [
   {
    "id": 1,
    "label": "1차 (독립)",
    "focus": "이전·다른 세션의 결과는 알 수 없고 참고하지 않는다. 5개 기준 전체를 동일한 기준과 동일한 자료로 처음부터 독립적으로 채점하라.",
    "score": 78,
    "pretrain_summary": "# 사전학습 정리 (RV32I Multi-Cycle CPU + APB SoC)\n\n1. 프로젝트 개요\n- RV32I 정수 명령어를 FETCH/DECODE/EXECUTE/MEM/WB 5상태 FSM으로 실행하는 Multi-Cycle CPU에 APB 버스와 BRAM을 붙인 교육용 SoC(1조)다.\n- 검증은 명령어 타입별 directed 파형, R/I 타입 UVM(PASS 541,489, coverage 100%), APB 파형, SW(rom_code_ex1: 1~10 누적합, dmem[122]=55) 파형 확인으로 이루어졌다.\n- 보고서 제출 이후 SW 시나리오 UVM 환경(rv32i_uvm_sw, AI 도움, Verilator 실행)을 보완했다. 결과는 6개 프로그램 1,211개 명령어 ISS 비교, 기대값 68/68 일치, 음성 테스트 1개, 변이 테스트 1개다.\n\n2. 핵심 아키텍처/구성 요소\n- control_unit: opcode별 제어 FSM. S/L만 MEM(transfer, ready 대기)으로 가고 L만 WB로 간다. EXECUTE의 case(opcode)에 default가 없다.\n- datapath: reg_file(x0=0, 리셋 없음), DEC/EXE/MEM 단계 레지스터, ALU, imm_extend, PC(U_EXE_PC_NEXT), WB MUX로 구성된다.\n- apb_requester: IDLE에서 주소/데이터를 래치하고 SETUP, ACCESS로 진행한다. address_decoder(PADDR[31:28]로 RAM/주변장치 구분, default 없음)와 apb_mux(기본 PREADY0)를 포함한다.\n- apb_bram: 128워드(512B, 메모리맵 64KB와 불일치), itype 기반 서브워드 R/W, PREADY=PSEL&PENABLE(wait state 없음), 비선택 시 PRDATA='z. GPI/GPO RTL은 제출되지 않았다.\n- UVM SW 환경: ROM 백도어 driver, DECODE 경계 커밋 monitor(#1step), SV ISS 참조 모델, lock-step 및 최종 상태/.exp를 비교하는 scoreboard, 6종 covergroup으로 구성된다.\n\n3. 평가 대상자 R&R\n- 정명훈: CPU SW 검증. C 코드부터 기계어, ROM, CPU, APB, BRAM까지 시스템 레벨 경로를 검증한다.\n- 책임 범위: 시나리오 설계, 기대값 정의, PASS 판정, SW 경로에서 발견되는 CPU/버스 결함 식별. 보고서 이후 보완한 UVM SW 환경도 산출물에 포함한다.\n\n4. 검증 관점 중점 사항\n- 커버리지: 명령어 37종과 경계값/시프트/오프셋 달성률, 팀 UVM cross 설계(레지스터 인덱스 기준)의 타당성.\n- 판정 신뢰성: 원본 tb_rv32i.sv는 파형 육안 판정뿐이다. 새 환경은 ISS 비교가 자동이지만 Verilator 2-state, RTL을 흉내 낸 참조 모델 등의 한계가 있다.\n- 엣지 케이스: x0, 부호 확장, SLT/SLTU, JALR LSB, 서브워드 처리는 다뤘다. 미정의 opcode, 비정렬 접근, 리셋, BRAM 범위 밖 접근이 남은 빈틈이다.\n- 버스: 미할당 주소 hang을 재현했지만 수정하지 않았다. wait state, back-to-back 전송, PSEL1~6 경로, APB 프로토콜 assertion이 없다.\n- 보고서 수치/코드의 불일치(slide 03 sp=512 코드와 실제 ROM이 다름 등)와 '로그로 입증된 범위만 인정' 원칙을 적용한다.\n",
    "criteria": [
     {
      "id": 1,
      "name": "명령어·기능 커버리지 확보",
      "score": 77,
      "evidence": [
       "uvm_log_rv_regression_test.log: 명령어 37종 100%, 분기×taken/not-taken 100%, Load/Store×오프셋 95.00%, ALU 피연산자 경계값 83.93%, 시프트 양 84.72%, 기타 코너 100%",
       "uvm_rv_coverage.svh: cg_instr/cg_branch/cg_mem/cg_alu/cg_shift/cg_misc 6종 covergroup으로 S/L/B/U/J까지 덮어 팀 UVM(R/I 19개)의 범위 밖을 보완",
       "final_report_team1.txt 05장: R/I 타입 UVM은 R 10×1024(rs1×rs2), I 6×4096(imm), I-shift 3×32 cross, coverage 100%",
       "rom_code_ex1_disasm.txt: 보고서 시점 SW 검증 프로그램은 LUI/ADDI/SW/LW/JAL/JALR/BGE/ADD 8종만 사용"
      ],
      "weaknesses": [
       "ALU 경계값 83.93%, 시프트 양 84.72%, Load/Store 오프셋 95%로 구멍이 남았는데 이를 채우는 시나리오를 추가하지 않음(uvm_README.md '남은 구멍은 새 .S 시나리오를 추가해서 채우면 됩니다')",
       "팀 UVM cross가 피연산자 값이 아닌 레지스터 인덱스(rs1×rs2) 기준이라 값 공간을 덮지 못함. 보고서 08장 고찰에서도 스스로 인정",
       "SW 시나리오는 모두 directed .S이고 무작위 프로그램 생성(constrained random instruction stream)이 없어 명령어 조합 공간이 제한적",
       "보고서 제출 시점 평가 대상자의 SW 검증은 단일 프로그램(8개 명령어)뿐이었고, 37종 커버리지는 사후 보완 결과"
      ],
      "rationale": "사후 보완한 UVM SW 환경이 명령어 37종과 분기 방향을 100% 덮고 팀 UVM의 S/L/B/U/J 공백을 메운 점은 로그로 입증된다. 그러나 경계값/시프트 커버리지가 85% 수준에서 마감되지 않았고, 커버리지 설계가 directed 위주이며 레지스터 인덱스 기준이라 75~89 구간 하단으로 판단했다.",
      "score_breakdown": [
       {
        "item": "ALU 경계값 83.93%, 시프트 84.72%, LS 오프셋 95% 미달 상태로 커버리지 closure 미완 (uvm_log_rv_regression_test.log)",
        "points": -6
       },
       {
        "item": "팀 UVM cross가 레지스터 인덱스 기준이고 R/I 타입만 대상이라 피연산자 값 공간 미측정 (final_report 05장, 08장 고찰)",
        "points": -5
       },
       {
        "item": "SW 시나리오가 directed 6개뿐이고 무작위 명령어 스트림 없음 (uvm_rv_env_seq_test.svh)",
        "points": -5
       },
       {
        "item": "보고서 시점 SW 검증은 8개 명령어를 쓰는 단일 프로그램에 그침. 37종 커버리지는 사후 보완 (rom_code_ex1_disasm.txt, pretrain 4장)",
        "points": -4
       },
       {
        "item": "미정의 opcode/비정렬 접근을 커버리지 모델에서 제외 (uvm_rv_coverage.svh ignore_bins, cg_instr illegal_bins)",
        "points": -3
       }
      ]
     },
     {
      "id": 2,
      "name": "SW 시나리오 기반 시스템 검증",
      "score": 82,
      "evidence": [
       "rom_code_ex1_disasm.txt / rom_code_ex1.mem: C 코드에서 복원한 기계어로 스택 프레임, add 함수 호출/복귀(jal/jalr), BGE 루프, while(1) 정지를 포함하고 기대값 dmem[122]=55, dmem[123]=10을 사전 정의",
       "final_report_team1.txt 07장: Jump/BGE/a++/Result(dmem[122]=55)/Loop(PC=0x4C 고정)를 파형으로 확인",
       "uvm_log_rv_regression_test.log: sum_loop, alu_edge, branch_jump, mem_access, fib_recursion, bubble_sort 6개 모두 PASS, 기대값 68/68, 명령어 1,211개 lock-step 비교",
       "uvm_prog_fib_recursion.S: 재귀 fib(7), ra/s0/s1 저장·복원, sp 최종 복원(0x10000200)과 호출 횟수 41까지 기대값으로 확인"
      ],
      "weaknesses": [
       "보고서 시점 SW 검증은 tb_rv32i.sv(15,000ns 실행 후 $finish, 체크 코드 없음)와 단일 프로그램의 파형 육안 확인뿐",
       "C 컴파일 경로를 실제로 거친 것은 팀 원본 sum_loop뿐이고, 추가 시나리오는 손으로 쓴 .S(C 형태 주석)라 컴파일러 산출 코드 패턴 검증이 제한적",
       "GPI/GPO 등 주변장치 MMIO 접근은 SW 시나리오에 없음. 제출 RTL(rv32i_top)에도 BRAM만 연결",
       "sum_loop에서 미초기화 ra/s0를 스택에 저장하는 X_STORE 경고 2건을 경고로만 처리하고 테스트 프로그램을 보정하지 않음"
      ],
      "rationale": "함수 호출, 스택, 분기, 루프 종료를 포함한 실제 프로그램을 사전 기대값과 대조하는 end-to-end 검증이 사후 UVM 환경에서 6개 프로그램으로 자동 입증되었다. 다만 보고서 시점 산출물은 파형 육안 판정 단일 시나리오였고, 컴파일 경로와 주변장치 경로가 빠져 80점대 초반으로 판단했다.",
      "score_breakdown": [
       {
        "item": "보고서 시점 SW 검증이 tb_rv32i.sv 단일 프로그램 파형 판정에 그침. 자동화는 사후 보완 (tb_rv32i.sv, final_report 07장)",
        "points": -5
       },
       {
        "item": "C→기계어 컴파일 경로는 sum_loop 1건뿐이고 나머지는 수작성 어셈블리 (uvm_prog_*.S, uvm_README.md)",
        "points": -5
       },
       {
        "item": "주변장치(GPI/GPO) MMIO 경로가 SW 시나리오와 RTL에서 빠짐 (rv32i_top.sv, pretrain 2-3)",
        "points": -3
       },
       {
        "item": "보고서 slide 03 스택 코드와 ROM 불일치, slide 06 PADDR 환산 오류 (final_report_team1.txt, rom_code_ex1.mem)",
        "points": -3
       },
       {
        "item": "sum_loop의 미초기화 레지스터 저장(X_STORE 2건)을 방치 (uvm_log_rv_regression_test.log)",
        "points": -2
       }
      ]
     },
     {
      "id": 3,
      "name": "PASS/FAIL 판정 정확성",
      "score": 77,
      "evidence": [
       "uvm_rv_scoreboard.svh: 명령어마다 PC, rd 대상/값, store PADDR/PWDATA/크기, load 주소를 ISS와 lock-step 비교하고, 종료 시 레지스터 31개, BRAM, .exp를 비교",
       "uvm_rv_probe_if.sv: mon_cb가 #1step 입력 샘플링으로 posedge 직전 값을 잡아 race를 방지",
       "uvm_log_mutant_sltu_regression.log: SLTU를 signed로 바꾼 변이 RTL에서 RD_VALUE/ST_DATA/FINAL_REG/FINAL_MEM/EXPECT 19 errors 검출",
       "final_report_team1.txt 08장: 모니터 샘플링 타이밍 문제로 FAIL 332,527 발생, 수정 후 FAIL 0"
      ],
      "weaknesses": [
       "Verilator(2-state)로만 실행하고 VCS에서는 실행하지 않음. poison_state()의 'x가 0으로 바뀌어 DUT 쪽 X 전파 검사($isunknown)가 무력화되고, apb_bram도 'z→0으로 수정한 파일(uvm_apb_bram_verilator.sv)로 돌림",
       "rv32i_iss.svh 메모리 모델이 RTL 구현(512B, 비정렬 SH 쓰기 없음, 비정렬 LH 0 반환)을 그대로 따라 해서, 스펙 대비 오류는 common-mode로 검출되지 않을 수 있음",
       "scoreboard가 사이클 수 불일치(n_lat_mismatch)를 세기만 하고 보고하거나 판정에 쓰지 않음",
       "변이 테스트가 SLTU 1건뿐이라 환경의 결함 검출력 입증이 제한적"
      ],
      "rationale": "ISS 참조 모델과 lock-step scoreboard, #1step 샘플링, 변이 검출로 자동 판정의 신뢰성이 로그로 입증된다. 그러나 2-state 시뮬레이터에서 수정된 RTL로만 실행했고, 참조 모델이 RTL 동작을 모사하며, 팀 UVM의 원인 분석과 수정이 우회적이어서 상당한 보완이 필요하다.",
      "score_breakdown": [
       {
        "item": "Verilator 2-state 단독 실행으로 X-poisoning 무력화, 수정된 apb_bram으로 회귀 수행, VCS 미실행 (uvm_README.md, uvm_apb_bram_verilator.sv)",
        "points": -6
       },
       {
        "item": "ISS 메모리 모델이 RTL의 512B/비정렬 동작을 모사해 common-mode 위험 (uvm_rv32i_iss.svh do_store/do_load)",
        "points": -4
       },
       {
        "item": "원본 SW 판정이 파형 육안 확인뿐이고 정량적 자동 기준 없음 (tb_rv32i.sv, final_report 07장)",
        "points": -4
       },
       {
        "item": "팀 UVM 트러블슈팅이 #1 지연 우회 방식이라 근본 원인 분석이 피상적이고, PASS 개수 일치에 의존 (final_report 05·08장)",
        "points": -4
       },
       {
        "item": "사이클 수 불일치(n_lat_mismatch)를 판정·보고에 쓰지 않음 (uvm_rv_scoreboard.svh)",
        "points": -3
       },
       {
        "item": "변이 테스트 1건(SLTU)뿐 (uvm_log_mutant_sltu_regression.log)",
        "points": -2
       }
      ]
     },
     {
      "id": 4,
      "name": "엣지 케이스 대응 시나리오",
      "score": 80,
      "evidence": [
       "uvm_prog_alu_edge.S: INT_MAX+1/INT_MIN-1 wrap, SLT/SLTU 부호 경계, SRA/SRAI 부호 유지, 시프트 양 33→하위 5비트, 즉시값 -2048/2047 부호 확장, x0 쓰기 무시 등 25개 기대값 PASS",
       "uvm_prog_branch_jump.S: 분기 6종 taken/not-taken(signed/unsigned 경계), backward 루프, JALR 홀수 타깃 LSB 클리어, rd==rs1, AUIPC/LUI 6개 기대값 PASS",
       "uvm_prog_mem_access.S: SB 4레인, SH 상/하위, LB/LBU/LH/LHU 부호/제로 확장, 음수 오프셋, store 직후 load 18개 PASS",
       "uvm_rv_agent.svh rv_monitor: FSM_STUCK(EXECUTE 64사이클) 검출기 구현"
      ],
      "weaknesses": [
       "control_unit.sv EXECUTE의 case(opcode)에 default가 없어 미정의 opcode이면 n_state=c_state로 EXECUTE에 영구 정지함. FSM_STUCK 검출기는 있으나 이를 노리는 음성 시나리오가 없어 결함이 미검증으로 남음",
       "비정렬 LH/LHU/SH/LW는 ISS에서 'RTL 동작'으로 정의하고 커버리지에서 제외해 시나리오로 다루지 않음",
       "reg_file은 rst_n을 쓰지 않아 리셋이 없음. 2-state 실행 탓에 미초기화 값 영향이 드러나지 않고, 동작 중 리셋 시나리오도 없음",
       "apb_bram은 128워드(512B)인데 메모리맵은 64KB임. 0x1000_0200 이상 접근(dmem 인덱스 128 이상)은 ISS 경고만 있고 시나리오가 없음"
      ],
      "rationale": "사전학습에 열거된 RV32I 코너 케이스 대부분을 기대값이 있는 시나리오로 다뤄 PASS시켰다. 그러나 미정의 opcode로 인한 FSM hang, 리셋, 비정렬 접근, BRAM 용량 경계가 시나리오에서 빠져 RTL 결함이 미검증으로 남았다.",
      "score_breakdown": [
       {
        "item": "control_unit EXECUTE case(opcode) default 부재로 미정의 opcode 시 FSM 정지. 시나리오 미작성 (control_unit.sv)",
        "points": -6
       },
       {
        "item": "reg_file 리셋 없음, 동작 중 리셋 미검증, 2-state로 미초기화 영향 은폐 (datapath.sv reg_file, uvm_README.md)",
        "points": -4
       },
       {
        "item": "BRAM 512B 대 메모리맵 64KB 경계 밖 접근 시나리오 없음 (apb_bram.sv dmem[0:127], uvm_rv32i_iss.svh map_idx)",
        "points": -4
       },
       {
        "item": "비정렬 Load/Store를 시나리오와 커버리지에서 제외 (uvm_rv_coverage.svh ignore_bins, uvm_rv32i_iss.svh)",
        "points": -3
       },
       {
        "item": "ALU 경계값 cross 83.93% 미달 (uvm_log_rv_regression_test.log)",
        "points": -3
       }
      ]
     },
     {
      "id": 5,
      "name": "버스 프로토콜·통합 안정성",
      "score": 72,
      "evidence": [
       "final_report_team1.txt 06장: STATE 순서(PSEL0→PENABLE→ready), Address Decode, Address/Data HOLD, BRAM R/W 파형 확인(김태수 담당)",
       "uvm_log_rv_unmapped_test.log: 0x3000_0000 store 시 BUS_HANG(MEM 상태 64사이클 ready 없음)과 KNOWN_BUG로 address_decoder default 부재 결함 재현",
       "uvm_rv_scoreboard.svh: 모든 store/load의 PADDR({4'b0000, addr[27:0]})·PWDATA·itype을 APB 완료 시점(PSEL0&PENABLE&PREADY0)에서 ISS와 비교",
       "uvm_rv_agent.svh: MEM 상태 ready 대기 hang 검출기 구현"
      ],
      "weaknesses": [
       "address_decoder.sv 미할당 주소 결함을 재현만 하고 수정하거나 에러 응답(PSLVERR)을 추가하지 않음. apb_mux 기본값 ready=PREADY0=0으로 CPU가 MEM에서 영구 정지하는 결함이 RTL에 남음",
       "apb_bram PREADY=PSEL&PENABLE 고정이라 wait state(PREADY 지연) 상황을 한 번도 검증하지 않음. CPU MEM과 ready 핸드셰이크의 지연 내성이 미입증",
       "APB 프로토콜 assertion(SVA: SETUP→ACCESS 순서, PADDR/PWDATA hold, 단일 PSEL)이 없음. 프로토콜 확인은 보고서 파형 캡처뿐",
       "주변장치 PSEL1~6 경로가 미통합(GPI/GPO RTL 미제출, rv32i_top은 BRAM만 연결)이고 monitor도 PSEL0만 관측"
      ],
      "rationale": "음성 시나리오로 미할당 주소 hang 결함을 자동 재현하고 모든 APB 전송의 주소/데이터를 비교한 점은 의미 있다. 그러나 결함이 수정되지 않았고 wait state, 프로토콜 assertion, 주변장치 통합이 빠져 통합 안정성 입증은 부분 충족에 머문다.",
      "score_breakdown": [
       {
        "item": "미할당 주소 hang 결함을 재현만 하고 미수정, PSLVERR/에러 응답 없음 (apb_requester.sv address_decoder, uvm_log_rv_unmapped_test.log)",
        "points": -6
       },
       {
        "item": "PREADY wait state 미검증, BRAM PREADY 고정 (apb_bram.sv)",
        "points": -6
       },
       {
        "item": "APB 프로토콜 SVA 부재, 순서/hold 확인은 파형뿐 (final_report 06장, uvm_rv_probe_if.sv)",
        "points": -5
       },
       {
        "item": "PSEL1~6 주변장치 경로 미통합, monitor PSEL0만 관측 (rv32i_top.sv, uvm_rv_agent.svh)",
        "points": -5
       },
       {
        "item": "back-to-back/전송 중 리셋 미검증, PRDATA 'z 처리를 툴별 우회 (apb_bram.sv, uvm_apb_bram_verilator.sv)",
        "points": -6
       }
      ]
     }
    ],
    "summary": "ISS 기반 자동 판정으로 SW 검증은 탄탄하나 버스 결함 미해결",
    "improvements": [
     "address_decoder에 default 에러 슬레이브(PREADY=1, PSLVERR=1)를 추가하고 control_unit EXECUTE에 미정의 opcode default 처리를 넣은 뒤, rv_unmapped_test와 미정의 opcode 음성 시나리오를 PASS로 전환",
     "VCS 등 4-state 시뮬레이터에서 원본 RTL로 회귀를 재실행해 X 전파를 검사하고, 무작위 PREADY 지연을 넣는 BRAM 모델과 APB SVA(순서/hold/단일 PSEL)를 추가",
     "ALU 경계값·시프트·비정렬/BRAM 경계 시나리오와 무작위 명령어 스트림을 추가해 커버리지를 100%로 마감하고, 변이 테스트를 여러 결함 유형으로 확대"
    ]
   },
   {
    "id": 2,
    "label": "2차 (독립)",
    "focus": "이전·다른 세션의 결과는 알 수 없고 참고하지 않는다. 5개 기준 전체를 동일한 기준과 동일한 자료로 처음부터 독립적으로 채점하라.",
    "score": 76,
    "pretrain_summary": "1. 프로젝트 개요\n- RV32I Multi-Cycle CPU(FETCH→DECODE→EXECUTE→MEM→WB 5상태 FSM)와 APB 버스, BRAM을 묶은 교육용 SoC 프로젝트다(1조, final_report_team1.txt).\n- 검증은 명령어 타입별 directed 파형, R/I 19개 명령어 UVM(PASS 541,489, coverage 100%), rom_code_ex1(1~10 누적합) SW 파형 검증으로 이루어졌다.\n- 보고서 이후 UVM SW 시나리오 환경(rv32i_uvm_sw, Verilator 5.053)을 추가했다: 7개 시나리오, ISS lock-step 비교, 기대값 68/68, 음성/변이 테스트 포함.\n\n2. 핵심 아키텍처/구성 요소\n- control_unit: opcode별 EXECUTE 제어. S/L만 MEM(transfer=1, ready 대기)을 거치고 L은 WB까지 간다. EXECUTE case에 default가 없다.\n- datapath: x0 하드와이어 reg_file(리셋 없음), DEC/EXE/MEM 단계 레지스터, ALU, imm_extend, PC(branch/jal/jalr, JALR LSB 클리어), WB MUX.\n- apb_requester: IDLE에서 주소/데이터를 래치하는 IDLE/SETUP/ACCESS FSM. address_decoder(PADDR[31:28], [11:8])는 미할당 주소 default가 없고, apb_mux가 PRDATA/PREADY를 고른다.\n- apb_bram: 128워드(512B, 메모리맵 64KB와 다름). SB/SH/SW, LB/LH/LW/LBU/LHU를 처리하고 PREADY=PSEL&PENABLE이라 wait state가 없다. 비정렬 SH는 쓰지 않고 LH는 0을 반환한다. 비선택 시 PRDATA='z.\n- rv32i_top에는 BRAM만 연결되어 있다. PREADY1~6/PRDATA1~6은 구동하는 곳이 없고 GPI/GPO RTL은 제출되지 않았다. 추가 UVM 환경: driver(ROM 백도어), monitor(#1step, BUS_HANG/FSM_STUCK), ISS, scoreboard, coverage.\n\n3. 평가 대상자의 역할(R&R)과 책임 범위\n- 정명훈: CPU SW 검증. C 코드 → 기계어 → ROM → CPU/APB/BRAM 경로의 시스템 레벨 동작을 검증하는 역할이다.\n- 책임 범위: SW 시나리오 설계, 기대값 정의, PASS 판정, SW 경로에서 드러나는 CPU/버스 결함 식별. 보고서 이후 보완된 UVM SW 환경도 산출물에 포함하되, 로그로 입증된 범위만 인정한다.\n\n4. 검증 관점 중점 사항\n- 커버리지: 37개 명령어/분기/LS 오프셋은 100·100·95%이고 ALU 경계 83.93%, 시프트 84.72%로 남은 구멍이 있다. 보고서 UVM의 rs1×rs2는 값이 아닌 인덱스 기반이다.\n- 판정 신뢰성: 원본 tb_rv32i.sv는 육안 파형 판정에 고정 15,000ns였다. ISS가 RTL 동작에 맞춘 참조 모델이라는 점, Verilator 2-state에서 X 초기화가 약해지는 점, 332,527 FAIL 원인 분석의 타당성을 본다.\n- 엣지/결함: 디코더 default 부재(미정의 opcode 시 EXECUTE 정지), 비정렬 접근 무시, 512B 밖 RAM 주소, 리셋 중 동작이 시나리오로 다뤄졌는지 본다.\n- 버스: PREADY wait state가 한 번도 실행되지 않았는지, APB 프로토콜 자동 체커가 있는지, 미할당/주변장치 영역 접근 hang(PSLVERR 없음)을 확인한다.\n- 평가 대상자 범위(SW 경로) 비중을 높이고, 범위 밖(파이프라인 해저드, 양산 기능)은 감점하지 않는다.\n",
    "criteria": [
     {
      "id": 1,
      "name": "명령어·기능 커버리지 확보",
      "score": 78,
      "evidence": [
       "uvm_log_rv_regression_test.log: 명령어(37종) 100.00%, 분기 x taken/not-taken 100.00%, Load/Store x 오프셋 95.00%, ALU 피연산자 경계값 83.93%, 시프트 양 84.72%, 기타 코너 100.00%",
       "uvm_rv_coverage.svh: cg_instr(37 bins), cg_branch(6종 x taken cross), cg_mem(종류 x 바이트 오프셋 cross), cg_alu, cg_shift, cg_misc(x0/JALR 홀수/latency)로 S/L/B/U/J까지 덮는 커버리지 모델",
       "final_report_team1.txt 05. UVM Verification Coverage 슬라이드: R x rs1 x rs2 = 10 x 1024, I x imm = 6 x 4096, I shift x imm = 3 x 32, 100% 달성(R/I 19개 명령어)",
       "uvm_prog_*.S 6개 정상 시나리오가 UVM 범위 밖이던 S/L/B/U/J 타입(LB~LHU, SB/SH, BLTU/BGEU, AUIPC, JALR)을 보완"
      ],
      "weaknesses": [
       "ALU 경계값 83.93%, 시프트 양 84.72%, Load/Store 오프셋 95%가 미달인데 구멍을 메우는 시나리오를 추가하지 않음(uvm_README.md '새 .S 시나리오를 추가해서 채우면 됩니다')",
       "uvm_rv_coverage.svh cg_alu: rs1 값 분류만 cross하고 cp_rs2는 cross에 넣지 않음, 대상도 8개 연산뿐이며 분기 오프셋 부호, imm 범위, rd에 대한 coverpoint가 없음",
       "보고서 UVM 커버리지(05. Coverage)의 rs1 x rs2는 레지스터 인덱스 조합(0~31)이지 피연산자 값 공간이 아님(보고서 08. 고찰 (3)에서 자인)",
       "원본 SW 검증(rom_code_ex1.mem)은 LUI/ADDI/SW/LW/JAL/JALR/BGE/ADD 8종뿐이고 보고서 시점에는 커버리지를 측정하지 않음"
      ],
      "rationale": "보완 UVM 환경에서 37개 명령어와 분기 방향을 100% 덮어 타입 커버리지는 충족했다. 하지만 피연산자 경계, 시프트, 오프셋 커버리지를 마무리하지 않았고 cross 설계(rs2·분기 오프셋 누락, 보고서의 인덱스 기반 cross)에 한계가 있다.",
      "score_breakdown": [
       {
        "item": "ALU 경계값 83.93%/시프트 84.72%/LS 오프셋 95% 미달 상태로 마감 (uvm_log_rv_regression_test.log)",
        "points": -6
       },
       {
        "item": "cg_alu에 rs2 cross 없음, 분기 오프셋 부호·imm·rd coverpoint 부재 (uvm_rv_coverage.svh)",
        "points": -5
       },
       {
        "item": "보고서 UVM cross가 레지스터 인덱스 기반이라 값 공간 커버리지가 아님 (final_report 05. Coverage, 08. 고찰)",
        "points": -4
       },
       {
        "item": "보고서 시점 SW 검증은 8종 명령어, 커버리지 미측정 (rom_code_ex1_disasm.txt, final_report 07)",
        "points": -3
       },
       {
        "item": "미정의 opcode 미검증, 단일 툴·단일 회귀 결과만 존재 (uvm_rv_coverage.svh, uvm_README.md)",
        "points": -4
       }
      ]
     },
     {
      "id": 2,
      "name": "SW 시나리오 기반 시스템 검증",
      "score": 79,
      "evidence": [
       "rom_code_ex1_disasm.txt: 기대값 dmem[122]=55, dmem[123]=10, PC 0x4C 정지를 사전 정의. uvm_prog_sum_loop.exp(M 100001e8 37, M 100001ec 0a)로 자동 대조",
       "final_report_team1.txt 07. SW Verification: Jump/Bge/a++/Result(Dmem[122]=55)/Loop(PC=4C 고정) 5개 항목 시나리오와 신호 정의, 파형 확인",
       "uvm_log_rv_regression_test.log: sum_loop, alu_edge, branch_jump, mem_access, fib_recursion, bubble_sort 6개 프로그램 PASS, 명령어 1,211개 lock-step 비교, 기대값 68/68, err 0",
       "uvm_prog_fib_recursion.S(재귀, 스택 push/pop, ra/s0/s1 복원, sp 최종 복원 확인), uvm_prog_bubble_sort.S(중첩 루프, 메모리 swap, signed 정렬)로 실제 프로그램 패턴 확장"
      ],
      "weaknesses": [
       "보고서 시점 tb_rv32i.sv는 리셋 해제 후 #15000에 $finish만 하며 판정 로직, halt 감지, 기대값 비교가 전혀 없음(파형 육안 판정)",
       "'C 코드 → 컴파일' 단계의 근거가 없음: rom_code_ex1의 C 코드는 기계어에서 복원한 것(원본 C 파일 아님)이고 추가 시나리오 6개는 모두 어셈블리(.S)임",
       "보고서 03. Memory Map Stack Point 슬라이드의 코드(0x00 20000113 addi sp, zero, 512)가 제출된 rom_code_ex1.mem(0x00 lui sp,0x10000)과 다름. 슬라이드 코드라면 sp=0x200이 미할당 영역이 됨",
       "SW 경로가 BRAM에만 한정됨: rv32i_top에 GPI/GPO가 연결되지 않아 주변장치 MMIO를 거치는 SW 시나리오가 없음"
      ],
      "rationale": "기대값을 사전에 정의하고, 함수 호출·스택·루프·재귀를 포함한 다수 SW 프로그램을 ISS와 비교해 end-to-end로 자동 입증한 점은 평가 대상자 책임 범위에서 가장 강한 성과다. 다만 C 컴파일 흐름의 근거가 없고, 원본 검증은 육안 판정이었으며, 주변장치 경로가 빠져 있고, 원본 RTL로는 실행하지 않았다.",
      "score_breakdown": [
       {
        "item": "원본 tb_rv32i.sv에 자동 판정·halt 감지 없음, 고정 15,000ns 실행 (tb_rv32i.sv)",
        "points": -5
       },
       {
        "item": "C 소스 → 컴파일 단계 근거 부재, 추가 시나리오는 어셈블리 (rom_code_ex1_disasm.txt, uvm_prog_*.S)",
        "points": -5
       },
       {
        "item": "보고서 스택 예시 코드와 제출 기계어 불일치 (final_report 03. Memory Map vs rom_code_ex1.mem)",
        "points": -3
       },
       {
        "item": "GPI/GPO 등 주변장치 경로 SW 시나리오 없음 (rv32i_top.sv, uvm_README.md)",
        "points": -4
       },
       {
        "item": "자동 판정이 Verilator + 수정 BRAM에서만 입증, 원본 RTL로 실행 안 함 (uvm_apb_bram_verilator.sv, uvm_README.md)",
        "points": -4
       }
      ]
     },
     {
      "id": 3,
      "name": "PASS/FAIL 판정 정확성",
      "score": 75,
      "evidence": [
       "uvm_rv_scoreboard.svh: 명령어마다 PC, rd 대상·값, store PADDR/PWDATA/크기, load 주소를 ISS와 비교하고 종료 시 레지스터 31개, BRAM, .exp 기대값까지 3중으로 비교",
       "uvm_rv_probe_if.sv: clocking mon_cb @(posedge clk) default input #1step로 race 없이 직전 사이클 값을 샘플링",
       "uvm_log_mutant_sltu_regression.log: SLTU를 signed 비교로 바꾼 변이 RTL에서 RD_VALUE/ST_DATA/FINAL_REG/FINAL_MEM/EXPECT 오류 19건으로 TEST FAILED. 환경의 검출력을 입증",
       "final_report_team1.txt 08. Troubleshooting: FAIL 332,527 → 0, 원인은 '결과 값을 상승 에지 1step에서 인식'이라고 기술"
      ],
      "weaknesses": [
       "보고서 시점 SW 검증(07)은 파형 캡처 육안 확인뿐이며 정량적 PASS 기준(비교 항목, 허용 조건, 자동 카운트)이 없음",
       "트러블슈팅의 해결책 'clocking을 거치지 않고 상승 에지 1ns 뒤에 인식'은 임의 지연에 의존하는 방식이고, 근본 원인(예측값과 DUT 레지스터 단계의 사이클 정렬) 분석과 재발 방지 근거가 부족함",
       "Verilator 2-state에서는 poison_state()의 'x가 0이 되어 rd_known/$isunknown 검사와 X 전파 검증이 무력화됨(sum_loop X_STORE의 PWDATA=00000000이 그 증거)",
       "uvm_rv32i_iss.svh는 비정렬 SH 무시, LH 0 반환, 128워드 등 RTL 동작에 맞춘 모델이라 RTL과 같은 오류(common-mode)를 놓칠 수 있음. 변이 테스트도 SLTU 1종뿐임"
      ],
      "rationale": "ISS lock-step, 최종 상태 비교, 변이 테스트로 자동 판정의 신뢰성을 실제로 입증해 큰 개선을 이뤘다. 그러나 원본 판정은 정성적이었고, 332,527 FAIL 해결은 임의 지연 기반이며, 2-state 실행과 RTL 맞춤형 참조 모델 때문에 판정 독립성에 한계가 있다.",
      "score_breakdown": [
       {
        "item": "원본 SW 검증 파형 판정에 정량 기준 없음 (final_report 07, tb_rv32i.sv)",
        "points": -6
       },
       {
        "item": "FAIL 332,527 해결이 1ns 지연 기반, 근본 원인·재발 방지 근거 부족 (final_report 08. Troubleshooting)",
        "points": -4
       },
       {
        "item": "Verilator 2-state로 X 초기화/미정의 값 검사 무력화 (uvm_rv_types.svh poison_state, uvm_log_rv_regression_test.log X_STORE)",
        "points": -4
       },
       {
        "item": "ISS가 RTL 동작에 맞춰져 common-mode 결함 은폐 가능, 변이 1종뿐 (uvm_rv32i_iss.svh, uvm_log_mutant_sltu_regression.log)",
        "points": -4
       },
       {
        "item": "사이클 수 비교 미판정 (uvm_rv_scoreboard.svh n_lat_mismatch)",
        "points": -2
       },
       {
        "item": "보고서 판정 근거 표기 오류 다수 (final_report 04 S-type 표, 04 L-type, 06 BRAM Write/Read 슬라이드)",
        "points": -5
       }
      ]
     },
     {
      "id": 4,
      "name": "엣지 케이스 대응 시나리오",
      "score": 76,
      "evidence": [
       "uvm_prog_alu_edge.S/.exp: INT_MAX+1, INT_MIN-1 wrap, SLT/SLTU 부호 경계, SRA/SRAI 부호 유지, 시프트 양 33(하위 5비트), 즉시값 -2048/2047 부호 확장, x0 쓰기 3종 무시 등 25개 기대값",
       "uvm_prog_branch_jump.S: 분기 6종 taken/not-taken, signed/unsigned 경계(MIN/MAX, -1/1), backward 루프, JALR 홀수 타깃 LSB 클리어, rd==rs1, AUIPC/LUI",
       "uvm_prog_mem_access.S: SB 4레인, SH 상·하위, LB/LBU/LH/LHU 부호/제로 확장, 음수 오프셋, store 직후 load, 상위 비트 무시 18개 기대값",
       "uvm_prog_unmapped_access.S + uvm_log_rv_unmapped_test.log: 미할당 주소 store에서 BUS_HANG/KNOWN_BUG를 재현해 RTL 결함을 식별"
      ],
      "weaknesses": [
       "control_unit.sv EXECUTE의 case(opcode)에 default가 없어 미정의 opcode에서 n_state=c_state로 영구 정지함. monitor에 FSM_STUCK 검출기는 있으나 이를 실행하는 시나리오가 없음",
       "비정렬 접근: apb_bram.sv는 SH의 PADDR[1:0]=1/3에서 쓰기를 생략하고 LH/LHU는 0을 반환하는 등 조용히 무시함. 커버리지는 ignore_bins로 제외하고 ISS도 RTL에 맞춰 시나리오/판단이 없음",
       "메모리맵 64KB 대비 apb_bram dmem은 128워드라 0x1000_0200 이상 RAM 주소 접근이 정의되지 않음(인덱스 범위 밖). 이를 다루는 시나리오가 없음(uvm_rv32i_iss.svh 경고만 존재)",
       "리셋 직후/동작 중 리셋(APB 전송 중 리셋) 시나리오가 없음. reg_file·BRAM에 리셋이 없는데 2-state 실행으로 미초기화 상태 검증이 약함"
      ],
      "rationale": "체크리스트상 엣지 케이스(x0, 부호 확장, 시프트 5비트, SLT/SLTU, JALR LSB, 서브워드, 오버플로)를 구체적 기대값으로 대부분 다뤘고, 실제 RTL 결함 1건을 재현했다. 그러나 디코더 default 부재, 비정렬 접근, BRAM 범위 밖 주소, 리셋 관련 코너가 미검증 결함·누락으로 남아 있다.",
      "score_breakdown": [
       {
        "item": "미정의 opcode 시 EXECUTE 영구 정지 결함 미검증 (control_unit.sv case(opcode) default 부재)",
        "points": -6
       },
       {
        "item": "비정렬 SH/LH/LW 무동작·0 반환을 시나리오 없이 커버리지에서 제외 (apb_bram.sv, uvm_rv_coverage.svh ignore_bins)",
        "points": -5
       },
       {
        "item": "512B 초과 RAM 주소 접근 미검증, 메모리맵 불일치 (apb_bram.sv dmem[0:127], final_report 03)",
        "points": -4
       },
       {
        "item": "리셋 직후/동작 중 리셋 시나리오 부재 (datapath.sv reg_file 리셋 없음, uvm_rv_agent.svh)",
        "points": -4
       },
       {
        "item": "ALU 경계·시프트 코너 미달 및 결함 수정 후 재검증 없음 (uvm_log_rv_regression_test.log, uvm_README.md)",
        "points": -5
       }
      ]
     },
     {
      "id": 5,
      "name": "버스 프로토콜·통합 안정성",
      "score": 71,
      "evidence": [
       "final_report_team1.txt 06. 시뮬레이션 #1~#5: IDLE→SETUP→ACCESS 순서, PSEL0 디코드, PADDR/PWDATA HOLD, BRAM Write/Read를 파형으로 확인",
       "apb_requester.sv: IDLE에서 temp_PADDR/PWDATA/PWRITE를 래치해 SETUP~ACCESS 동안 hold, ACCESS에서 ready까지 대기",
       "uvm_rv_scoreboard.svh: 명령어마다 APB 완료 시점의 PADDR, PWDATA(mask), itype을 ISS 기대값과 비교. uvm_rv_agent.svh monitor의 BUS_HANG 검출(MEM 64사이클)",
       "uvm_log_rv_unmapped_test.log: 0x3000_0000 store에서 'MEM 상태에서 64 사이클 동안 ready 없음 → 버스 hang' 재현(address_decoder default 부재)"
      ],
      "weaknesses": [
       "apb_bram.sv PREADY = PSEL & PENABLE라 wait state가 한 번도 발생하지 않음. CPU MEM 상태의 ready 대기 경로와 ACCESS 연장 동작은 검증되지 않음(지연 슬레이브/BFM 없음)",
       "APB 프로토콜 자동 체커(SVA)가 없음: SETUP→ACCESS 순서, PADDR/PWDATA hold, PSEL one-hot, PENABLE 단독 assert 금지 등은 보고서 파형 육안 확인뿐이고, UVM은 완료 시점 값만 비교함",
       "rv32i_top.sv에서 PREADY1~6/PRDATA1~6을 구동하는 곳이 없어 0x2000_0xxx 주변장치 영역 접근 시 ready가 X/0이 되어 hang 가능. GPI/GPO RTL은 제출되지 않아 보고서 GPI/GPO 시뮬레이션을 검증할 수 없음",
       "미할당 주소 hang 결함(PSLVERR/에러 응답 없음)이 남아 있어 통합 안정성이 확보되지 않음"
      ],
      "rationale": "기본 APB 순서·hold·디코드는 파형으로, 주소/데이터는 scoreboard로 확인했고 미할당 주소 hang을 재현한 점은 인정한다. 그러나 wait state 경로가 실제로 한 번도 실행되지 않았고, 프로토콜 자동 체커가 없으며, 주변장치 슬레이브 부재와 hang 결함이 남아 통합 안정성 검증은 부분 충족에 머문다.",
      "score_breakdown": [
       {
        "item": "PREADY wait state 미발생·CPU ready 대기 경로 미검증 (apb_bram.sv PREADY = PSEL & PENABLE)",
        "points": -8
       },
       {
        "item": "APB 프로토콜 assertion/자동 체커 부재, 파형 육안 확인 (final_report 06, uvm_rv_agent.svh)",
        "points": -6
       },
       {
        "item": "주변장치 PREADY1~6 미구동·GPI/GPO RTL 미제출로 주변장치 영역 통합 미검증 (rv32i_top.sv)",
        "points": -5
       },
       {
        "item": "미할당 주소 hang 결함 미해결, 에러 응답 경로 없음 (apb_requester.sv address_decoder, uvm_log_rv_unmapped_test.log)",
        "points": -4
       },
       {
        "item": "PRDATA 'z로 툴 의존성 발생, back-to-back·전송 중 리셋 미검증 (apb_bram.sv, uvm_apb_bram_verilator.sv)",
        "points": -6
       }
      ]
     }
    ],
    "summary": "ISS 기반 SW 자동판정은 우수하나 버스 wait·예외 경로 검증 미흡",
    "improvements": [
     "PREADY를 무작위로 지연시키는 APB 슬레이브(또는 BRAM 파라미터)와 SVA 프로토콜 체커(SETUP→ACCESS, hold, PSEL one-hot)를 추가해 CPU MEM 대기 경로를 회귀에 포함",
     "미정의 opcode, 비정렬 접근, 512B 초과 RAM, 주변장치/미할당 주소, 전송 중 리셋 음성 시나리오를 추가하고 decoder default·에러 슬레이브 수정 후 PASS 전환을 재검증",
     "원본 RTL을 4-state 시뮬레이터(VCS 등)로 실행하고, C 소스를 riscv gcc로 컴파일하는 흐름과 ALU 경계·시프트 커버리지 100% 마감을 근거로 남길 것"
    ]
   },
   {
    "id": 3,
    "label": "3차 (독립)",
    "focus": "이전·다른 세션의 결과는 알 수 없고 참고하지 않는다. 5개 기준 전체를 동일한 기준과 동일한 자료로 처음부터 독립적으로 채점하라.",
    "score": 73,
    "pretrain_summary": "## 사전학습 정리\n\n**1. 프로젝트 개요**\n- RV32I 명령어 37종을 실행하는 5상태(FETCH/DECODE/EXECUTE/MEM/WB) multi-cycle CPU를 APB 버스로 BRAM(128워드)과 주변장치에 연결한 SoC 팀 프로젝트(1조, 4인).\n- 검증은 명령어 타입별 directed 파형, R/I 19개 대상 CPU UVM(PASS 541,489, coverage 100%), APB 파형, C 프로그램(1~10 누적합) SW 검증으로 했다.\n- 보고서 제출 뒤 평가 대상자의 SW 검증을 자동 판정으로 바꾸는 UVM 환경(rv32i_uvm_sw, AI 도움, Verilator 실행)이 추가되었다.\n\n**2. 핵심 아키텍처/구성 요소**\n- control_unit: opcode별 제어 FSM. S/L만 MEM 상태에서 transfer=1로 ready를 기다리고, EXECUTE의 opcode case에는 default가 없다.\n- datapath: reg_file(x0은 0, 리셋 없음), DEC/EXE/MEM 단계 레지스터, ALU, imm_extend, PC 로직(JALR LSB 클리어), WB MUX.\n- apb_requester(IDLE/SETUP/ACCESS, IDLE에서 래치·hold) + address_decoder(default 없음) + apb_mux(기본 PREADY0).\n- apb_bram: 128워드(512B, 메모리맵 64KB와 다름), SB/SH/LB/LH/LBU/LHU 처리, PREADY=PSEL&PENABLE(wait 없음), 비선택 시 PRDATA='z.\n- 추가 UVM: ROM 백도어 driver, DECODE 경계 commit monitor(clocking #1step), SV ISS lock-step scoreboard, .exp 기대값, 커버리지 6그룹, 시나리오 7개.\n\n**3. 평가 대상자 R&R과 책임 범위**\n- 정명훈: CPU SW 검증. C 코드 → 기계어 → ROM → CPU/APB/BRAM 경로로 시스템 레벨 동작을 검증한다.\n- 맡은 일: 시나리오 설계, 기대값 정의, PASS 판정, SW 경로에서 CPU/버스 결함 식별(원본 tb_rv32i.sv는 파형을 눈으로 보고 판정).\n\n**4. 검증 관점에서 중점적으로 볼 사항**\n- 원본(보고서 시점) SW 검증의 판정 방식(육안 파형)과 보완 UVM 환경이 로그·코드로 입증한 범위를 나눠서 본다.\n- 커버리지 달성률과 남은 구멍(ALU 경계 83.93%, 시프트 84.72%, L/S 오프셋 95%), cross 설계가 타당한지.\n- ISS 참조 모델이 RTL에서 독립적인지(512B·비정렬 동작을 RTL에 맞춘 점), scoreboard 동기화, 트러블슈팅 원인 분석.\n- 엣지 케이스: 비정렬 접근, 미정의 opcode에서 FSM 정지, BRAM 범위 밖 주소, 동작 중 리셋 등 아직 검증하지 않은 RTL 결함.\n- APB: wait state, back-to-back, 미할당 주소 hang(재현만 하고 수정 안 함), 주변장치 PREADY1~6 미구동, PRDATA 'z가 툴마다 다르게 동작하는 문제.\n",
    "criteria": [
     {
      "id": 1,
      "name": "명령어·기능 커버리지 확보",
      "score": 71,
      "evidence": [
       "uvm_log_rv_regression_test.log: 명령어 37종 100%, 분기×taken/not-taken 100%, Load/Store×오프셋 95.00%, ALU 피연산자 경계값 83.93%, 시프트 양 84.72%, 기타 코너 100%",
       "uvm_rv_coverage.svh: cg_instr(37종), cg_branch(6종×taken cross), cg_mem(종류×바이트 오프셋 cross, 비정렬 ignore_bins), cg_shift(0/1~30/31 + 레지스터 시프트 상위 비트), cg_misc(x0 쓰기, JALR 홀수, 사이클 수)",
       "SW 시나리오 6개(uvm_prog_*.S)가 CPU UVM 범위 밖(S/L/B/U/J, AUIPC/LUI/JALR)을 보완함. 보고서 05 슬라이드의 CPU UVM은 R/I 19개만 대상",
       "보고서 07 슬라이드/rom_code_ex1_disasm.txt: 원본 SW 검증 프로그램이 쓰는 명령어는 LUI, ADDI, SW, LW, JAL, JALR, BGE, ADD 8종뿐"
      ],
      "weaknesses": [
       "ALU 경계값 83.93%, 시프트 84.72%, L/S 오프셋 95%의 구멍을 찾아 메우지 않았음(uvm_README.md: '새 .S를 추가하면 됨'으로만 남김)",
       "uvm_rv_coverage.svh cg_alu: 8개 연산(ADD/SUB/SLT/SLTU/SRA/ADDI/SLTI/SLTIU)만 대상이고, cp_rs2는 정의만 했을 뿐 cross가 없어 rs1×rs2 부호 조합이 측정되지 않음",
       "피연산자 공간이 손으로 쓴 directed 프로그램 6개(명령어 1,211개 실행)에 한정됨. 랜덤 명령어 스트림이나 constrained random 프로그램 생성이 없음",
       "보고서 시점 평가 대상자 산출물(tb_rv32i.sv + rom_code_ex1)에는 커버리지 측정이 없고 명령어 8종만 실행"
      ],
      "rationale": "보완 UVM 환경으로 37종 명령어와 분기 방향을 100% 덮었고 S/L/B/U/J 공백도 메웠지만, ALU·시프트 경계 커버리지가 85% 안팎에 머물고 cross 설계가 좁습니다. 원본 SW 검증에는 커버리지 개념 자체가 없었습니다.",
      "score_breakdown": [
       {
        "item": "ALU 경계 83.93%/시프트 84.72%/L/S 오프셋 95% 미달성 구멍 방치 (uvm_log_rv_regression_test.log, uvm_README.md)",
        "points": -7
       },
       {
        "item": "cg_alu가 8개 연산만 대상이고 rs2 cross가 없어 피연산자 조합 설계가 부족함 (uvm_rv_coverage.svh)",
        "points": -6
       },
       {
        "item": "directed 프로그램 6개, 1,211개 명령어에 한정되고 랜덤 프로그램 생성이 없음 (uvm_README.md, 회귀 로그)",
        "points": -5
       },
       {
        "item": "보고서 시점 SW 검증에 커버리지 측정이 없고 명령어 8종만 실행 (tb_rv32i.sv, rom_code_ex1_disasm.txt, 보고서 07)",
        "points": -6
       },
       {
        "item": "FENCE/ECALL/EBREAK·미정의 opcode가 커버리지 대상에서 빠짐 (uvm_rv_coverage.svh)",
        "points": -2
       },
       {
        "item": "Verilator 개발판 단독 집계로 VCS/URG 교차 확인 없음 (uvm_README.md)",
        "points": -3
       }
      ]
     },
     {
      "id": 2,
      "name": "SW 시나리오 기반 시스템 검증",
      "score": 75,
      "evidence": [
       "보고서 07 슬라이드: rom_code_ex1의 Jump/BGE/a++/Result(dmem[122]=55)/Loop(PC=0x4C)를 파형으로 확인",
       "rom_code_ex1_disasm.txt: 스택 프레임 생성, add 함수 호출(jal ra)/복귀(jalr), bge 루프, while(1) 정지가 포함된 실제 프로그램이며 기대값 dmem[122]=55, dmem[123]=10을 미리 정의함",
       "uvm_prog_sum_loop.exp 및 회귀 로그: sum_loop PASS, 명령어 252개 lock-step 비교, 기대값 2/2",
       "uvm_prog_fib_recursion.S(재귀 fib(7), 호출 41회, sp 복원), uvm_prog_bubble_sort.S(중첩 루프, 메모리 swap, signed 정렬, 오버플로 합)가 PASS하고 기대값 68/68 일치 (uvm_log_rv_regression_test.log)"
      ],
      "weaknesses": [
       "C → 컴파일 → 기계어 체인이 입증되지 않음: rom_code_ex1의 원본 C 파일은 미제출(복원 코드뿐)이고, 추가 시나리오는 미제출 rvasm.py로 어셈블한 수작성 .S임. gcc 흐름은 README에 설명만 있음",
       "보고서 시점 tb_rv32i.sv는 15,000ns 실행 후 파형을 육안으로 보기만 하고 기대값을 자동 대조하지 않음. 자동 판정 환경은 보고서 이후 AI 도움으로 보완된 것",
       "SW 시나리오가 BRAM(512B)에만 한정됨. 보고서에 있는 GPI/GPO 경로는 rv32i_top에 연결되지 않아 SW로 검증되지 않음",
       "sum_loop의 X_STORE 경고 2건(main이 초기화되지 않은 ra/s0 저장)을 '영향 없음'으로 넘기고 기대값은 2개뿐"
      ],
      "rationale": "함수 호출·재귀·스택·루프 종료를 포함한 프로그램을 ROM→CPU→APB→BRAM 전 경로로 실행하고, 미리 정의한 기대값과 자동으로 대조했다는 점이 로그로 입증됩니다. 다만 C 컴파일 체인과 주변장치 경로는 입증되지 않았고, 보고서 시점 검증은 육안 판정이었습니다.",
      "score_breakdown": [
       {
        "item": "C 원본·컴파일 체인 미입증, 추가 시나리오는 수작성 어셈블리 (rom_code_ex1_disasm.txt, uvm_README.md)",
        "points": -8
       },
       {
        "item": "보고서 시점 SW 검증은 기대값 자동 대조 없는 육안 파형 판정이고 자동화는 사후·AI 보완 (tb_rv32i.sv, 보고서 07)",
        "points": -8
       },
       {
        "item": "GPI/GPO 등 주변장치 경로를 SW 시나리오로 검증하지 않음 (rv32i_top.sv에 BRAM만 연결)",
        "points": -4
       },
       {
        "item": "sum_loop X_STORE 경고 방치, 기대값 2개뿐 (uvm_log_rv_regression_test.log, uvm_prog_sum_loop.exp)",
        "points": -2
       },
       {
        "item": "수정한 BRAM으로 Verilator에서만 실행, 원본 RTL로는 미실행 (uvm_apb_bram_verilator.sv)",
        "points": -3
       }
      ]
     },
     {
      "id": 3,
      "name": "PASS/FAIL 판정 정확성",
      "score": 73,
      "evidence": [
       "uvm_rv32i_iss.svh + uvm_rv_scoreboard.svh: 명령어마다 PC, rd 대상·값, store PADDR/PWDATA/크기, load 주소를 lock-step으로 비교하고, PC가 어긋나면 이후 비교를 중단",
       "uvm_rv_probe_if.sv: clocking mon_cb에서 default input #1step으로 posedge 직전 값을 샘플해 race를 피하는 구조",
       "uvm_log_mutant_sltu_regression.log: SLTU를 signed 비교로 바꾼 변이 RTL에서 RD_VALUE/ST_DATA/FINAL_REG/FINAL_MEM/EXPECT 오류 19건 검출",
       "uvm_log_rv_unmapped_test.log: BUS_HANG/KNOWN_BUG로 hang 결함을 자동 검출"
      ],
      "weaknesses": [
       "ISS 메모리 모델을 RTL에 맞춤(512B 한정, 비정렬 SH는 쓰기 없음, LH는 0 반환, SW/LW는 하위 비트 무시: uvm_rv32i_iss.svh 주석). 참조 모델이 사양과 독립적이지 않아 RTL 동작이 경고만 내고 기대값으로 통과함",
       "uvm_rv_scoreboard.svh: ISS에서 값을 모르는 경우 DUT 값으로 iss.x를 동기화하고(iss.x[e.rd]=t.rd_val), X-store는 경고로만 처리해 결함을 가릴 수 있음",
       "n_lat_mismatch(사이클 수 불일치)를 세기만 하고 출력하거나 판정하지 않음",
       "보고서 08: 원인을 '상승 에지 1step에서 인식'으로만 기술했고 해결책도 'clocking 없이 1ns 뒤'라는 임시 지연이며, 05 슬라이드의 '#1step' 기술과도 맞지 않음. PASS 총수가 예상 총수와 일치하는지만 보는 판정"
      ],
      "rationale": "ISS lock-step 비교, clocking #1step 샘플링, 변이 검출로 자동 판정 체계의 신뢰성은 어느 정도 입증됐습니다. 그러나 참조 모델을 RTL 동작에 맞췄고, 원본 판정은 정량 기준이 없는 육안 판정이었으며, 트러블슈팅 원인 분석이 얕습니다.",
      "score_breakdown": [
       {
        "item": "ISS를 RTL 동작(512B, 비정렬)에 맞춰 참조 모델의 독립성 훼손 (uvm_rv32i_iss.svh)",
        "points": -6
       },
       {
        "item": "미정의 값에서 DUT 값으로 ISS 동기화, X-store는 경고만 함 (uvm_rv_scoreboard.svh)",
        "points": -3
       },
       {
        "item": "사이클 수 불일치를 세기만 하고 판정·보고하지 않음 (uvm_rv_scoreboard.svh n_lat_mismatch)",
        "points": -2
       },
       {
        "item": "트러블슈팅 원인 분석이 얕고 해결책은 임시 지연, 05와 08 슬라이드 기술이 서로 다름 (보고서 05, 08)",
        "points": -4
       },
       {
        "item": "원본 SW 검증 판정이 정량 기준 없는 육안 파형 (tb_rv32i.sv, 보고서 07)",
        "points": -8
       },
       {
        "item": "변이 1건뿐, Python ISS 미제출, 음성 테스트를 기대 FAIL로 자동 처리하지 않음 (uvm_README.md, 로그)",
        "points": -4
       }
      ]
     },
     {
      "id": 4,
      "name": "엣지 케이스 대응 시나리오",
      "score": 76,
      "evidence": [
       "uvm_prog_alu_edge.S: INT_MAX+1/INT_MIN-1 wrap, SLT/SLTU 부호 경계, SRA/SRAI 부호 유지, 시프트 양 33 → 하위 5비트, 즉시값 -2048/2047 부호 확장, SLTIU -1, x0 쓰기 3종 무시 (25/25 일치)",
       "uvm_prog_mem_access.S: SB 4레인, SH 상/하위, LB/LBU/LH/LHU 부호/제로 확장, 음수 오프셋, store 직후 load (18/18 일치)",
       "uvm_prog_branch_jump.S: 분기 6종 taken/not-taken(signed/unsigned 경계), backward 루프, JALR 홀수 타깃 LSB 클리어, JALR rd==rs1, AUIPC/LUI (6/6 일치)",
       "uvm_rv_agent.svh driver poison_state: 레지스터와 BRAM을 X로 초기화해 리셋 직후 미초기화 상태를 모사하고 X_STORE로 검출"
      ],
      "weaknesses": [
       "비정렬 Load/Store 미검증: apb_bram.sv는 SH가 PADDR[1:0]=01/11일 때 아무것도 쓰지 않고 LH/LHU는 0을 반환하며, SW/LW는 하위 비트를 무시하는데 시나리오가 없음(커버리지도 ignore_bins로 제외)",
       "control_unit.sv EXECUTE의 opcode case에 default가 없어, 미정의 opcode나 FENCE/ECALL에서 n_state가 EXECUTE에 머물러 FSM이 영구 정지함. 모니터에 FSM_STUCK 검출기는 있지만 시나리오가 없음",
       "apb_bram.sv dmem[0:127](512B)과 메모리맵 RAM 64KB(보고서 03)가 다른데, 0x1000_0200 이상 접근 시나리오가 없음(ISS는 경고만 냄)",
       "동작 중 리셋(MEM/APB ACCESS 도중 rst_n)을 검증하지 않았고 reg_file에 리셋이 없음"
      ],
      "rationale": "RV32I 대표 코너 케이스(오버플로, 부호 경계, 시프트 5비트, x0, JALR LSB, 서브워드 확장)를 기대값이 있는 시나리오로 체계적으로 다뤘습니다. 다만 비정렬 접근, 미정의 opcode에서의 정지, BRAM 범위 밖 주소 같은 RTL 결함이 검증되지 않은 채 남아 있습니다.",
      "score_breakdown": [
       {
        "item": "비정렬 SH/LH/SW/LW 동작 미검증, 커버리지에서 제외 (apb_bram.sv, uvm_rv_coverage.svh)",
        "points": -6
       },
       {
        "item": "미정의 opcode에서 control_unit EXECUTE 정지 결함 미검증 (control_unit.sv opcode case default 부재)",
        "points": -5
       },
       {
        "item": "BRAM 512B와 메모리맵 64KB 불일치, 범위 밖 주소 시나리오 없음 (apb_bram.sv, 보고서 03)",
        "points": -5
       },
       {
        "item": "동작 중 리셋 시나리오 없음, reg_file 리셋 부재 (datapath.sv reg_file)",
        "points": -3
       },
       {
        "item": "address_decoder default 부재를 재현만 하고 수정·재검증하지 않음 (uvm_log_rv_unmapped_test.log)",
        "points": -3
       },
       {
        "item": "JAL 음수/대형 오프셋 미검증 (uvm_prog_branch_jump.S)",
        "points": -2
       }
      ]
     },
     {
      "id": 5,
      "name": "버스 프로토콜·통합 안정성",
      "score": 69,
      "evidence": [
       "보고서 06 슬라이드: STATE 순서(IDLE→SETUP→ACCESS), Address Decode(PSEL0), Address/Data HOLD, BRAM R/W를 파형으로 확인(김태수 담당)",
       "uvm_rv_scoreboard.svh: SW 실행 중 store마다 PADDR/PWDATA/itype을, load마다 PADDR를 ISS와 비교해 CPU MEM↔APB 핸드셰이크가 정상 동작함을 1,211개 명령어로 간접 확인",
       "uvm_log_rv_unmapped_test.log: 0x3000_0000 store 시 address_decoder default 부재로 apb_mux가 ready=PREADY0=0을 내고 BUS_HANG이 발생함을 재현",
       "uvm_rv_types.svh rv_expected_cycles: Store 6, Load 7사이클(APB 3-phase) 모델"
      ],
      "weaknesses": [
       "wait state 미검증: apb_bram.sv PREADY=PSEL&PENABLE로 항상 0-wait이고, PREADY를 지연시키는 슬레이브/BFM이 없어 control_unit MEM 상태의 ready 대기 경로를 정상 시나리오로 검증하지 않음",
       "back-to-back 전송 미검증(CPU FSM이 매번 FETCH로 돌아가 IDLE이 끼어듦). UVM 환경에 APB 프로토콜 SVA(SETUP→ACCESS 순서, hold, PSEL one-hot)가 없고, 모니터는 PSEL0 완료만 관측",
       "미할당 주소 hang을 재현만 하고 수정하지 않음(PSLVERR/에러 슬레이브 없음). rv32i_top.sv에서 PREADY1~6/PRDATA1~6이 미구동이라 0x2000_xxxx 주변장치 주소에 접근하면 hang 또는 X가 됨. 보고서의 GPI/GPO는 제출 RTL에 통합되지 않음",
       "apb_bram.sv의 비선택 시 PRDATA='z 때문에 Verilator에서는 수정본이 필요했음. 툴마다 동작이 다른 통합 결함이 원본 RTL에 남아 있음"
      ],
      "rationale": "정상 경로의 CPU-APB-BRAM 통합은 lock-step 비교로 충분히 입증됐고 미할당 주소 hang도 재현했습니다. 그러나 wait state, back-to-back, 프로토콜 assertion, 주변장치 슬레이브 통합이 검증되지 않았고 hang·'z 결함이 RTL에 그대로 남아 있습니다.",
      "score_breakdown": [
       {
        "item": "PREADY wait state 미검증, 0-wait BRAM만 사용 (apb_bram.sv, control_unit.sv MEM)",
        "points": -8
       },
       {
        "item": "back-to-back 미검증, APB 프로토콜 SVA 없음, PSEL0만 관측 (uvm_rv_agent.svh, uvm_rv_probe_if.sv)",
        "points": -8
       },
       {
        "item": "미할당 주소 hang 미수정, PREADY1~6 미구동, GPI/GPO 미통합 (apb_requester.sv address_decoder, rv32i_top.sv)",
        "points": -8
       },
       {
        "item": "PRDATA='z로 툴마다 동작이 다른 통합 결함, Verilator 수정본 필요 (apb_bram.sv, uvm_apb_bram_verilator.sv)",
        "points": -4
       },
       {
        "item": "APB 프로토콜 검증은 다른 팀원 몫이고 평가 대상자 범위는 BRAM 단일 경로 (보고서 06, R&R)",
        "points": -3
       }
      ]
     }
    ],
    "summary": "ISS 자동판정 보완은 우수하나 버스 예외·대기·비정렬 검증 미흡",
    "improvements": [
     "address_decoder에 default 에러 슬레이브(PREADY=1, PSLVERR)를 추가하고, control_unit EXECUTE에 미정의 opcode default를 넣은 뒤 unmapped/illegal 시나리오를 PASS 기준으로 재검증",
     "PREADY를 랜덤 지연시키는 APB 슬레이브 BFM과 SETUP→ACCESS 순서·hold·PSEL one-hot SVA를 추가하고, GPI/GPO를 rv32i_top에 통합해 주변장치 SW 시나리오를 작성",
     "ISS를 사양 기준(64KB 맵, 비정렬 정책 명시)으로 분리하고 비정렬·범위 밖·동작 중 리셋 시나리오와 랜덤 명령어 스트림을 추가해 ALU/시프트 경계 커버리지를 100%로 끌어올린 뒤 원본 RTL로 VCS에서 교차 실행"
    ]
   }
  ],
  "history": [
   {
    "date": "10/20",
    "label": "최초 평가 (보고서·RTL·tb 기준, 세션별 관점 분리)",
    "score": 56
   },
   {
    "date": "10/21",
    "label": "UVM SW 자동 판정 환경 보완 후 재평가",
    "score": 72
   },
   {
    "date": "11/09",
    "label": "동일 조건 독립 3회 · 감점식 산정 재평가",
    "score": 76
   }
  ],
  "reflection": {
   "reflection": [
    "원본 SW 검증은 파형을 눈으로 보고 판정해 회귀 테스트로 쓸 수 없었고, 자동 판정은 보고서 이후에야 보완했다.",
    "버스·통합(기준 5)이 가장 낮다. 0-wait BRAM만 연결돼 PREADY 대기, back-to-back, 주변장치 경로를 시험할 수 없었다.",
    "참조 모델(ISS)을 RTL 동작에 맞춰 작성해, RTL과 모델이 같은 잘못을 하면 검출하지 못하는 구조다.",
    "Verilator(2-state)로만 실행해 X 전파와 미초기화 문제를 확인하지 못했다.",
    "찾아낸 결함(디코더 default 부재, 미정의 opcode 정지)을 재현만 하고 수정·재검증하지 않았다."
   ],
   "plan": [
    "address_decoder에 에러 응답(PREADY=1, PSLVERR=1), control_unit에 미정의 opcode 처리를 추가하고 rv_unmapped_test를 PASS로 전환",
    "PREADY를 무작위로 지연시키는 APB 슬레이브와 SVA(SETUP→ACCESS, hold, PSEL one-hot)로 wait state·back-to-back 검증",
    "VCS 4-state로 원본 RTL 회귀를 재실행하고, ISS를 사양 기준으로 분리하며 변이 테스트를 여러 결함 유형으로 확대",
    "랜덤 명령어 스트림과 경계·비정렬·범위 밖 시나리오로 ALU/시프트 커버리지 100% 마감, C→gcc 흐름 자동화"
   ]
  },
  "projection": [
   {
    "label": "① 디코더 에러 응답·미정의 opcode 처리",
    "score": 78
   },
   {
    "label": "② 랜덤 PREADY 지연 슬레이브 + APB SVA",
    "score": 81
   },
   {
    "label": "③ VCS 4-state 회귀 + 사양 기준 ISS",
    "score": 84
   },
   {
    "label": "④ 랜덤 명령어·경계 시나리오로 커버리지 마감",
    "score": 90
   }
  ]
 }
};
