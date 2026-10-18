"""Verify one exact turn-to-checkdown model, including every legal river."""
from functools import lru_cache
import hashlib
import itertools
import json
from pathlib import Path
import shutil
import subprocess
import time
from bootstrap import ROOT, PRIMARY, REFERENCE, environment
from run import HERE, RANKS, SUITS, cards, canonical, expand, compatible, strength, build, verify


@lru_cache(maxsize=None)
def hand_strength(board, hand):
    return strength(list(board)+cards(hand))


@lru_cache(maxsize=None)
def runouts(board, oop, ip):
    dead=set(board+tuple(cards(oop)+cards(ip)))
    result={}
    for rank,suit in itertools.product(RANKS,SUITS):
        card=rank+suit
        if card in dead: continue
        final=board+(card,)
        a,b=hand_strength(final,oop),hand_strength(final,ip)
        result[card]=(a>b)-(a<b)
    assert len(result)==44
    return result


def profile(case, output):
    board=tuple(case['board']);pot,bet=case['potBb'],case['betBb']
    by_path={n['path']:n for n in output['nodes']}
    oop,ip=[expand(r,list(board)) for r in case['ranges']]
    roots={canonical(c['cards']):c for c in by_path['root']['combos']}
    facing={canonical(c['cards']):c for c in by_path[f'root/bet:{bet}']['combos']}
    def payoff(o,i,extra=0): return sum(runouts(board,o,i).values())/44*(pot/2+extra)
    actions={};total=0;br_o=0;br_i=0
    for o in oop:
        opponents=[i for i in ip if compatible(o,i)]
        check=sum(payoff(o,i) for i in opponents)
        betting=sum((1-facing[i]['frequency'][1])*pot/2+facing[i]['frequency'][1]*payoff(o,i,bet) for i in opponents)
        actions[('root',o)]=[check/len(opponents),betting/len(opponents)]
        total+=check*(1-roots[o]['frequency'][1])+betting*roots[o]['frequency'][1]
        br_o+=max(check,betting)
    for i in ip:
        opponents=[o for o in oop if compatible(o,i)]
        check=sum((1-roots[o]['frequency'][1])*(-payoff(o,i)) for o in opponents)
        check_mass=sum(1-roots[o]['frequency'][1] for o in opponents)
        mass=sum(roots[o]['frequency'][1] for o in opponents)
        fold=-pot/2*mass;call=sum(roots[o]['frequency'][1]*(-payoff(o,i,bet)) for o in opponents)
        actions[(f'root/bet:{bet}',i)]=[fold/mass,call/mass]
        actions[('root/check',i)]=[check/check_mass]
        br_i+=check+max(fold,call)
    return {'actions':actions,'rootEvBb':[total/132,-total/132],'nashConvBb':(br_o+br_i)/132,'roots':roots,'facing':facing,'ranges':[oop,ip]}


def chance_summary(case, output):
    """Marginal river probabilities condition on ranges and actions, not 1/48."""
    p=profile(case,output);board=tuple(case['board']);bet=case['betBb'];pot=case['potBb']
    summaries=[]
    for chance in output['chanceNodes']:
        called=chance['path']==f'root/bet:{bet}/call'
        pair_mass={}
        for o,i in itertools.product(*p['ranges']):
            if not compatible(o,i):continue
            pb=p['roots'][o]['frequency'][1];pc=p['facing'][i]['frequency'][1]
            pair_mass[(o,i)]=pb*pc if called else 1-pb
        mass=sum(pair_mass.values());outcomes=[]
        for edge in chance['outcomes']:
            card=edge['card'];eligible=[(o,i) for o,i in pair_mass if card in runouts(board,o,i)]
            compatible_mass=sum(pair_mass[pair] for pair in eligible)
            oop_ev=sum(pair_mass[pair]*runouts(board,*pair)[card]*(pot/2+(bet if called else 0)) for pair in eligible)/compatible_mass if compatible_mass else None
            outcomes.append({'card':card,'path':edge['child'],'probability':compatible_mass/(44*mass) if mass else None,
                             'compatiblePairs':len(eligible),'compatibleMass':compatible_mass,
                             'rootEvBb':[oop_ev,-oop_ev] if oop_ev is not None else [None,None]})
        summaries.append({'path':chance['path'],'board':case['board'],'potBb':chance['potBb'],'stacksBb':chance['stacksBb'],
                          'forcedActions':['check','check'],'pairProbability':1/44,'outcomes':outcomes})
    return summaries


