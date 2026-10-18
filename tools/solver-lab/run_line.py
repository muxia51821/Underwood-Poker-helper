"""Solve and independently check a two-street, no-raise betting game."""
from functools import lru_cache
import hashlib
import itertools
import json
from pathlib import Path
import shutil
import subprocess
import time
from bootstrap import ROOT, PRIMARY, REFERENCE, environment
from run import HERE, expand, compatible, canonical, cards, strength


def artifact_sha256(path):
    """Hash artifact content with canonical LF newlines across platforms."""
    return hashlib.sha256(path.read_bytes().replace(b'\r\n', b'\n')).hexdigest()


def build_line():
    for label, repo, revision, dependency, license_name in [('primary','postflop',PRIMARY,'engine','MIT'),('reference','postflop-solver',REFERENCE,'postflop-solver','AGPL-3.0-or-later')]:
        directory=ROOT/'adapters'/('line-'+label);(directory/'src').mkdir(parents=True,exist_ok=True)
        source=ROOT/'sources'/(repo+'-'+revision);dep=source/'engine' if label=='primary' else source
        manifest=f'[package]\nname = "solver-line-{label}"\nversion = "0.1.0"\nedition = "2021"\nlicense = "{license_name}"\n[dependencies]\n{dependency} = {{ path = "{dep.as_posix()}", default-features = false }}\nserde_json = "=1.0.145"\n'
        (directory/'Cargo.toml').write_text(manifest)
        shutil.copyfile(HERE/('line-'+label+'.rs'),directory/'src/main.rs')
        lock=directory/'Cargo.lock'
        if not lock.exists():
            text=(HERE/(label+'.lock')).read_text().replace('name = "solver-lab-'+label+'"','name = "solver-line-'+label+'"')
            lock.write_text(text)
        env=environment()
        if label=='reference':env['RUSTFLAGS']+=' -A dangerous-implicit-autorefs'
        subprocess.run([str(ROOT/'rust/bin/cargo.exe'),'build','--offline','--locked','--release','--manifest-path',str(directory/'Cargo.toml')],env=env,cwd=directory,check=True)


@lru_cache(maxsize=None)
def winner(board, a, b):
    x,y=strength(list(board)+cards(a)),strength(list(board)+cards(b))
    return (x>y)-(x<y)


