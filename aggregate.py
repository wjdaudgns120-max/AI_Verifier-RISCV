"""독립 세션(Claude 에이전트) 결과를 evaluator.py 와 같은 형식으로 집계."""
import sys, json, io, contextlib
from datetime import datetime
from pathlib import Path
P=Path(sys.argv[1]); OUT=Path(sys.argv[2]); MODEL=sys.argv[3]
sys.path.insert(0,str(P)); import evaluator as E
E.RESULTS_DIR=P/"results"; E.RAW_DIR=E.RESULTS_DIR/"raw"; E.RAW_DIR.mkdir(parents=True,exist_ok=True)
stamp=datetime.now().strftime("%Y%m%d_%H%M%S")
for pid in ("riscv","ondevice"):
    cfg,_=E.load_project(pid); sessions=[]
    for s in cfg["sessions"]:
        pre=(OUT/f"{pid}_s{s['id']}_pretrain.md").read_text(encoding="utf-8")
        ev=(OUT/f"{pid}_s{s['id']}_eval.json").read_text(encoding="utf-8")
        (E.RAW_DIR/f"{pid}_{stamp}_s{s['id']}_pretrain.md").write_text(pre,encoding="utf-8")
        (E.RAW_DIR/f"{pid}_{stamp}_s{s['id']}_eval.json.txt").write_text(ev,encoding="utf-8")
        parsed=E.validate(E.parse_json(ev),cfg); sc=[c["score"] for c in parsed["criteria"]]
        sessions.append({"id":s["id"],"label":s["label"],"focus":s["focus"],"score":round(sum(sc)/len(sc)),"pretrain_summary":pre,**parsed})
    res=E.aggregate(cfg,sessions,MODEL,stamp)
    for name in (f"{pid}_{stamp}.json",f"latest_{pid}.json"):
        (E.RESULTS_DIR/name).write_text(json.dumps(res,ensure_ascii=False,indent=2),encoding="utf-8")
    E.C={k:"" for k in E.C}
    buf=io.StringIO()
    with contextlib.redirect_stdout(buf): E.print_report(res)
    (E.RESULTS_DIR/f"report_{pid}.txt").write_text(buf.getvalue(),encoding="utf-8"); print(buf.getvalue())
E.write_dashboard_data()
