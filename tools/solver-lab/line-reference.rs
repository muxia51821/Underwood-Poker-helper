// AGPL-3.0-or-later. This adapter and native engine stay outside the web application.
use postflop_solver::*;
use serde_json::{json,Value};
use std::{env,fs,time::Instant};
fn token(a:Action)->String { match a {Action::Check=>"check".into(),Action::Fold=>"fold".into(),Action::Call=>"call".into(),Action::Bet(v)=>format!("bet:{v}"),_=>panic!("Unexpected action {a:?}")} }
fn card_name(c:u8)->String {format!("{}{}",b"23456789TJQKA"[(c/4) as usize] as char,b"cdhs"[(c%4) as usize] as char)}
fn walk(g:&mut PostFlopGame, history:Vec<usize>, path:String,chance_weight:f32,nodes:&mut Vec<Value>,chances:&mut Vec<Value>,ends:&mut Vec<Value>) {
    g.back_to_root(); for &a in &history { g.play(a); }
    let board_cards=g.current_board();let board:Vec<String>=board_cards.iter().map(|&c|card_name(c)).collect();
    if g.is_terminal_node() {ends.push(json!({"path":path,"board":board}));return;}
    if g.is_chance_node() {
        let possible=g.possible_cards();let totals=g.total_bet_amount();let config=g.tree_config();
        let pot=config.starting_pot+totals[0]+totals[1];let stacks=[config.effective_stack-totals[0],config.effective_stack-totals[1]];
        let mut outcomes=vec![];
        for card in 0..52u8 {if possible & (1u64<<card)==0 {continue;}
            let mut h=history.clone();h.push(card as usize);let child=format!("{path}/river:{}",card_name(card));
            outcomes.push(json!({"card":card_name(card),"child":child,"pairProbability":1.0f32/44.0}));
            walk(g,h,child,chance_weight/44.0,nodes,chances,ends);
        }
        chances.push(json!({"path":path,"board":board,"potBb":pot,"stacksBb":stacks,"outcomes":outcomes}));return;
    }
    g.cache_normalized_weights();
    let p=g.current_player(); let acts=g.available_actions();let width=g.private_cards(p).len();
    let strategy=g.strategy(); let ev=g.expected_values_detail(p);let reach=g.weights(p);
    let opp=g.weights(1-p);let opp_cards=g.private_cards(1-p);
    let names=holes_to_strings(g.private_cards(p)).unwrap();
    let totals=g.total_bet_amount();
    let combos:Vec<Value>=g.private_cards(p).iter().enumerate().filter(|(_, &(a,b))|!board_cards.contains(&a)&&!board_cards.contains(&b)).map(|(i,&(a,b))| {
        let mass:f64=opp_cards.iter().zip(opp).filter(|((c,d),_)|a!=*c&&a!=*d&&b!=*c&&b!=*d).map(|(_,w)|(*w as f64)*(chance_weight as f64)).sum();
        json!({"cards":names[i],"reachWeight":reach[i],"opponentMass":mass,
        "frequency":(0..acts.len()).map(|a|strategy[a*width+i]).collect::<Vec<_>>(),
        "evBb":(0..acts.len()).map(|a|if mass>0.0&&reach[i]>0.0 {Some(ev[a*width+i]-g.tree_config().starting_pot as f32*0.5-totals[p] as f32)}else{None}).collect::<Vec<_>>()})
    }).collect();
    let totals=g.total_bet_amount(); let config=g.tree_config();
    let labels:Vec<Value>=acts.iter().map(|&a|json!({"id":token(a),"child":format!("{}/{}",path,token(a))})).collect();
    nodes.push(json!({"path":path,"board":board,"player":p,"potBb":config.starting_pot+totals[0]+totals[1],"stacksBb":[config.effective_stack-totals[0],config.effective_stack-totals[1]],"actions":labels,"combos":combos}));
    for (i,&a) in acts.iter().enumerate() {let mut h=history.clone();h.push(i);walk(g,h,format!("{}/{}",path,token(a)),chance_weight,nodes,chances,ends);}
}
fn main(){
    let args:Vec<String>=env::args().collect();let f:Value=serde_json::from_str(&fs::read_to_string(&args[1]).unwrap()).unwrap();
    let board:Vec<u8>=f["board"].as_array().unwrap().iter().map(|c|card_from_str(c.as_str().unwrap()).unwrap()).collect();
    let turn=board.len()==4;
    let cc=CardConfig{range:[f["ranges"][0].as_str().unwrap().parse().unwrap(),f["ranges"][1].as_str().unwrap().parse().unwrap()],flop:board[..3].try_into().unwrap(),turn:board[3],river:if turn {NOT_DEALT}else{board[4]}};
    let sizes=BetSizeOptions::try_from(("50%","")).unwrap();
    let mut config=TreeConfig{initial_state:if turn {BoardState::Turn}else{BoardState::River},starting_pot:f["potBb"].as_i64().unwrap() as i32,effective_stack:f["stackBb"].as_i64().unwrap() as i32,add_allin_threshold:0.0,force_allin_threshold:0.0,merging_threshold:0.0,..Default::default()};
    config.turn_bet_sizes=[sizes.clone(),sizes.clone()];config.river_bet_sizes=[sizes.clone(),sizes];
    let tree=ActionTree::new(config).unwrap();let mut g=PostFlopGame::with_config(cc,tree).unwrap();g.allocate_memory(false);
    let start=Instant::now();let mut iterations=0;let mut half=f32::INFINITY;
    while iterations<100000&&start.elapsed().as_secs_f64()<300.0 {
        for _ in 0..500 {solve_step(&g,iterations);iterations+=1;}
        half=compute_exploitability(&g);if half*2.0<=0.0002 {break;}
    }
    let seconds=start.elapsed().as_secs_f64();let root=compute_current_ev(&g);finalize(&mut g);
    let mut nodes=vec![];let mut chances=vec![];let mut ends=vec![];walk(&mut g,vec![],"root".into(),1.0,&mut nodes,&mut chances,&mut ends);
    fs::write(&args[2],serde_json::to_string_pretty(&json!({"engine":"b-inary/postflop-solver","iterations":iterations,"seconds":seconds,"reportedHalfNashConvBb":half,"nashConvBb":half*2.0,"rootEvBb":root,"nodes":nodes,"chanceNodes":chances,"terminals":ends})).unwrap()).unwrap();
}