def verify_line(case, output):
    ranges=[expand(r,case['board']) for r in case['ranges']]
    pairs=[(a,b) for a,b in itertools.product(*ranges) if compatible(a,b)]
    decisions={n['path']:n for n in output['nodes']};chances={n['path']:n for n in output['chanceNodes']};ends={n['path']:n for n in output['terminals']}
    checks=[];max_ev=0;max_mass=0;max_reach=0;max_frequency=0
    signature=[];terminal_values={}
    normalized={path:{canonical(c['cards']):c for c in node['combos']} for path,node in decisions.items()}
    def visit(path, board, stacks, pot, actor, facing=False, checked=False, reach=None, chance_weight=1):
        nonlocal max_ev,max_mass,max_reach,max_frequency
        if reach is None:reach=[{h:1.0 for h in r} for r in ranges]
        live=[(a,b) for a,b in pairs if not any(c in board for c in cards(a)+cards(b))]
        # Build a separate expected rules tree, then reconcile every exported node.
        if path in ends:
            folded=path.endswith('/fold')
            assert folded or (len(board)==5 and (path.endswith('/check/check') or path.endswith('/call')))
            if folded:
                folder=actor
                value=(pot-(case['potBb']/2+case['stackBb']-stacks[0])) if folder==1 else -(case['potBb']/2+case['stackBb']-stacks[0])
                result={(a,b):value for a,b in live}
            else:
                stake=case['potBb']/2+case['stackBb']-stacks[0]
                result={(a,b):(pot if winner(tuple(board),a,b)>0 else 0 if winner(tuple(board),a,b)<0 else pot/2)-stake for a,b in live}
            terminal_values[path]=result;return result
        if len(board)==4 and (path.endswith('/check/check') or path.endswith('/call')):
            node=chances[path];assert node['board']==board and node['potBb']==pot and node['stacksBb']==stacks
            deck=[r+s for r,s in itertools.product('23456789TJQKA','cdhs') if r+s not in board]
            assert {o['card'] for o in node['outcomes']}==set(deck)
            result={pair:0.0 for pair in live}
            for edge in node['outcomes']:
                card=edge['card'];assert edge['child']==path+'/river:'+card and abs(edge['pairProbability']-1/44)<1e-9
                child=visit(edge['child'],board+[card],stacks,pot,0,reach=reach,chance_weight=chance_weight/44)
                for pair,v in child.items():result[pair]+=v/44
            signature.append((path,tuple(board),pot,tuple(stacks),'chance'));return result
        node=decisions[path];lookup=normalized[path]
        ids=['fold','call'] if facing else ['check','bet:'+str(pot//2)]
        assert node['player']==actor and node['board']==board and node['potBb']==pot and node['stacksBb']==stacks
        assert [a['id'] for a in node['actions']]==ids
        expected=[h for h in ranges[actor] if not any(c in board for c in cards(h))]
        assert set(lookup)==set(expected)
        children=[]
        for k,action in enumerate(ids):
            edge=node['actions'][k];assert edge['child']==path+'/'+action
            child_reach=[dict(r) for r in reach]
            for h in expected:child_reach[actor][h]*=lookup[h]['frequency'][k]
            next_stacks=stacks[:];next_pot=pot
            if action.startswith('bet:'):next_stacks[actor]-=pot//2;next_pot+=pot//2
            if action=='call':
                paid=stacks[actor]-stacks[1-actor];next_stacks[actor]-=paid;next_pot+=paid
            # On fold, the next actor is the folder for terminal payoff accounting.
            child_actor=actor if action=='fold' else 1-actor
            children.append(visit(edge['child'],board,next_stacks,next_pot,child_actor,action.startswith('bet:'),action=='check',child_reach,chance_weight))
        for h,c in lookup.items():
            own=reach[actor][h];opponents=[o for o in ranges[1-actor] if not any(x in board for x in cards(o)) and compatible(h,o)]
            mass=sum(reach[1-actor][o] for o in opponents)
            max_mass=max(max_mass,abs(c['opponentMass']-mass*chance_weight));max_reach=max(max_reach,abs(c['reachWeight']-own))
            max_frequency=max(max_frequency,abs(sum(c['frequency'])-1));assert all(0<=f<=1 for f in c['frequency'])
            for k,child in enumerate(children):
                expected_ev=sum(reach[1-actor][o]*child[(h,o) if actor==0 else (o,h)]*(1 if actor==0 else -1) for o in opponents)/mass if mass else None
                actual=c['evBb'][k]
                if actual is None:assert mass==0 or own==0
                else:assert expected_ev is not None;max_ev=max(max_ev,abs(expected_ev-actual))
        signature.append((path,actor,tuple(board),pot,tuple(stacks),tuple(ids),tuple(sorted(lookup))))
        return {pair:sum(normalized[path][pair[actor]]['frequency'][k]*child[pair] for k,child in enumerate(children)) for pair in live}
    values=visit('root',case['board'],[case['stackBb']]*2,case['potBb'],0)
    root=sum(values.values())/len(pairs)
    def best_response(player,path,opponent_reach):
        if path in ends:
            return {h:sum(opponent_reach[o]*terminal_values[path].get((h,o) if player==0 else (o,h),0)*(1 if player==0 else -1) for o in ranges[1-player]) for h in ranges[player]}
        if path in chances:
            result={h:0.0 for h in ranges[player]}
            for edge in chances[path]['outcomes']:
                for h,v in best_response(player,edge['child'],opponent_reach).items():result[h]+=v/44
            return result
        node=decisions[path];children=[]
        for k,a in enumerate(node['actions']):
            weights=opponent_reach if node['player']==player else {h:w*normalized[path].get(h,{'frequency':[0,0]})['frequency'][k] for h,w in opponent_reach.items()}
            children.append(best_response(player,a['child'],weights))
        # Maximize after summing compatible opponents: no knowledge of their private cards.
        return {h:max(child[h] for child in children) if node['player']==player else sum(child[h] for child in children) for h in ranges[player]}
    nash=sum(sum(best_response(p,'root',{h:1 for h in ranges[1-p]}).values()) for p in [0,1])/len(pairs)
    def check(name,value,limit):checks.append({'name':name,'actual':value,'maximum':limit,'pass':value<=limit})
    check('independent all-node action EV',max_ev,case['tolerances']['evBb'])
    check('compatible opponent mass',max_mass,1e-6);check('own reach',max_reach,1e-6);check('frequency normalization',max_frequency,1e-6)
    check('independent root EV',max(abs(output['rootEvBb'][0]-root),abs(output['rootEvBb'][1]+root)),0.001)
    check('normalized NashConv',output['nashConvBb'],case['potBb']*case['tolerances']['nashConvPotFraction'])
    check('independent NashConv',nash,case['potBb']*case['tolerances']['nashConvPotFraction'])
    check('reported versus independent NashConv',abs(nash-output['nashConvBb']),0.00001)
    check('solve seconds',output['seconds'],300);check('iterations',output['iterations'],100000)
    assert len(signature)==len(decisions)+len(chances)
    return {'engine':output['engine'],'checks':checks,'passed':all(c['pass'] for c in checks),'comboCounts':list(map(len,ranges)),'compatiblePairs':len(pairs),'signature':sorted(signature,key=str),'nodes':len(decisions),'chanceNodes':len(chances),'terminals':len(ends)}


def main():
    (HERE/'line-verification.json').write_text(json.dumps({'passed':False,'status':'running'})+'\n')
    build_line();case=json.loads((HERE/'line-fixture.json').read_text());reports=[];outputs=[];artifacts={};same=True;root_diff=0
    swap={'c':'s','s':'c','d':'h','h':'d'}
    cases=[case,{**case,'id':case['id']+'-suit-swap','board':[c[0]+swap[c[1]] for c in case['board']]}]
    for fixture in cases:
        inp=ROOT/'results'/(fixture['id']+'.input.json');inp.write_text(json.dumps(fixture))
        pair=[];shapes=[]
        for label in ['primary','reference']:
            out=ROOT/'results'/(fixture['id']+'.'+label+'.json')
            subprocess.run([str(ROOT/'target/release'/('solver-line-'+label+'.exe')),str(inp),str(out)],env=environment(),check=True,timeout=310)
            output=json.loads(out.read_text());pair.append(output);outputs.append(output)
            print(fixture['id'],label,'solved',output['iterations'],output['seconds'],output['nashConvBb'],flush=True)
            report=verify_line(fixture,output);shapes.append(report.pop('signature'));report['id']=fixture['id'];reports.append(report)
            print(label,'verified',report['passed'],flush=True)
            destination=HERE/'results'/out.name;shutil.copyfile(out,destination)
            artifacts['results/'+out.name]=artifact_sha256(destination)
        same=same and shapes[0]==shapes[1]
        root_diff=max(root_diff,max(abs(a-b) for a,b in zip(pair[0]['rootEvBb'],pair[1]['rootEvBb'])))
    suit_diff=max(abs(outputs[i]['rootEvBb'][0]-outputs[i+2]['rootEvBb'][0]) for i in [0,1])
    for name in ['line-fixture.json','line-primary.rs','line-reference.rs','run_line.py']:
        artifacts[name]=artifact_sha256(HERE/name)
    report={'passed':same and root_diff<=0.001 and suit_diff<=0.001 and all(r['passed'] for r in reports),'sameTreeAndCombos':same,'crossEngineRootEvDifferenceBb':root_diff,'suitPermutationRootDifferenceBb':suit_diff,
            'engines':{'primary':PRIMARY,'reference':REFERENCE},'cases':reports,'artifacts':artifacts,'generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
            'evScope':'Every action EV checked against the exporting engine own average-strategy continuation; conditional posteriors are not required to coincide across different equilibria. No analytic mix solution claimed.'}
    (HERE/'line-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    if not report['passed']:raise SystemExit('Two-street numerical gate failed; no scoring integration permitted.')


if __name__=='__main__':main()
