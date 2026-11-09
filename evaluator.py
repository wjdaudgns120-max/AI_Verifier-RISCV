"""
AI 기반 프로젝트 설계/검증 자동 평가기 (Gemini API)

흐름 (프로젝트 1개 기준)
  1) 사전학습(Pre-training): pretrain_knowledge.md + 프로젝트 자료(보고서, 소스)를 새 채팅 세션에 주입
  2) 평가: 5개 기준설정 근거로 0~100점 채점 (JSON)
  3) 1~2를 서로 다른 세션 3회 반복 (세션마다 검토 관점을 바꿈) → 평균 = 최종 점수
  4) results/ 에 JSON 저장 + dashboard_data.js 갱신 → dashboard.html 에서 시각화

사용법
  python evaluator.py --project riscv          # RISC-V 프로젝트만
  python evaluator.py --project ondevice       # 온디바이스 AI 프로젝트만
  python evaluator.py --project all            # 둘 다
  python evaluator.py --project riscv --dry-run   # API 호출 없이 프롬프트만 생성/확인

API 키는 .env 의 GEMINI_API_KEY 에서만 읽음 (코드에 하드코딩 금지).
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECTS_DIR = BASE / "projects"
RESULTS_DIR = BASE / "results"
RAW_DIR = RESULTS_DIR / "raw"

DEFAULT_MODEL = "gemini-3.8-flash"
FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-2.5-flash"]
MAX_RETRY = 3            # 한 요청당 최대 재시도 (무한 루프 금지)
WAIT_429 = 60            # 429(호출 한도) 발생 시 대기 초 (가이드: 1분 대기)
WAIT_5XX = 20

# 콘솔 한글/색상
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
C = {"b": "\033[1m", "g": "\033[32m", "y": "\033[33m", "r": "\033[31m", "c": "\033[36m", "x": "\033[0m"}
if os.name == "nt":
    os.system("")  # Windows 터미널 ANSI 색상 활성화


def cprint(msg, color=None):
    print(f"{C[color]}{msg}{C['x']}" if color else msg, flush=True)


# ─────────────────────────── 프롬프트 ───────────────────────────
EVALUATOR_PERSONA = {
    "verification": (
        "너는 반도체 SoC 검증(Design Verification) 분야 15년 경력의 시니어 검증 엔지니어이자 기술 평가관이다. "
        "UVM, functional coverage, 시스템 레벨 SW 검증, AMBA APB 프로토콜 검증에 정통하다. "
        "교육생 프로젝트의 '검증(Verification) 품질'을 객관적 근거로만 채점한다."
    ),
    "design": (
        "너는 엣지 AI / 임베디드 비전 시스템 설계 분야 15년 경력의 시니어 아키텍트이자 기술 평가관이다. "
        "모델 경량화(NCNN, 양자화), 분산 실시간 스트리밍, 다중 객체 추적(ByteTrack)에 정통하다. "
        "교육생 프로젝트의 '설계(Design) 품질'을 객관적 근거로만 채점한다."
    ),
}

COMMON_RULES = """
[평가 원칙]
- 제공된 자료(사전학습 문서, 보고서, 소스 코드)에 근거가 있는 것만 인정한다. 자료에 없는 활동은 수행하지 않은 것으로 간주한다.
- 각 점수에는 반드시 근거를 '파일명' 또는 '보고서 슬라이드/페이지'로 인용한다.
- 소스 코드에서 직접 확인한 결함·누락은 구체적으로(파일명, 신호/함수명) 지적하고 감점 근거로 쓴다.
- 칭찬 위주로 점수를 부풀리지 않는다. 교육 프로젝트라는 이유로 기준을 낮추지 않되, 범위 밖 요구(양산 수준 기능)를 감점하지도 않는다.
- 평가 대상자는 R&R 표에 표시된 1인이다. 팀 전체 결과물 중 평가 대상자 책임 범위와 관련된 부분에 더 큰 비중을 둔다.

