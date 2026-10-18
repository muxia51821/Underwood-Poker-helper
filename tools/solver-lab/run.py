"""Build isolated adapters, solve fixtures, and fail closed before producing answer packs."""
import hashlib
import itertools
import json
from pathlib import Path
import shutil
import subprocess
import time
from bootstrap import ROOT, PRIMARY, REFERENCE, environment

HERE = Path(__file__).resolve().parent
RANKS = "23456789TJQKA"
SUITS = "cdhs"


def cards(combo):
    return [combo[:2], combo[2:]]


def canonical(combo):
    return "".join(sorted(cards(combo), key=lambda c: (RANKS.index(c[0]), SUITS.index(c[1])), reverse=True))


def evaluate5(hand):
    counts = {r: sum(c[0] == r for c in hand) for r in RANKS if any(c[0] == r for c in hand)}
    groups = sorted(((n, RANKS.index(r) + 2) for r, n in counts.items()), reverse=True)
    ranks = sorted((RANKS.index(r) + 2 for r in counts), reverse=True)
    straight = 5 if ranks == [14, 5, 4, 3, 2] else ranks[0] if len(ranks) == 5 and ranks[0] - ranks[-1] == 4 else 0
    flush = len({c[1] for c in hand}) == 1
    if straight and flush: return (8, straight)
    if groups[0][0] == 4: return (7, groups[0][1], groups[1][1])
    if [g[0] for g in groups] == [3, 2]: return (6, groups[0][1], groups[1][1])
    if flush: return (5, *ranks)
    if straight: return (4, straight)
    if groups[0][0] == 3: return (3, groups[0][1], *sorted((g[1] for g in groups[1:]), reverse=True))
    if [g[0] for g in groups[:2]] == [2, 2]: return (2, *sorted((g[1] for g in groups[:2]), reverse=True), groups[2][1])
    if groups[0][0] == 2: return (1, groups[0][1], *sorted((g[1] for g in groups[1:]), reverse=True))
    return (0, *ranks)


def strength(hand):
    return max(map(evaluate5, itertools.combinations(hand, 5)))


def expand(text, board):
    result = []
    for item in text.split(","):
        a, b = item[:2]
        for x, y in itertools.product(SUITS, repeat=2):
            if a == b and SUITS.index(x) >= SUITS.index(y): continue
            if item.endswith("s") and x != y: continue
            hand = [a+x, b+y]
            if len(set(hand + board)) == len(board)+2: result.append(canonical("".join(hand)))
    return sorted(set(result))


def compatible(a, b):
    return len(set(cards(a) + cards(b))) == 4


def profile_values(case, output):
    """Independent pair enumeration: continuation EV and unilateral gains."""
    board, pot, bet = case["board"], case["potBb"], case["betBb"]
    nodes = {n["path"]: n for n in output["nodes"]}
    oop, ip = [expand(r, board) for r in case["ranges"]]
    root = {canonical(c["cards"]): c for c in nodes["root"]["combos"]}
    facing = {canonical(c["cards"]): c for c in nodes[f"root/bet:{bet}"]["combos"]}
    oi = [a["id"] for a in nodes["root"]["actions"]].index(f"bet:{bet}")
    ii = [a["id"] for a in nodes[f"root/bet:{bet}"]["actions"]].index("call")
    pairs = [(o, i) for o in oop for i in ip if compatible(o, i)]
    strengths = {h: strength(cards(h)+board) for h in oop+ip}
    def showdown(o, i, extra=0):
        win = (strengths[o] > strengths[i]) - (strengths[o] < strengths[i])
        return win*(pot/2+extra)
    action_values = {}
    total = 0
    br_o = 0
    for o in oop:
        opponents = [i for i in ip if compatible(o, i)]
        check = sum(showdown(o,i) for i in opponents)
        betting = sum((1-facing[i]["frequency"][ii])*pot/2 + facing[i]["frequency"][ii]*showdown(o,i,bet) for i in opponents)
        action_values[("root", o)] = [check/len(opponents), betting/len(opponents)] if opponents else [None,None]
        total += check*(1-root[o]["frequency"][oi])+betting*root[o]["frequency"][oi]
        br_o += max(check, betting)
    br_i = 0
    for i in ip:
        opponents = [o for o in oop if compatible(o,i)]
        check_part = sum((1-root[o]["frequency"][oi])*(-showdown(o,i)) for o in opponents)
        mass = sum(root[o]["frequency"][oi] for o in opponents)
        fold = -pot/2*mass
        call = sum(root[o]["frequency"][oi]*(-showdown(o,i,bet)) for o in opponents)
        action_values[(f"root/bet:{bet}",i)] = [fold/mass,call/mass] if mass else [None,None]
        action_values[("root/check",i)] = [check_part / sum(1-root[o]["frequency"][oi] for o in opponents)]
        br_i += check_part+max(fold,call)
    return {"rootEvBb":[total/len(pairs),-total/len(pairs)],"nashConvBb":(br_o+br_i)/len(pairs),"actionValues":action_values,"pairs":len(pairs),"combos":[oop,ip]}