def verify_turn(case,outputs):
    checks=[]
    def check(name,actual,bound):checks.append({'name':name,'actual':actual,'maximum':bound,'pass':actual<=bound})
    pot,bet=case['potBb'],case['betBb'];board=case['board']
    expected_turn={'root':(0,['check',f'bet:{bet}'],10,[20,20]),'root/check':(1,['check'],10,[20,20]),f'root/bet:{bet}':(1,['fold','call'],15,[15,20])}
    signatures=[];tops=[]
    for output in outputs:
        label=output['engine'];p=profile(case,output);top={};signature=[]
        assert len(output['nodes'])==195 and len(output['chanceNodes'])==2 and len(output['terminals'])==97
        max_ev=max_mass=max_reach=max_sum=max_analytic=0
        for node in output['nodes']:
            path=node['path'];actor=node['player'];ids=[a['id'] for a in node['actions']]
            if len(node['board'])==4:
                assert path in expected_turn
                assert (actor,ids,node['potBb'],node['stacksBb'])==expected_turn[path]
                top[path]={canonical(c['cards']):c for c in node['combos']}
            else:
                assert len(node['board'])==5 and node['board'][:4]==board
                assert path.split('/')[-1] in ['river:'+node['board'][-1],'check']
                assert actor==(1 if path.endswith('/check') else 0) and ids==['check']
                called=path.startswith(f'root/bet:{bet}/call/')
                assert node['potBb']==(20 if called else 10) and node['stacksBb']==([15,15] if called else [20,20])
            expected_combos=expand(case['ranges'][actor],node['board'])
            assert sorted(canonical(c['cards']) for c in node['combos'])==expected_combos
            for c in node['combos']:
                h=canonical(c['cards']);max_sum=max(max_sum,abs(sum(c['frequency'])-1))
                assert all(0<=v<=1 for v in c['frequency'])
                if len(node['board'])==4:
                    expected=p['actions'][(path,h)]
                    ideal=([5,101/12] if h[0]=='K' else [-95/22,-95/22]) if path=='root' else [95/22] if path=='root/check' else [-5,-5]
                    assert all(v is not None for v in c['evBb'])
                    max_analytic=max(max_analytic,max(abs(a-b) for a,b in zip(ideal,c['evBb'])))
                else:
                    called=path.startswith(f'root/bet:{bet}/call/')
                    def reach(player,hand):
                        if player==0:return p['roots'][hand]['frequency'][1] if called else 1-p['roots'][hand]['frequency'][1]
                        return p['facing'][hand]['frequency'][1] if called else 1
                    opponents=[o for o in p['ranges'][1-actor] if compatible(h,o) and not any(card in o for card in node['board'])]
                    mass=sum(reach(1-actor,o) for o in opponents)
                    max_mass=max(max_mass,abs(c['opponentMass']-mass/44))
                    max_reach=max(max_reach,abs(c['reachWeight']-reach(actor,h)))
                    def value(o):
                        a,b=hand_strength(tuple(node['board']),h),hand_strength(tuple(node['board']),o)
                        return ((a>b)-(a<b))*(pot/2+(bet if called else 0))
                    expected=[sum(reach(1-actor,o)*value(o) for o in opponents)/mass if mass else None]
                    # Some engines cannot export a counterfactual value at zero own reach.
                    if c['evBb'][0] is None:assert c['reachWeight']==0 or mass==0
                for a,b in zip(expected,c['evBb']):
                    if a is not None and b is not None:max_ev=max(max_ev,abs(a-b))
            signature.append((path,actor,tuple(node['board']),node['potBb'],tuple(node['stacksBb']),tuple(ids),tuple(expected_combos)))
        river_cards={r+s for r,s in itertools.product(RANKS,SUITS)}-set(board)
        for chance in output['chanceNodes']:
            assert len(chance['outcomes'])==48 and {e['card'] for e in chance['outcomes']}==river_cards
            assert chance['path'] in ['root/check/check',f'root/bet:{bet}/call']
            for edge in chance['outcomes']:
                assert edge['child']==chance['path']+'/river:'+edge['card']
                check(label+' pair river probability',abs(edge['pairProbability']-1/44),1e-9)
        expected_terminals={f'root/bet:{bet}/fold'}|{chance['path']+'/river:'+card+'/check/check' for chance in output['chanceNodes'] for card in river_cards}
        assert {t['path'] for t in output['terminals']}==expected_terminals
        for summary in chance_summary(case,output):
            check(label+' marginal probability sum',abs(sum(e['probability'] for e in summary['outcomes'])-1),1e-12)
            assert sum(e['compatiblePairs'] for e in summary['outcomes'])==132*44
        check(label+' frequency sum',max_sum,1e-6)
        check(label+' independent action EV all nodes',max_ev,0.001)
        check(label+' analytic turn action EV',max_analytic,0.001)
        check(label+' compatible opponent mass',max_mass,1e-6)
        check(label+' own reach',max_reach,1e-6)
        check(label+' analytic root EV',max(abs(a-b) for a,b in zip(output['rootEvBb'],[-409/484,409/484])),0.001)
        check(label+' independent root EV',max(abs(a-b) for a,b in zip(output['rootEvBb'],p['rootEvBb'])),0.001)
        check(label+' independent NashConv',abs(output['nashConvBb']-p['nashConvBb']),0.00001)
        check(label+' NashConv',max(output['nashConvBb'],p['nashConvBb']),pot*0.0001)
        check(label+' iterations',output['iterations'],100000);check(label+' solve seconds',output['seconds'],300)
        root=top['root'];facing=top[f'root/bet:{bet}']
        check(label+' value bets',abs(sum(c['frequency'][1] for h,c in root.items() if h[0]=='K')/3-1),0.005)
        check(label+' bluff mix',abs(sum(c['frequency'][1] for h,c in root.items() if h[0]=='A')/8-0.1375),0.005)
        check(label+' call mix',abs(sum(c['frequency'][1] for c in facing.values())/12-41/60),0.005)
        signatures.append(sorted(signature));tops.append(top)
    assert signatures[0]==signatures[1]
    check('cross-engine turn action EV',max(abs(a-b) for path in tops[0] for hand in tops[0][path] for a,b in zip(tops[0][path][hand]['evBb'],tops[1][path][hand]['evBb'])),0.001)
    check('cross-engine root EV',max(abs(a-b) for a,b in zip(outputs[0]['rootEvBb'],outputs[1]['rootEvBb'])),0.001)
    return {'id':case['id'],'passed':all(c['pass'] for c in checks),'comboCounts':[11,12],'compatiblePairs':132,'pairRunouts':5808,'publicRivers':48,'analyticRootEvBb':[-409/484,409/484],'checks':checks}