[점수 척도]
- 90~100: 근거 자료로 명확히 입증, 의미 있는 결함 거의 없음
- 75~89 : 대부분 충족, 일부 보완 필요
- 60~74 : 부분 충족, 주요 누락 존재
- 40~59 : 근거 부족 또는 중대한 결함
- 0~39  : 거의 수행되지 않음
"""


def build_system_instruction(cfg):
    return EVALUATOR_PERSONA[cfg["evaluator_type"]] + "\n" + COMMON_RULES + "\n모든 답변은 한국어로 작성한다."


def build_pretrain_message(cfg, pdir):
    parts = [
        "지금부터 평가에 앞서 사전학습(Pre-training)을 진행한다. 아래 문서와 자료를 모두 학습하라.\n",
        "=" * 70,
        f"[사전학습 문서] {cfg['pretrain_doc']}",
        "=" * 70,
        (pdir / cfg["pretrain_doc"]).read_text(encoding="utf-8"),
    ]
    for rel in cfg["materials"]:
        fp = pdir / rel
        if not fp.exists():
            cprint(f"  [경고] 자료 파일 없음: {rel} (건너뜀)", "y")
            continue
        parts += ["", "=" * 70, f"[첨부 자료] FILE: {fp.name}", "=" * 70,
                  fp.read_text(encoding="utf-8", errors="replace")]
    parts += [
        "", "=" * 70,
        "[학습 확인 요청]",
        "학습한 내용을 아래 형식으로 간결하게(전체 25줄 이내) 정리하라. 아직 채점하지 마라.",
        "1. 프로젝트 개요 (3줄)",
        "2. 핵심 아키텍처/구성 요소 (5줄 이내)",
        "3. 평가 대상자의 역할(R&R)과 책임 범위 (2줄)",
        f"4. 이번 평가 관점({'검증(Verification)' if cfg['evaluator_type'] == 'verification' else '설계(Design)'})에서 중점적으로 볼 사항 (5줄 이내)",
    ]
    return "\n".join(parts)


def build_eval_message(cfg, session):
    crit = "\n".join(f"{c['id']}. {c['name']}\n   - {c['description']}" for c in cfg["criteria"])
    ids = ", ".join(str(c["id"]) for c in cfg["criteria"])
    return f"""이제 채점을 진행한다.

[이번 세션] {session['label']}
[세션 검토 관점] {session['focus']}
(검토 관점은 중점 사항일 뿐이며, 5개 기준을 모두 채점한다.)

[평가 대상자] {cfg['role']['member']} / {cfg['role']['title']}

[기준설정 근거 5개]
{crit}