def verify(case, outputs):
    pot, bet = case["potBb"], case["betBb"]
    checks = []
    def check(name, actual, bound):
        checks.append({"name":name,"actual":actual,"maximum":bound,"pass": actual <= bound})
    expected_tree = {"root":(0,["check",f"bet:{bet}"],[20,20],10), "root/check":(1,["check"],[20,20],10),f"root/bet:{bet}":(1,["fold","call"],[20-bet,20],10+bet)}
    expected_root = [(3/11)*(pot+bet*pot/(pot+bet))-pot/2]
    expected_root.append(-expected_root[0])
    normalized = []
    for output in outputs:
        label=output["engine"]
        assert len(output["nodes"]) == 3
        assert {t["path"] for t in output["terminals"]} == {"root/check/check",f"root/bet:{bet}/fold",f"root/bet:{bet}/call"}
        actual = profile_values(case,output)
        assert [len(c) for c in actual["combos"]] == [11,12] and actual["pairs"] == 132
        max_ev_error = 0
        max_analytic_error = 0
        for node in output["nodes"]:
            p, actions, stacks, nodepot = expected_tree[node["path"]]
            assert (node["player"],[a["id"] for a in node["actions"]],node["stacksBb"],node["potBb"]) == (p,actions,stacks,nodepot)
            assert sorted(canonical(c["cards"]) for c in node["combos"]) == actual["combos"][p]
            for combo in node["combos"]:
                hand = canonical(combo["cards"])
                check(label+" frequency sum",abs(sum(combo["frequency"])-1),1e-6)
                assert all(0<=v<=1 for v in combo["frequency"])
                expected=actual["actionValues"][(node["path"],hand)]
                assert len(expected)==len(combo["evBb"])
                assert all((a is None)==(b is None) for a,b in zip(expected,combo["evBb"]))
                max_ev_error=max(max_ev_error,max(abs(a-b) for a,b in zip(expected,combo["evBb"]) if a is not None and b is not None))
                if node["path"]=="root":
                    analytic=[5,5+bet*pot/(pot+bet)] if hand[0]=="K" else [-5,-5]
                elif node["path"]=="root/check": analytic=[5]
                else: analytic=[-5,-5]
                max_analytic_error=max(max_analytic_error,max(abs(a-b) for a,b in zip(analytic,combo["evBb"]) if b is not None))
        check(label+" independent action EV",max_ev_error,0.001)
        check(label+" analytic action EV",max_analytic_error,0.001)
        check(label+" analytic root EV",max(abs(a-b) for a,b in zip(output["rootEvBb"],expected_root)),0.001)
        check(label+" independent root EV",max(abs(a-b) for a,b in zip(output["rootEvBb"],actual["rootEvBb"])),0.001)
        check(label+" independent NashConv",abs(output["nashConvBb"]-actual["nashConvBb"]),0.00001)
        check(label+" NashConv",max(output["nashConvBb"],actual["nashConvBb"]),pot*0.0001)
        check(label+" solve seconds",output["seconds"],300)
        check(label+" iterations",output["iterations"],100000)
        root=next(n for n in output["nodes"] if n["path"]=="root")
        facing=next(n for n in output["nodes"] if n["path"]==f"root/bet:{bet}")
        value=[c for c in root["combos"] if c["cards"][0]=="K"]
        bluffs=[c for c in root["combos"] if c["cards"][0]!="K"]
        check(label+" value bets",abs(sum(c["frequency"][1] for c in value)/3-1),0.005)
        check(label+" bluff mix",abs(sum(c["frequency"][1] for c in bluffs)/8 - 3*bet/(pot+bet)/8),0.005)
        check(label+" call mix",abs(sum(c["frequency"][1]*c["reachWeight"]*c["opponentMass"] for c in facing["combos"])/sum(c["reachWeight"]*c["opponentMass"] for c in facing["combos"])-pot/(pot+bet)),0.005)
        normalized.append({n["path"]:{canonical(c["cards"]):c for c in n["combos"]} for n in output["nodes"]})
    check("cross-engine root EV",max(abs(a-b) for a,b in zip(*[o["rootEvBb"] for o in outputs])),0.001)
    check("cross-engine action EV",max(abs(a-b) for path in normalized[0] for hand in normalized[0][path] for a,b in zip(normalized[0][path][hand]["evBb"],normalized[1][path][hand]["evBb"]) if a is not None and b is not None),0.001)
    return {"id":case["id"],"passed":all(c["pass"] for c in checks),"comboCounts":[11,12],"compatiblePairs":132,"analyticRootEvBb":expected_root,"checks":checks}


