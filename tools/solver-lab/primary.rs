// MIT. Export average-strategy continuation values, never best-response values.
use engine::{br, cards, cfr::{DcfrParams, Solver}, config::SolveConfig, game::{Game, NodeInfo}, nlhe::NlheGame, tree::NodeKind};
use serde_json::{json, Value};
use std::{env, fs, time::Instant};

fn walk(s: &Solver<NlheGame>, id:u32, path:String, reach:[Vec<f32>;2], chance_weight:f32, nodes:&mut Vec<Value>, chances:&mut Vec<Value>, ends:&mut Vec<Value>) {
    let g=s.game(); let node=g.tree().node(id);
    let board:Vec<String>=g.board_at(id).iter().map(|&c|cards::card_to_string(c)).collect();
    if let NodeInfo::Chance {num_outcomes}=g.node(id) {
        let mut outcomes=vec![];
        for k in 0..num_outcomes {
            let edge=g.chance_outcome(id,k); let card=cards::card_to_string(*g.board_at(edge.child).last().unwrap());
            let child_path=format!("{path}/river:{card}");
            let child_reach=[edge.parent_of_child[0].iter().map(|&i|reach[0][i as usize]).collect(),edge.parent_of_child[1].iter().map(|&i|reach[1][i as usize]).collect()];
            outcomes.push(json!({"card":card,"child":child_path,"pairProbability":edge.weight}));
            walk(s,edge.child,child_path,child_reach,chance_weight*edge.weight,nodes,chances,ends);
        }
        chances.push(json!({"path":path,"board":board,"potBb":node.pot,"stacksBb":node.stacks,"outcomes":outcomes}));return;
    }
    let NodeKind::Decision {player,actions}=&node.kind else {
        assert!(matches!(node.kind,NodeKind::Terminal(_)), "Unexpected chance node");
        ends.push(json!({"path":path,"board":board,"potBb":node.pot,"stacksBb":node.stacks,"kind":format!("{:?}",node.kind)})); return;
    };
    let p=*player as usize; let width=reach[p].len(); let strategy=s.average_strategy(id);
    let opp_reach:Vec<f32>=reach[1-p].iter().map(|w|w*chance_weight).collect();
    let mass=g.compatible_mass(id,*player,&opp_reach);
    let evs:Vec<Vec<Option<f32>>>=actions.iter().map(|a| {
        let mut ev=vec![0.0;width];
        br::subtree_values(g,a.child,*player,&s.average(),&opp_reach,false,&mut ev);
        ev.iter().zip(&mass).map(|(v,m)| if *m>0.0 {Some(v/m)} else {None}).collect()
    }).collect();
    let combos:Vec<Value>=g.live_combos(id,*player).iter().enumerate().map(|(i,&(a,b))| json!({
        "cards":format!("{}{}",cards::card_to_string(a.max(b)),cards::card_to_string(a.min(b))),
        "reachWeight":reach[p][i],"opponentMass":mass[i],
        "frequency":(0..actions.len()).map(|a|strategy[a*width+i]).collect::<Vec<_>>(),
        "evBb":evs.iter().map(|v|v[i]).collect::<Vec<_>>()
    })).collect();
    let labels:Vec<Value>=actions.iter().map(|a|json!({"id":a.label.token(),"child":format!("{}/{}",path,a.label.token())})).collect();
    nodes.push(json!({"path":path,"board":board,"player":player,"potBb":node.pot,"stacksBb":node.stacks,"actions":labels,"combos":combos}));
    for (a,edge) in actions.iter().enumerate() {
        let mut child_reach=reach.clone();
        for i in 0..width { child_reach[p][i]*=strategy[a*width+i]; }
        walk(s,edge.child,format!("{}/{}",path,edge.label.token()),child_reach,chance_weight,nodes,chances,ends);
    }
}
fn main() {
    let args:Vec<String>=env::args().collect();
    let f:Value=serde_json::from_str(&fs::read_to_string(&args[1]).unwrap()).unwrap();
    let b=f["betBb"].as_f64().unwrap(); let pot=f["potBb"].as_f64().unwrap();
    let board=f["board"].as_array().unwrap().iter().map(|c|c.as_str().unwrap()).collect::<Vec<_>>().join(" ");
    let street=if f["board"].as_array().unwrap().len()==4 {"turn"}else{"river"};
    let toml=format!("board = {board:?}\noop_range = {}\nip_range = {}\nstarting_pot = {pot}\neffective_stack = {}\nallin_threshold = 100\nraise_cap = 0\n[sizings.oop.{street}]\nbet = {{ percents = [{}], allin = false }}\n",f["ranges"][0],f["ranges"][1],f["stackBb"],b/pot*100.0);
    let cfg=SolveConfig::from_toml_str(&toml).unwrap();
    let mut s=Solver::new(NlheGame::new(&cfg).unwrap()); let start=Instant::now();
    while s.iterations()<100000 && start.elapsed().as_secs_f64()<300.0 {
        s.run(500,&DcfrParams::from_config(&cfg),0,|_,_,_|{});
        if s.exploitability().chips<=0.000001 { break; }
    }
    let seconds=start.elapsed().as_secs_f64(); let g=s.game(); let mut nodes=vec![];let mut chances=vec![];let mut ends=vec![];
    walk(&s,g.root(),"root".into(),[g.root_weights(0).to_vec(),g.root_weights(1).to_vec()],1.0,&mut nodes,&mut chances,&mut ends);
    let out=json!({"engine":"ucsandman/postflop","iterations":s.iterations(),"seconds":seconds,"nashConvBb":s.exploitability().chips,"rootEvBb":[s.expected_value(0),s.expected_value(1)],"configToml":toml,"nodes":nodes,"chanceNodes":chances,"terminals":ends});
    fs::write(&args[2],serde_json::to_string_pretty(&out).unwrap()).unwrap();
}
