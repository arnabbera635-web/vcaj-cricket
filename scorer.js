import {auth,db,isAdmin,collection,doc,getDoc,setDoc,updateDoc,addDoc,query,orderBy,onSnapshot,serverTimestamp,signInWithEmailAndPassword,signOut,onAuthStateChanged,runTransaction} from "./firebase.js";
const $=id=>document.getElementById(id); let state=null, unsub=null, eventStack=[];
const defaultPlayers=[
{id:"p1",name:"Player 1",runs:0,balls:0,fours:0,sixes:0,out:false},
{id:"p2",name:"Player 2",runs:0,balls:0,fours:0,sixes:0,out:false},
{id:"p3",name:"Player 3",runs:0,balls:0,fours:0,sixes:0,out:false},
{id:"p4",name:"Player 4",runs:0,balls:0,fours:0,sixes:0,out:false},
{id:"p5",name:"Player 5",runs:0,balls:0,fours:0,sixes:0,out:false},
{id:"p6",name:"Player 6",runs:0,balls:0,fours:0,sixes:0,out:false},
{id:"p7",name:"Player 7",runs:0,balls:0,fours:0,sixes:0,out:false},
{id:"p8",name:"Player 8",runs:0,balls:0,fours:0,sixes:0,out:false},
{id:"p9",name:"Player 9",runs:0,balls:0,fours:0,sixes:0,out:false},
{id:"p10",name:"Player 10",runs:0,balls:0,fours:0,sixes:0},
{id:"p11",name:"Player 11",runs:0,balls:0,fours:0,sixes:0}
];
const defaultBowlers=[{id:"b1",name:"Bowler 1",balls:0,runs:0,wickets:0},{id:"b2",name:"Bowler 2",balls:0,runs:0,wickets:0},{id:"b3",name:"Bowler 3",balls:0,runs:0,wickets:0}];
function newMatch(id){return {id,title:id,battingTeam:"Team A",bowlingTeam:"Team B",score:0,wickets:0,legalBalls:0,innings:1,target:0,striker:"p1",nonStriker:"p2",bowler:"b1",players:defaultPlayers,bowlers:defaultBowlers,extras:{wide:0,noBall:0,bye:0,legBye:0},commentary:[],status:"LIVE",updatedAt:null};}
function ballsText(n){return `${Math.floor(n/6)}.${n%6}`;}
function render(){
 if(!state)return; $("matchTitle").textContent=`${state.battingTeam} vs ${state.bowlingTeam} — ${state.id}`; $("battingTeam").textContent=state.battingTeam;
 $("score").textContent=`${state.score}/${state.wickets}`; $("overs").textContent=`${ballsText(state.legalBalls)} overs`;
 $("crr").textContent=`CRR ${state.legalBalls?(state.score/(state.legalBalls/6)).toFixed(2):"0.00"}`;
 const ss=$("striker"), ns=$("nonStriker"), bw=$("bowler"); ss.innerHTML=ns.innerHTML=bw.innerHTML="";
 state.players.forEach(p=>{const o=new Option(`${p.name}${p.out?" (OUT)":""}`,p.id);ss.add(o.cloneNode(true));ns.add(o.cloneNode(true));});
 state.bowlers.forEach(p=>bw.add(new Option(p.name,p.id)));
 ss.value=state.striker; ns.value=state.nonStriker; bw.value=state.bowler;
 $("batInfo").textContent=`Striker: ${state.players.find(p=>p.id===state.striker)?.runs||0} runs`;
 $("bowlInfo").textContent=`${state.bowlers.find(p=>p.id===state.bowler)?.wickets||0} wicket(s)`;
 $("battingCard").innerHTML=`<table><tr><th>ব্যাটার</th><th>R</th><th>B</th><th>4s</th><th>6s</th></tr>${state.players.slice(0,11).map(p=>`<tr><td>${p.name}${p.id===state.striker?" *":""}</td><td>${p.runs}</td><td>${p.balls}</td><td>${p.fours}</td><td>${p.sixes}</td></tr>`).join("")}</table>`;
 $("bowlingCard").innerHTML=`<table><tr><th>বোলার</th><th>O</th><th>R</th><th>W</th></tr>${state.bowlers.map(p=>`<tr><td>${p.name}</td><td>${ballsText(p.balls)}</td><td>${p.runs}</td><td>${p.wickets}</td></tr>`).join("")}</table>`;
 $("commentary").innerHTML=(state.commentary||[]).slice(-30).reverse().map(x=>`<div><b>${x.over}</b> — ${x.text}</div>`).join("");
}
function selectedBatter(id){return state.players.find(p=>p.id===id)}
async function save(){state.updatedAt=serverTimestamp();await setDoc(doc(db,"matches",state.id),state,{merge:true});await setDoc(doc(db,"liveMatches",state.id),{...state,updatedAt:serverTimestamp()},{merge:true});}
async function recordPlayerStats(event,oldState){
 // Match-level snapshot is enough for live use. Final stats are also written incrementally by the scorer.
 const s=selectedBatter(event.strikerId); if(!s)return;
 const ref=doc(db,"players",s.id); const snap=await getDoc(ref);
 const current=snap.exists()?snap.data():{id:s.id,name:s.name,totalRuns:0,totalBalls:0,totalFours:0,totalSixes:0,totalMatches:0,totalWickets:0};
 const delta={totalRuns:event.batterRuns||0,totalBalls:event.legal?1:0,totalFours:event.batterRuns===4?1:0,totalSixes:event.batterRuns===6?1:0};
 await setDoc(ref,{...current,id:s.id,name:s.name,totalRuns:(current.totalRuns||0)+delta.totalRuns,totalBalls:(current.totalBalls||0)+delta.totalBalls,totalFours:(current.totalFours||0)+delta.totalFours,totalSixes:(current.totalSixes||0)+delta.totalSixes},{merge:true});
}
async function apply(type,value=0){
 if(!state)return;
 const before=JSON.parse(JSON.stringify(state)); const striker=selectedBatter(state.striker), bowler=state.bowlers.find(x=>x.id===state.bowler);
 let legal=true, batterRuns=0, extra=0, text="";
 if(type==="run"){batterRuns=value;text=`${value} run`; if(value===4)text="FOUR";if(value===6)text="SIX";}
 if(type==="wide"){legal=false;extra=1;state.extras.wide++;text="Wide";}
 if(type==="noBall"){legal=false;extra=1;state.extras.noBall++;text="No Ball";}
 if(type==="bye"){batterRuns=0;extra=value;state.extras.bye+=value;text=`Bye ${value}`;}
 if(type==="legBye"){batterRuns=0;extra=value;state.extras.legBye+=value;text=`Leg bye ${value}`;}
 if(type==="wicket"){legal=true;state.wickets++;striker.out=true;bowler.wickets++;text=`WICKET — ${striker.name}`;}
 state.score+=batterRuns+extra;
 striker.runs+=batterRuns; if(legal)striker.balls++;
 if(batterRuns===4)striker.fours++; if(batterRuns===6)striker.sixes++;
 bowler.runs+=batterRuns+((type==="wide"||type==="noBall")?1:0);
 if(legal){state.legalBalls++;bowler.balls++;}
 if((batterRuns+extra)%2===1){[state.striker,state.nonStriker]=[state.nonStriker,state.striker];}
 if(legal && state.legalBalls%6===0){[state.striker,state.nonStriker]=[state.nonStriker,state.striker];}
 const ev={type,batterRuns,legal,strikerId:striker.id,over:ballsText(before.legalBalls),text,createdAt:new Date().toISOString()};
 state.commentary.push(ev); eventStack.push(before); render(); await addDoc(collection(db,"matches",state.id,"events"),ev); await save(); await recordPlayerStats(ev,before);
}
async function undo(){const prev=eventStack.pop();if(!prev){alert("এই session-এ undo করার মতো event নেই");return;}state=prev;render();await save();}
$("runButtons").innerHTML=[0,1,2,3,4,5,6].map(n=>`<button data-run="${n}" class="${n===4||n===6?"accent":""}">${n}</button>`).join("");
document.querySelectorAll("[data-run]").forEach(b=>b.onclick=()=>apply("run",Number(b.dataset.run)));
document.querySelectorAll("[data-extra]").forEach(b=>b.onclick=()=>{const t=b.dataset.extra;apply(t,t==="bye"||t==="legBye"?1:0)});
$("striker").onchange=e=>{state.striker=e.target.value;save();}; $("nonStriker").onchange=e=>{state.nonStriker=e.target.value;save();}; $("bowler").onchange=e=>{state.bowler=e.target.value;save();};
$("undoBtn").onclick=undo;
$("endInnings").onclick=async()=>{state.status="INNINGS_BREAK";await save();render();};
$("loadMatch").onclick=async()=>{const id=$("matchId").value.trim();if(!id)return;const snap=await getDoc(doc(db,"matches",id));state=snap.exists()?snap.data():newMatch(id);if(!snap.exists())await save();render(); if(unsub)unsub();unsub=onSnapshot(doc(db,"matches",id),s=>{if(s.exists()){state=s.data();render();}})};
$("loginBtn").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("email").value,$("password").value);}catch(e){$("loginMsg").textContent=e.message}};
$("logoutBtn").onclick=()=>signOut(auth);
onAuthStateChanged(auth,user=>{if(user&&isAdmin(user)){$("loginCard").classList.add("hidden");$("scorerApp").classList.remove("hidden");}else{$("loginCard").classList.remove("hidden");$("scorerApp").classList.add("hidden");}});