[출력 형식] 아래 JSON 하나만 출력하라. 코드블록·설명 문장 없이 JSON만.
{{
  "criteria": [
    {{
      "id": 1,
      "score": 0~100 정수,
      "evidence": ["근거 1 (파일명/슬라이드 인용)", "근거 2"],
      "weaknesses": ["부족한 점/결함 1", "부족한 점 2"],
      "rationale": "이 점수를 준 이유 1~2문장",
      "score_breakdown": [
        {{"item": "감점 사유 (근거 파일/슬라이드)", "points": -10}},
        {{"item": "다른 감점 사유", "points": -5}}
      ]
    }}
  ],
  "summary": "이 세션의 종합 평가 한 줄 (40자 내외)",
  "improvements": ["가장 효과가 큰 개선 제안 1", "제안 2", "제안 3"]
}}
criteria 배열에는 id {ids} 를 모두, 순서대로 포함하라.
[점수 산정 방식] 각 기준은 100점 만점에서 시작해 감점 항목을 하나씩 적용해 점수를 낸다.
score_breakdown에는 적용한 감점 항목을 모두 적고(각 points는 음의 정수), 100 + (points의 합) = score 가 정확히 성립해야 한다."""


# ─────────────────────────── Gemini 호출 ───────────────────────────
def make_client(api_key):
    from google import genai
    return genai.Client(api_key=api_key)


def send(chat, message, config=None, tag=""):
    """429/5xx 재시도 포함 메시지 전송. 최대 MAX_RETRY 회."""
    from google.genai import errors
    for attempt in range(1, MAX_RETRY + 1):
        try:
            t0 = time.time()
            resp = chat.send_message(message, config=config) if config else chat.send_message(message)
            dt = time.time() - t0
            usage = getattr(resp, "usage_metadata", None)
            tok = getattr(usage, "total_token_count", None) if usage else None
            cprint(f"    ✓ {tag} 응답 {dt:.1f}s" + (f" / 토큰 {tok:,}" if tok else ""), "g")
            return resp.text or ""
        except errors.APIError as e:
            code = getattr(e, "code", None)
            if code == 429 and attempt < MAX_RETRY:
                cprint(f"    ! 429 호출 한도 초과 → {WAIT_429}초 대기 후 재시도 ({attempt}/{MAX_RETRY})", "y")
                time.sleep(WAIT_429)
            elif code in (500, 502, 503, 504) and attempt < MAX_RETRY:
                cprint(f"    ! 서버 오류 {code} → {WAIT_5XX}초 대기 후 재시도 ({attempt}/{MAX_RETRY})", "y")
                time.sleep(WAIT_5XX)
            else:
                raise


def parse_json(text):
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t)
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", t, re.S)
        if m:
            return json.loads(m.group(0))
        raise


def validate(result, cfg):
    by_id = {int(c.get("id", -1)): c for c in result.get("criteria", [])}
    out = []
    for c in cfg["criteria"]:
        r = by_id.get(c["id"])
        if r is None:
            raise ValueError(f"기준 {c['id']} 누락")
        score = int(round(float(r["score"])))
        if not 0 <= score <= 100:
            raise ValueError(f"기준 {c['id']} 점수 범위 오류: {score}")
        out.append({
            "id": c["id"], "name": c["name"], "score": score,
            "evidence": list(r.get("evidence", []))[:4],
            "weaknesses": list(r.get("weaknesses", []))[:4],
            "rationale": str(r.get("rationale", "")),
            "score_breakdown": [{"item": str(b.get("item", "")), "points": int(b.get("points", 0))}
                                for b in r.get("score_breakdown", [])],
        })
        bd = out[-1]["score_breakdown"]
        if bd and 100 + sum(b["points"] for b in bd) != score:
            raise ValueError(f"기준 {c['id']} 감점 합계 불일치: 100{sum(b['points'] for b in bd):+d} != {score}")
    return {
        "criteria": out,
        "summary": str(result.get("summary", "")),
        "improvements": list(result.get("improvements", []))[:3],
    }


def run_session(client, model, cfg, pdir, session, stamp):
    from google.genai import types
    chat = client.chats.create(
        model=model,
        config=types.GenerateContentConfig(system_instruction=build_system_instruction(cfg), temperature=0.3),
    )
    pid, sid = cfg["project_id"], session["id"]

    # 1) 사전학습
    pre_text = send(chat, build_pretrain_message(cfg, pdir), tag="사전학습")
    (RAW_DIR / f"{pid}_{stamp}_s{sid}_pretrain.md").write_text(pre_text, encoding="utf-8")

    # 2) 평가 (JSON 모드)
    json_cfg = types.GenerateContentConfig(
        system_instruction=build_system_instruction(cfg), temperature=0.3,
        response_mime_type="application/json")
    eval_text = send(chat, build_eval_message(cfg, session), config=json_cfg, tag="채점")
    (RAW_DIR / f"{pid}_{stamp}_s{sid}_eval.json.txt").write_text(eval_text, encoding="utf-8")
    try:
        parsed = validate(parse_json(eval_text), cfg)
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as e:
        cprint(f"    ! JSON 형식 오류({e}) → 1회 재요청", "y")
        eval_text = send(chat, "직전 답변이 형식에 맞지 않는다. 요청한 JSON 형식 그대로, JSON만 다시 출력하라.",
                         config=json_cfg, tag="채점(재요청)")
        (RAW_DIR / f"{pid}_{stamp}_s{sid}_eval_retry.json.txt").write_text(eval_text, encoding="utf-8")
        parsed = validate(parse_json(eval_text), cfg)

    scores = [c["score"] for c in parsed["criteria"]]
    return {
        "id": sid, "label": session["label"], "focus": session["focus"],
        "score": round(sum(scores) / len(scores)),
        "pretrain_summary": pre_text,
        **parsed,
    }


# ─────────────────────────── 결과 저장/출력 ───────────────────────────
def aggregate(cfg, sessions, model, stamp):
    crit_avg = []
    for c in cfg["criteria"]:
        vals = [next(x["score"] for x in s["criteria"] if x["id"] == c["id"]) for s in sessions]
        crit_avg.append({"id": c["id"], "name": c["name"], "score": round(sum(vals) / len(vals)), "per_session": vals})
    return {
        "project_id": cfg["project_id"],
        "project_name": cfg["project_name"],
        "dashboard_title": cfg["dashboard_title"],
        "team": cfg["team"],
        "evaluator_type": cfg["evaluator_type"],
        "role": cfg["role"],
        "model": model,
        "evaluated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "run_id": stamp,
        "final_score": round(sum(s["score"] for s in sessions) / len(sessions)),
        "criteria_average": crit_avg,
        "sessions": sessions,
    }


def write_dashboard_data():
    data = {}
    for f in sorted(RESULTS_DIR.glob("latest_*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        data[d["project_id"]] = d
    js = "// evaluator.py 가 자동 생성. 직접 수정하지 마세요.\nwindow.EVAL_DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"
    (RESULTS_DIR / "dashboard_data.js").write_text(js, encoding="utf-8")


def print_report(res):
    t = "검증(Verification)" if res["evaluator_type"] == "verification" else "설계(Design)"
    cprint("\n" + "═" * 64, "c")
    cprint(f" {res['project_name']}  |  {t} 평가  |  {res['model']}", "b")
    cprint("═" * 64, "c")
    print(f" 평가 대상 : {res['role']['member']} - {res['role']['title']}")
    print(f" 평가 일시 : {res['evaluated_at']}\n")
    print(" [기준설정 근거별 점수]" + " " * 22 + "  ".join(f"S{s['id']}" for s in res["sessions"]) + "   평균")
    for c in res["criteria_average"]:
        name = c["name"]
        pad = 38 - sum(2 if ord(ch) > 127 else 1 for ch in name)
        print(f"  {c['id']}. {name}{' ' * max(pad, 1)}" + "  ".join(f"{v:>3}" for v in c["per_session"]) + f"   {c['score']:>3}")
    print("\n [세션별 점수]")
    for s in res["sessions"]:
        print(f"  {s['label']:<12} {s['score']:>3}점  - {s['summary']}")
    cprint(f"\n ▶ AI 자동화 검증 평균 : {res['final_score']} / 100", "b")
    cprint("═" * 64 + "\n", "c")


# ─────────────────────────── main ───────────────────────────
def load_project(pid):
    pdir = PROJECTS_DIR / pid
    cfg = json.loads((pdir / "config.json").read_text(encoding="utf-8"))
    return cfg, pdir


def main():
    ap = argparse.ArgumentParser(description="Gemini 기반 프로젝트 설계/검증 자동 평가기")
    ap.add_argument("--project", default="all", help="riscv | ondevice | all")
    ap.add_argument("--dry-run", action="store_true", help="API 호출 없이 프롬프트 파일만 생성")
    ap.add_argument("--pause", type=int, default=15, help="세션 사이 대기 초 (팀 공용 RPM 보호, 기본 15)")
    args = ap.parse_args()

    pids = ["riscv", "ondevice"] if args.project == "all" else [args.project]
    RESULTS_DIR.mkdir(exist_ok=True)
    RAW_DIR.mkdir(exist_ok=True)

    if args.dry_run:
        for pid in pids:
            cfg, pdir = load_project(pid)
            out = RESULTS_DIR / f"dryrun_{pid}.txt"
            pre = build_pretrain_message(cfg, pdir)
            body = ["#### SYSTEM ####", build_system_instruction(cfg), "\n#### TURN 1: 사전학습 ####", pre]
            for s in cfg["sessions"]:
                body += [f"\n#### TURN 2 ({s['label']}): 채점 ####", build_eval_message(cfg, s)]
            out.write_text("\n".join(body), encoding="utf-8")
            cprint(f"[dry-run] {pid}: 사전학습 메시지 {len(pre):,}자 (약 {len(pre) // 3:,} 토큰 추정) → {out.name}", "c")
        return

    try:
        from dotenv import load_dotenv
    except ImportError:
        sys.exit("python-dotenv 가 없습니다: pip install -r requirements.txt")
    load_dotenv(BASE / ".env")
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        sys.exit("GEMINI_API_KEY 가 없습니다. .env.example 을 .env 로 복사하고 팀 키를 입력하세요.")
    model = os.environ.get("GEMINI_MODEL", DEFAULT_MODEL).strip()
    try:
        client = make_client(api_key)
    except ImportError:
        sys.exit("google-genai 가 없습니다: pip install -r requirements.txt")
    from google.genai import errors

    for pid in pids:
        cfg, pdir = load_project(pid)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        cprint(f"\n▶ [{cfg['project_name']}] 평가 시작 (모델: {model}, 세션 {len(cfg['sessions'])}회)", "b")
        sessions = []
        for i, s in enumerate(cfg["sessions"]):
            cprint(f"  ● {s['label']} 세션 (새 채팅 세션 생성)", "c")
            while True:
                try:
                    sessions.append(run_session(client, model, cfg, pdir, s, stamp))
                    break
                except errors.APIError as e:
                    if getattr(e, "code", None) == 404 and FALLBACK_MODELS:
                        nxt = FALLBACK_MODELS.pop(0)
                        cprint(f"    ! 모델 '{model}' 사용 불가(404) → '{nxt}' 로 전환", "y")
                        model = nxt
                        continue
                    sys.exit(f"API 오류: {e}\n(모델명은 .env 의 GEMINI_MODEL 로 바꿀 수 있습니다)")
            cprint(f"    → {s['label']} : {sessions[-1]['score']}점", "g")
            if i < len(cfg["sessions"]) - 1 and args.pause:
                time.sleep(args.pause)

        res = aggregate(cfg, sessions, model, stamp)
        (RESULTS_DIR / f"{pid}_{stamp}.json").write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
        (RESULTS_DIR / f"latest_{pid}.json").write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
        write_dashboard_data()
        print_report(res)

    cprint("완료. dashboard.html 을 브라우저로 열면 결과를 볼 수 있습니다.", "g")


if __name__ == "__main__":
    main()