def build():
    for label, repo, revision, dependency, license_name in [("primary","postflop",PRIMARY,"engine","MIT"),("reference","postflop-solver",REFERENCE,"postflop-solver","AGPL-3.0-or-later")]:
        directory=ROOT/"adapters"/label
        (directory/"src").mkdir(parents=True,exist_ok=True)
        source=ROOT/"sources"/(repo+"-"+revision)
        dep=source/"engine" if label=="primary" else source
        manifest=f'[package]\nname = "solver-lab-{label}"\nversion = "0.1.0"\nedition = "2021"\nlicense = "{license_name}"\n[dependencies]\n{dependency} = {{ path = "{dep.as_posix()}", default-features = false }}\nserde_json = "=1.0.145"\n'
        (directory/"Cargo.toml").write_text(manifest)
        shutil.copyfile(HERE/(label+".rs"),directory/"src/main.rs")
        if (HERE/(label+".lock")).exists(): shutil.copyfile(HERE/(label+".lock"),directory/"Cargo.lock")
        env=environment()
        if label=="reference":
            # The pinned 2023 engine predates this deny-by-default Rust lint.
            # Preserve its source; numerical and tree gates remain identical.
            env["RUSTFLAGS"] += " -A dangerous-implicit-autorefs"
        subprocess.run([str(ROOT/"rust/bin/cargo.exe"),"build","--release","--manifest-path",str(directory/"Cargo.toml")],env=env,cwd=directory,check=True)
        shutil.copyfile(directory/"Cargo.lock",HERE/(label+".lock"))


def main():
    (HERE/"results").mkdir(exist_ok=True)
    (HERE/"verification.json").write_text(json.dumps({"schema":"solver-lab-verification-v1","passed":False,"status":"running"})+"\n")
    build()
    fixtures=json.loads((HERE/"fixtures.json").read_text())
    results=ROOT/"results";results.mkdir(exist_ok=True)
    reports=[]
    cases=fixtures["cases"][:]
    # A bijection of suits changes representations, never the game or its EVs.
    for case in fixtures["cases"]:
        cases.append({**case,"id":case["id"]+"-suit-swap","board":[c[0]+{"c":"s","s":"c","d":"h","h":"d"}[c[1]] for c in case["board"]]})
    for case in cases:
        input_path=results/(case["id"]+".input.json");input_path.write_text(json.dumps(case))
        outputs=[]
        for label in ["primary","reference"]:
            destination=results/(case["id"]+"."+label+".json")
            executable=ROOT/"target/release"/("solver-lab-"+label+".exe")
            subprocess.run([str(executable),str(input_path),str(destination)],env=environment(),check=True,timeout=305)
            outputs.append(json.loads(destination.read_text()))
        reports.append(verify(case,outputs))
        print(case["id"],"PASS" if reports[-1]["passed"] else "FAIL",flush=True)
    assert not compatible("As4s","AsTs")
    report={"schema":"solver-lab-verification-v1","passed":all(r["passed"] for r in reports),"status":"completed","engines":{"primary":PRIMARY,"reference":REFERENCE},"cases":reports,"checks":{"suitPermutation":True,"boardBlocking":True,"zeroCompatibleMass":True},"generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"toolchain":{"rustc":subprocess.check_output([str(ROOT/"rust/bin/rustc.exe"),"--version"],text=True).strip(),"gcc":subprocess.check_output([str(ROOT/"w64devkit/bin/gcc.exe"),"--version"],text=True).splitlines()[0],"singleThread":True,"compression":False}}
    (HERE/"verification.json").write_text(json.dumps(report,indent=2)+"\n")
    for case in cases:
        for suffix in ["input","primary","reference"]:
            shutil.copyfile(results/(case["id"]+"."+suffix+".json"),HERE/"results"/(case["id"]+"."+suffix+".json"))
    if not report["passed"]: raise SystemExit("Verification failed; no product integration permitted.")


if __name__=="__main__":
    (HERE/"results").mkdir(exist_ok=True)
    main()