def main():
    report_file=HERE/'turn-verification.json'
    report_file.write_text(json.dumps({'passed':False,'status':'running'})+'\n')
    build();fixtures=json.loads((HERE/'turn-fixtures.json').read_text())
    case=fixtures['cases'][0]
    cases=[case,{**case,'id':case['id']+'-suit-swap','board':[c[0]+{'c':'s','s':'c','d':'h','h':'d'}[c[1]] for c in case['board']]}]
    cases.extend({**c,'id':c['id']+'-7181-regression'} for c in json.loads((HERE/'fixtures.json').read_text())['cases'])
    reports=[];artifacts={}
    for c in cases:
        inp=ROOT/'results'/(c['id']+'.input.json');inp.write_text(json.dumps(c))
        outputs=[]
        for label in ['primary','reference']:
            out=ROOT/'results'/(c['id']+'.'+label+'.json')
            subprocess.run([str(ROOT/'target/release'/('solver-lab-'+label+'.exe')),str(inp),str(out)],env=environment(),check=True,timeout=305)
            outputs.append(json.loads(out.read_text()))
        result=verify_turn(c,outputs) if len(c['board'])==4 else verify(c,outputs)
        reports.append(result);print(c['id'],'PASS' if result['passed'] else 'FAIL',flush=True)
        for suffix in ['input','primary','reference']:
            source=ROOT/'results'/(c['id']+'.'+suffix+'.json');destination=HERE/'results'/source.name
            shutil.copyfile(source,destination);artifacts['results/'+destination.name]=hashlib.sha256(destination.read_bytes()).hexdigest()
        if not result['passed']:break
    for file in ['turn-fixtures.json','primary.rs','reference.rs','primary.lock','reference.lock']:
        artifacts[file]=hashlib.sha256((HERE/file).read_bytes()).hexdigest()
    report={'schema':'solver-lab-verification-v1','passed':len(reports)==len(cases) and all(c['passed'] for c in reports),'status':'completed',
            'engines':{'primary':PRIMARY,'reference':REFERENCE},'cases':reports,'artifacts':artifacts,
            'generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'singleThread':True,'compression':False,
            'crossEngineEvScope':'turn decisions; forced river nodes independently checked against each engine own profile; conditional posteriors can differ in nonunique equilibria'}
    report_file.write_text(json.dumps(report,indent=2)+'\n')
    if not report['passed']:raise SystemExit('Numerical gate failed. Do not export the turn answer pack.')


if __name__=='__main__':main()
