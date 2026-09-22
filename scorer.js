import {
  auth, db, isAdmin, collection, doc, getDoc, getDocs, setDoc,
  onSnapshot, serverTimestamp
} from "./firebase.js";

const $ = id => document.getElementById(id);

let state = null;
let unsub = null;
let eventStack = [];
let teams = [];
let players = [];
let cloudOnline = navigator.onLine;

const stageNames = {
  R16: "Round of 16", QF: "Quarter Final", SF: "Semi Final",
  FINAL: "Final", CUSTOM: "Custom"
};

const bowlerWicketTypes = ["bowled","caught","lbw","stumped","hitWicket"];

const dismissalNames = {
  bowled:{bn:"বোল্ড",en:"Bowled"}, caught:{bn:"ক্যাচ আউট",en:"Caught"},
  lbw:{bn:"LBW",en:"LBW"}, runOut:{bn:"রান আউট",en:"Run Out"},
  stumped:{bn:"স্টাম্পড",en:"Stumped"}, hitWicket:{bn:"হিট উইকেট",en:"Hit Wicket"},
  obstructing:{bn:"ফিল্ডে বাধা",en:"Obstructing the Field"},
  hitTwice:{bn:"দুবার বল মারা",en:"Hit the Ball Twice"},
  timedOut:{bn:"টাইমড আউট",en:"Timed Out"},
  retiredOut:{bn:"রিটায়ার্ড আউট",en:"Retired Out"}
};

const LOCAL_PREFIX = "vcaj_match_backup_v1_";
const PENDING_PREFIX = "vcaj_pending_events_v1_";

function esc(s){
  return String(s ?? "").replace(/[&<>"]/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
  }[c]));
}
function slug(s){
  return (s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-")
    .replace(/^-|-$/g,"").slice(0,35);
}
function ballsText(n){return `${Math.floor((n||0)/6)}.${(n||0)%6}`;}
function oversValue(){
  const v=$("overs").value;
  return v==="custom" ? Number($("customOvers").value||15) : Number(v);
}
function clone(x){return JSON.parse(JSON.stringify(x));}
function localKey(id){return LOCAL_PREFIX+String(id||"unknown");}
function pendingKey(id){return PENDING_PREFIX+String(id||"unknown");}

function makePlayers(list,teamId){
  return list.map(p=>({
    id:p.id,name:p.name,runs:0,balls:0,fours:0,sixes:0,out:false,teamId
  }));
}
function makeBowlers(list,teamId){
  return list.map(p=>({
    id:p.id,name:p.name,balls:0,runs:0,wickets:0,teamId,
    fieldingCatches:0,fieldingStumpings:0,fieldingRunOuts:0
  }));
}
function makeInnings(
  battingTeamId,battingTeam,bowlingTeamId,bowlingTeam,
  batList,bowlList,maxOvers,target=0,number=1,superOver=false
){
  const p=makePlayers(batList,battingTeamId);
  const b=makeBowlers(bowlList,bowlingTeamId);
  return {
    inningsNo:number,battingTeamId,battingTeam,bowlingTeamId,bowlingTeam,
    score:0,wickets:0,legalBalls:0,maxOvers,target,players:p,bowlers:b,
    striker:p[0]?.id||"",nonStriker:p[1]?.id||"",bowler:b[0]?.id||"",
    freeHit:false, bowlerChangeRequired:false,bowlerChangeFromId:"",
    extras:{wide:0,noBall:0,bye:0,legBye:0},commentary:[],
    status:superOver?"SUPER_OVER":"LIVE",superOver
  };
}
function newMatch(id,t1,t2,overs,p1,p2,meta){
  const inn=makeInnings(
    t1,meta.team1Name,t2,meta.team2Name,p1,p2,overs,0,1,false
  );
  return {
    version:4,id,
    title:`${meta.team1Name} vs ${meta.team2Name} — ${meta.stageName}`,
    season:Number(meta.season)||2026,stage:meta.stage,
    stageName:meta.stageName,bracketKey:meta.bracketKey||"",
    team1Id:t1,team2Id:t2,team1Name:meta.team1Name,team2Name:meta.team2Name,
    maxOvers:overs,inningsNo:1,inningsHistory:[],
    superOver:null,winnerTeamId:"",winnerTeamName:"",resultText:"",
    status:"LIVE",statsRecorded:false,hatTricksRecorded:false,...inn
  };
}

function persistLocalState(){
  if(!state?.id)return;
  try{
    const safe=JSON.parse(JSON.stringify({...state,updatedAt:Date.now()}));
    localStorage.setItem(localKey(state.id),JSON.stringify(safe));
    localStorage.setItem("vcajActiveMatchId",state.id);
  }catch(e){console.warn("Local backup failed",e);}
}
function readLocalState(id){
  try{
    const x=localStorage.getItem(localKey(id));
    return x?JSON.parse(x):null;
  }catch(e){return null;}
}
function pendingEvents(){
  try{return JSON.parse(localStorage.getItem(pendingKey(state?.id))||"[]");}
  catch(e){return[];}
}
function writePendingEvents(list){
  if(state?.id)localStorage.setItem(pendingKey(state.id),JSON.stringify(list));
}
function queueEvent(ev){
  const list=pendingEvents();
  if(!list.some(x=>x.eventId===ev.eventId))list.push(ev);
  writePendingEvents(list);
}
function newEventId(){
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
}
function setNetworkBadge(){
  const el=$("syncStatus");
  if(!el)return;
  const pending=pendingEvents().length;
  el.textContent=!navigator.onLine
    ?`OFFLINE • Local backup ON${pending?` • ${pending} pending`:""}`
    :pending?`ONLINE • ${pending} pending sync`:"ONLINE • Saved to Firebase";
  el.className="pill "+(!navigator.onLine?"danger-pill":pending?"warn-pill":"ok-pill");
}
async function syncEvent(ev){
  try{
    await setDoc(doc(db,"matches",state.id,"events",ev.eventId),ev);
    return true;
  }catch(e){
    cloudOnline=false;queueEvent(ev);setNetworkBadge();return false;
  }
}
async function syncPending(){
  if(!state?.id||!navigator.onLine)return;
  const list=pendingEvents();
  if(!list.length){setNetworkBadge();return;}
  const remain=[];
  for(const ev of list){
    try{await setDoc(doc(db,"matches",state.id,"events",ev.eventId),ev);}
    catch(e){remain.push(ev);}
  }
  writePendingEvents(remain);
  cloudOnline=remain.length===0;
  setNetworkBadge();
  if(!remain.length)try{await save();}catch(e){}
}
async function safeCloudSave(){
  if(!state?.id)return false;
  persistLocalState();
  if(!navigator.onLine){
    cloudOnline=false;setNetworkBadge();return false;
  }
  try{
    const cloud={...state,updatedAt:serverTimestamp()};
    await setDoc(doc(db,"matches",state.id),cloud,{merge:true});
    await setDoc(doc(db,"liveMatches",state.id),cloud,{merge:true});
    cloudOnline=true;setNetworkBadge();return true;
  }catch(e){
    cloudOnline=false;setNetworkBadge();return false;
  }
}
async function save(){return safeCloudSave();}

window.addEventListener("online",()=>{cloudOnline=true;setNetworkBadge();syncPending();});
window.addEventListener("offline",()=>{cloudOnline=false;setNetworkBadge();});
setInterval(syncPending,15000);

function render(){
  if(!state)return;
  const target=Number(state.target||0);
  $("matchTitle").textContent=`${state.battingTeam} vs ${state.bowlingTeam}`;
  $("battingTeam").textContent=state.battingTeam||"—";
  $("score").textContent=`${state.score||0}/${state.wickets||0}`;
  $("oversText").textContent=`${ballsText(state.legalBalls)} / ${state.maxOvers||15} overs`;
  $("crr").textContent=`CRR ${state.legalBalls?(state.score/(state.legalBalls/6)).toFixed(2):"0.00"}`;

  const maxBalls=Number(state.maxOvers||15)*6;
  const rrr=target>0&&state.legalBalls<maxBalls
    ?(target-state.score)/((maxBalls-state.legalBalls)/6):0;
  $("rrr").textContent=target
    ?`Target ${target} • RRR ${Math.max(0,rrr).toFixed(2)}`:"Target —";

  const superText=state.superOver
    ?` • Super Over ${state.superOver.round||1}, Innings ${state.superOver.phase||1}`:"";
  $("matchMeta").textContent=
    `${state.season||2026} • ${state.stageName||"Match"} • ${state.status||"LIVE"}${superText}`;

  const ss=$("striker"),ns=$("nonStriker"),bw=$("bowler");
  ss.innerHTML=ns.innerHTML=bw.innerHTML="";
  (state.players||[]).forEach(p=>{
    const o=new Option(`${p.name}${p.out?" (OUT)":""}`,p.id);
    ss.add(o.cloneNode(true));ns.add(o.cloneNode(true));
  });
  (state.bowlers||[]).forEach(p=>bw.add(new Option(p.name,p.id)));
  ss.value=state.striker||"";ns.value=state.nonStriker||"";bw.value=state.bowler||"";
  $("batInfo").textContent=`${state.players?.find(p=>p.id===state.striker)?.runs||0} runs`;
  $("bowlInfo").textContent=`${state.bowlers?.find(p=>p.id===state.bowler)?.wickets||0} wicket(s)`;
  $("freeHitBadge").classList.toggle("hidden",!state.freeHit);

  $("bowlerChangeMsg").textContent=state.bowlerChangeRequired
    ?`ওভার শেষ — নতুন বোলার নির্বাচন করুন`
    :`${state.freeHit?"FREE HIT • ":""}বর্তমান বোলার: ${state.bowlers?.find(p=>p.id===state.bowler)?.name||""}`;

  $("battingCard").innerHTML=
    `<table><tr><th>ব্যাটার</th><th>R</th><th>B</th><th>4s</th><th>6s</th></tr>`+
    (state.players||[]).map(p=>
      `<tr><td>${esc(p.name)}${p.id===state.striker?" *":""}</td><td>${p.runs||0}</td><td>${p.balls||0}</td><td>${p.fours||0}</td><td>${p.sixes||0}</td></tr>`
    ).join("")+`</table>`;

  $("bowlingCard").innerHTML=
    `<table><tr><th>বোলার</th><th>O</th><th>R</th><th>W</th></tr>`+
    (state.bowlers||[]).map(p=>
      `<tr><td>${esc(p.name)}</td><td>${ballsText(p.balls)}</td><td>${p.runs||0}</td><td>${p.wickets||0}</td></tr>`
    ).join("")+`</table>`;

  $("commentary").innerHTML=(state.commentary||[]).slice(-60).reverse()
    .map(x=>`<div><b>${esc(x.over)}</b> — ${esc(x.text)}</div>`).join("");

  $("target").value=state.target||"";
  $("inningsNo").textContent=state.superOver
    ?`Super Over ${state.superOver.round||1} • Innings ${state.superOver.phase||1} of 2`
    :`Innings ${state.inningsNo} of 2`;

  const scoringActive=state.status==="LIVE"||state.status==="SUPER_OVER";
  const done=!scoringActive;
  const locked=done||!!state.bowlerChangeRequired;
  $("runButtons").querySelectorAll("button").forEach(b=>b.disabled=locked);
  document.querySelectorAll("[data-extra]").forEach(b=>b.disabled=locked);
  $("wicketBtn").disabled=locked;
  $("endInnings").disabled=done;
  $("startSecond").classList.toggle("hidden",
    state.status!=="INNINGS_BREAK"||state.inningsNo!==1);
  $("startSuper").classList.toggle("hidden",state.status!=="SUPER_OVER_READY");
  $("finishSuper").classList.toggle("hidden",state.status!=="SUPER_OVER");
  $("resultBox").classList.toggle("hidden",
    state.status!=="COMPLETED"&&state.status!=="SUPER_OVER_READY");
  $("resultText").textContent=state.resultText||"";
  setNetworkBadge();
}

function selectedBatter(id){return(state.players||[]).find(p=>p.id===id);}
function commentaryLang(){return $("commentaryLang")?.value||"bn";}

function buildDismissalText(type,batter,fielder){
  const lang=commentaryLang(),name=batter.name,f=fielder?.name||"";
  const bowler=state.bowlers.find(x=>x.id===state.bowler)?.name||"";
  if(lang==="en"){
    if(type==="caught")return `WICKET — ${name} c ${f} b ${bowler}`;
    if(type==="runOut")return `WICKET — ${name} Run Out by ${f}`;
    if(type==="stumped")return `WICKET — ${name} st ${f} b ${bowler}`;
    return `WICKET — ${name} ${dismissalNames[type]?.en||type}`;
  }
  if(type==="caught")return `উইকেট — ${name} ক্যাচ ${f}, বোলার ${bowler}`;
  if(type==="runOut")return `উইকেট — ${name} রান আউট, ফিল্ডার ${f}`;
  if(type==="stumped")return `উইকেট — ${name} স্টাম্পড ${f}, বোলার ${bowler}`;
  return `উইকেট — ${name} ${dismissalNames[type]?.bn||type}`;
}

function openWicketModal(){
  if(!state||!(state.status==="LIVE"||state.status==="SUPER_OVER"))return;
  const live=(state.players||[]).filter(p=>!p.out);
  $("dismissedBatter").innerHTML=live.map(p=>
    `<option value="${esc(p.id)}">${esc(p.name)}${p.id===state.striker?" (Striker)":""}</option>`
  ).join("");
  $("fielder").innerHTML=
    `<option value="">ফিল্ডার নির্বাচন করুন</option>`+
    (state.bowlers||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
  $("dismissedBatter").value=state.striker||live[0]?.id||"";
  updateFielderVisibility();
  $("wicketModal").classList.remove("hidden");
}
function closeWicketModal(){$("wicketModal").classList.add("hidden");}
function updateFielderVisibility(){
  const type=$("dismissalType")?.value;
  const need=["caught","runOut","stumped"].includes(type);
  $("fielderBox")?.classList.toggle("hidden",!need);
  if($("fielderLabel"))
    $("fielderLabel").firstChild.textContent=
      type==="stumped"?"Wicketkeeper / Fielder":
      type==="caught"?"Catcher / Fielder":"Fielder";
}

async function confirmWicket(){
  const batter=selectedBatter($("dismissedBatter").value);
  const type=$("dismissalType").value;
  const fielder=(state.bowlers||[]).find(x=>x.id===$("fielder").value);
  if(!batter){alert("আউট হওয়া ব্যাটার নির্বাচন করুন।");return;}
  if(["caught","runOut","stumped"].includes(type)&&!fielder){
    alert("এই dismissal-এর জন্য ফিল্ডার নির্বাচন করুন।");return;
  }
  if(state.freeHit&&bowlerWicketTypes.includes(type)){
    alert("FREE HIT-এ Bowled/Caught/LBW/Stumped/Hit Wicket আউট হবে না।");return;
  }
  closeWicketModal();
  await applyWicket(type,batter,fielder);
}

async function recordPlayerStats(event){
  const id=event.strikerId;if(!id)return;
  const ref=doc(db,"players",id),snap=await getDoc(ref);
  const cur=snap.exists()?snap.data():{id,name:event.batterName||id};
  await setDoc(ref,{
    ...cur,id,name:cur.name||event.batterName||id,
    totalRuns:(cur.totalRuns||0)+(event.batterRuns||0),
    totalBalls:(cur.totalBalls||0)+(event.legal?1:0),
    totalFours:(cur.totalFours||0)+(event.batterRuns===4?1:0),
    totalSixes:(cur.totalSixes||0)+(event.batterRuns===6?1:0)
  },{merge:true});
}
async function recordBowlerStats(event){
  const id=event.bowlerId;if(!id)return;
  const ref=doc(db,"players",id),snap=await getDoc(ref);
  const cur=snap.exists()?snap.data():{id,name:event.bowlerName||id};
  await setDoc(ref,{
    ...cur,id,name:cur.name||event.bowlerName||id,
    totalBowlingBalls:(cur.totalBowlingBalls||0)+(event.legal?1:0),
    totalBowlingRuns:(cur.totalBowlingRuns||0)+(event.bowlerRuns||0),
    totalWickets:(cur.totalWickets||0)+(event.bowlerWicket?1:0)
  },{merge:true});
}
async function recordFieldingStats(event){
  const id=event.fielderId;if(!id)return;
  const ref=doc(db,"players",id),snap=await getDoc(ref);
  const cur=snap.exists()?snap.data():{id,name:event.fielderName||id};
  const patch={
    ...cur,id,name:cur.name||event.fielderName||id,
    fieldingCatches:(cur.fieldingCatches||0)+(event.dismissalType==="caught"?1:0),
    fieldingStumpings:(cur.fieldingStumpings||0)+(event.dismissalType==="stumped"?1:0),
    fieldingRunOuts:(cur.fieldingRunOuts||0)+(event.dismissalType==="runOut"?1:0)
  };
  patch.fieldingDismissals=
    (patch.fieldingCatches||0)+(patch.fieldingStumpings||0)+(patch.fieldingRunOuts||0);
  await setDoc(ref,patch,{merge:true});
}

async function applyWicket(type,batter,fielder){
  if(!state||!(state.status==="LIVE"||state.status==="SUPER_OVER"))return;
  if(state.bowlerChangeRequired){alert("৬টি legal ball শেষ হয়েছে। আগে নতুন বোলার নির্বাচন করুন।");return;}
  if(state.freeHit&&bowlerWicketTypes.includes(type)){
    alert("FREE HIT-এ এই dismissal বৈধ নয়।");return;
  }
  const before=clone(state);
  const bowler=state.bowlers.find(x=>x.id===state.bowler);
  if(!bowler){alert("আগে বোলার নির্বাচন করুন।");return;}

  state.wickets++;
  batter.out=true;
  const credited=bowlerWicketTypes.includes(type);
  if(credited)bowler.wickets++;

  const legal=type!=="timedOut"&&type!=="retiredOut";
  if(legal){
    batter.balls++;state.legalBalls++;bowler.balls++;state.freeHit=false;
    if(state.legalBalls%6===0){state.bowlerChangeRequired=true;state.bowlerChangeFromId=bowler.id;}
  }

  if(batter.id===state.striker)
    state.striker=(state.players||[]).find(p=>!p.out&&p.id!==state.nonStriker)?.id||"";
  else if(batter.id===state.nonStriker)
    state.nonStriker=(state.players||[]).find(p=>!p.out&&p.id!==state.striker)?.id||"";

  const ev={
    eventId:newEventId(),type:"wicket",dismissalType:type,
    dismissedBatterId:batter.id,dismissedBatter:batter.name,
    fielderId:fielder?.id||"",fielderName:fielder?.name||"",
    batterName:batter.name,batterRuns:0,bowlerId:bowler.id,
    bowlerName:bowler.name,bowlerRuns:0,legal,bowlerWicket:credited,
    strikerId:batter.id,inningsNo:state.inningsNo,over:ballsText(before.legalBalls),
    text:buildDismissalText(type,batter,fielder),createdAt:new Date().toISOString()
  };

  state.commentary.push(ev);eventStack.push(before);persistLocalState();
  const synced=await syncEvent(ev);
  if(synced)try{await recordFieldingStats(ev);}catch(e){}
  await checkInningsEnd();await save();render();
}

async function apply(type,value=0){
  if(state.status!=="LIVE"&&state.status!=="SUPER_OVER")return;
  if(state.bowlerChangeRequired){alert("৬টি legal ball শেষ হয়েছে। আগে নতুন বোলার নির্বাচন করুন।");return;}

  const before=clone(state);
  const striker=selectedBatter(state.striker);
  const bowler=state.bowlers.find(x=>x.id===state.bowler);
  if(!striker||!bowler){alert("আগে ব্যাটার ও বোলার নির্বাচন করুন।");return;}

  let legal=true,batterRuns=0,extra=0,text="";
  if(type==="run"){
    batterRuns=value;text=value===4?"FOUR":value===6?"SIX":`${value} run`;
  }
  if(type==="wide"){legal=false;extra=1;state.extras.wide++;text="Wide";}
  if(type==="noBall"){
    const entered=prompt(
      "No-ball-এ ব্যাটে মেরে/দৌড়ে নেওয়া অতিরিক্ত রান কত? (শুধু অতিরিক্ত রান; ০ হলে 0 লিখুন)","0"
    );
    if(entered===null)return;
    const extraBatRuns=Number(entered);
    if(!Number.isInteger(extraBatRuns)||extraBatRuns<0||extraBatRuns>6){
      alert("০ থেকে ৬-এর মধ্যে পূর্ণসংখ্যা দিন।");return;
    }
    legal=false;extra=1;batterRuns=extraBatRuns;state.extras.noBall++;
    state.freeHit=true;text=`NO BALL + ${extraBatRuns} run${extraBatRuns===1?"":"s"} • FREE HIT`;
  }
  if(type==="bye"){extra=value;state.extras.bye+=value;text=`Bye ${value}`;}
  if(type==="legBye"){extra=value;state.extras.legBye+=value;text=`Leg bye ${value}`;}

  state.score+=batterRuns+extra;
  striker.runs+=batterRuns;
  if(legal)striker.balls++;
  if(batterRuns===4)striker.fours++;
  if(batterRuns===6)striker.sixes++;
  bowler.runs+=batterRuns+((type==="wide"||type==="noBall")?1:0);

  if(legal){
    state.legalBalls++;bowler.balls++;state.freeHit=false;
    if(state.legalBalls%6===0){state.bowlerChangeRequired=true;state.bowlerChangeFromId=bowler.id;}
  }
  if((batterRuns+extra)%2===1)
    [state.striker,state.nonStriker]=[state.nonStriker,state.striker];
  if(legal&&state.legalBalls%6===0)
    [state.striker,state.nonStriker]=[state.nonStriker,state.striker];

  const bowlerRuns=type==="wide"?1:
    type==="noBall"?1+batterRuns:
    (type==="bye"||type==="legBye"?0:batterRuns);

  const ev={
    eventId:newEventId(),type,batterRuns,bowlerRuns,legal,
    strikerId:striker.id,batterName:striker.name,bowlerId:bowler.id,
    bowlerName:bowler.name,inningsNo:state.inningsNo,
    over:ballsText(before.legalBalls),text,createdAt:new Date().toISOString()
  };

  state.commentary.push(ev);eventStack.push(before);persistLocalState();
  const synced=await syncEvent(ev);
  if(synced){
    try{await recordPlayerStats(ev);}catch(e){}
    try{await recordBowlerStats(ev);}catch(e){}
  }
  await checkInningsEnd();await save();render();
}

function snapshotCurrent(){
  return {
    inningsNo:state.inningsNo,battingTeamId:state.battingTeamId,
    battingTeam:state.battingTeam,bowlingTeamId:state.bowlingTeamId,
    bowlingTeam:state.bowlingTeam,score:state.score,wickets:state.wickets,
    legalBalls:state.legalBalls,maxOvers:state.maxOvers,target:state.target,
    extras:state.extras,players:state.players,bowlers:state.bowlers,
    commentary:state.commentary,status:state.status
  };
}

/* Super Over is deliberately handled separately from normal innings.
   A Super Over innings ends at 6 legal balls OR 2 wickets.
   The chasing side also ends immediately when it passes the target. */
async function checkInningsEnd(){
  if(!state)return;

  if(state.superOver){
    const so=state.superOver;
    const target=Number(state.target||so.target||0);
    const maxBalls=6;
    const allOut=state.wickets>=2;
    const targetReached=state.inningsNo===2&&target>0&&state.score>=target;

    if(targetReached){
      so.scores[state.battingTeamId]=state.score;
      state.status="COMPLETED";
      state.winnerTeamId=state.battingTeamId;
      state.winnerTeamName=state.battingTeam;
      state.resultText=`${state.battingTeam} won the Super Over (${state.score}–${Math.max(0,target-1)})`;
      await finalizeTournament();return;
    }

    if(state.legalBalls>=maxBalls||allOut){
      await finishSuperOverInnings();return;
    }
    return;
  }

  const maxBalls=Number(state.maxOvers||15)*6;
  const allOut=state.wickets>=Math.max(1,(state.players||[]).length-1);
  const targetReached=state.target>0&&state.score>=state.target;

  if(targetReached){
    state.status="COMPLETED";
    state.winnerTeamId=state.battingTeamId;
    state.winnerTeamName=state.battingTeam;
    state.resultText=`${state.battingTeam} won by ${Math.max(1,(state.players||[]).length-state.wickets)} wicket(s)`;
    await finalizeTournament();return;
  }

  if(state.legalBalls>=maxBalls||allOut){
    if(state.inningsNo===1){
      state.status="INNINGS_BREAK";return;
    }

    state.status="COMPLETED";
    if(state.score>state.target-1){
      state.winnerTeamId=state.battingTeamId;
      state.winnerTeamName=state.battingTeam;
      state.resultText=`${state.battingTeam} won by ${state.score-(state.target-1)} run(s)`;
    }else if(state.score===state.target-1){
      state.status="SUPER_OVER_READY";
      state.resultText="Match tied — Super Over required";
    }else{
      state.winnerTeamId=state.bowlingTeamId;
      state.winnerTeamName=state.bowlingTeam;
      state.resultText=`${state.bowlingTeam} won by ${Math.max(1,(state.target-1)-state.score)} run(s)`;
    }
    if(state.status==="COMPLETED")await finalizeTournament();
  }
}

async function startSecondInnings(){
  if(state.status!=="INNINGS_BREAK"||state.inningsNo!==1)return;
  state.inningsHistory=[...(state.inningsHistory||[]),snapshotCurrent()];
  const batList=players.filter(p=>p.teamId===state.team2Id);
  const bowlList=players.filter(p=>p.teamId===state.team1Id);
  const inn=makeInnings(
    state.team2Id,state.team2Name,state.team1Id,state.team1Name,
    batList,bowlList,state.maxOvers,state.score+1,2,false
  );
  Object.assign(state,inn);state.status="LIVE";state.inningsNo=2;
  await save();render();
}

async function startSuperOver(){
  if(state.status!=="SUPER_OVER_READY")return;

  const previousHistory=[...(state.superOver?.history||[])];
  const round=(state.superOver?.round||0)+1;

  const batList=players.filter(p=>p.teamId===state.team1Id);
  const bowlList=players.filter(p=>p.teamId===state.team2Id);
  const inn=makeInnings(
    state.team1Id,state.team1Name,state.team2Id,state.team2Name,
    batList,bowlList,1,0,1,true
  );
  Object.assign(state,inn);
  state.superOver={
    round,phase:1,
    scores:{[state.team1Id]:0,[state.team2Id]:0},
    balls:6,target:0,history:previousHistory
  };
  state.status="SUPER_OVER";
  state.inningsNo=1;
  state.commentary=[{
    over:"SUPER",
    text:`Super Over ${round} শুরু — ${state.team1Name} ব্যাটিং`,
    createdAt:new Date().toISOString()
  }];
  await save();render();
}

async function finishSuperOverInnings(){
  const so=state.superOver;
  if(!so)return;

  so.scores[state.battingTeamId]=state.score;
  state.inningsHistory=[...(state.inningsHistory||[]),snapshotCurrent()];

  if(so.phase===1){
    const firstScore=state.score;
    so.phase=2;
    so.target=firstScore+1;

    const batList=players.filter(p=>p.teamId===state.team2Id);
    const bowlList=players.filter(p=>p.teamId===state.team1Id);
    const inn=makeInnings(
      state.team2Id,state.team2Name,state.team1Id,state.team1Name,
      batList,bowlList,1,firstScore+1,2,true
    );
    Object.assign(state,inn);
    state.superOver=so;
    state.status="SUPER_OVER";
    state.inningsNo=2;
    state.commentary=[{
      over:"SUPER",
      text:`Super Over ${so.round} — ${state.team2Name} ব্যাটিং • Target ${firstScore+1}`,
      createdAt:new Date().toISOString()
    }];
    await save();render();return;
  }

  const a=Number(so.scores[state.team1Id]||0);
  const b=Number(so.scores[state.team2Id]||0);

  so.history=[...(so.history||[]),{
    round:so.round,team1Score:a,team2Score:b
  }];

  if(a===b){
    state.status="SUPER_OVER_READY";
    state.resultText=`Super Over ${so.round} tied — start another Super Over`;
    state.superOver={
      round:so.round,phase:0,
      scores:{[state.team1Id]:a,[state.team2Id]:b},
      balls:6,target:0,history:so.history
    };
    await save();render();return;
  }

  state.status="COMPLETED";
  state.winnerTeamId=a>b?state.team1Id:state.team2Id;
  state.winnerTeamName=a>b?state.team1Name:state.team2Name;
  state.resultText=
    `${state.winnerTeamName} won the Super Over (${Math.max(a,b)}–${Math.min(a,b)})`;
  await finalizeTournament();await save();render();
}

/* Writes one match-level statistical summary. Per-event player totals are
   already maintained by recordPlayerStats/recordBowlerStats, so this function
   intentionally does not add them a second time. */
async function recordMatchStatsOnce(){
  if(state.statsRecorded)return;
  let events=[];
  try{
    const snap=await getDocs(collection(db,"matches",state.id,"events"));
    events=snap.docs.map(d=>d.data());
  }catch(e){return;}

  const by={};
  const ensure=id=>by[id] ||= {
    runs:0,balls:0,fours:0,sixes:0,wickets:0,
    bowlingBalls:0,bowlingRuns:0,catches:0,stumpings:0,runOuts:0
  };

  events.forEach(e=>{
    if(e.strikerId){
      const x=ensure(e.strikerId);
      x.runs+=e.batterRuns||0;x.balls+=e.legal?1:0;
      x.fours+=e.batterRuns===4?1:0;x.sixes+=e.batterRuns===6?1:0;
    }
    if(e.bowlerId){
      const x=ensure(e.bowlerId);
      x.bowlingBalls+=e.legal?1:0;x.bowlingRuns+=e.bowlerRuns||0;
      x.wickets+=e.bowlerWicket?1:0;
    }
    if(e.fielderId){
      const x=ensure(e.fielderId);
      x.catches+=e.dismissalType==="caught"?1:0;
      x.stumpings+=e.dismissalType==="stumped"?1:0;
      x.runOuts+=e.dismissalType==="runOut"?1:0;
    }
  });

  await setDoc(doc(db,"matches",state.id),{
    matchStats:by,statsRecorded:true
  },{merge:true});
  state.statsRecorded=true;
}

async function recordHatTricksOnce(){
  if(state.hatTricksRecorded)return;

  let evs=[];
  try{
    const snap=await getDocs(collection(db,"matches",state.id,"events"));
    evs=snap.docs.map(d=>d.data())
      .sort((a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
  }catch(e){return;}

  const hat={bowler:[],batter:[],fielder:[]};
  let bowlerRun=0,bowlerId="";
  let batterRun=0,batterId="";
  let fieldRun=0,fieldId="";

  for(const e of evs){
    if(e.type==="wicket"){
      const legal=e.legal!==false;
      const credited=!!e.bowlerWicket;

      if(legal){
        if(credited&&e.bowlerId===bowlerId)bowlerRun++;
        else if(credited){bowlerId=e.bowlerId;bowlerRun=1;}
        else {bowlerId=e.bowlerId||"";bowlerRun=0;}
        if(bowlerRun===3){
          hat.bowler.push({
            playerId:e.bowlerId,playerName:e.bowlerName||e.bowlerId,
            over:e.over||"",inningsNo:e.inningsNo||1
          });
          bowlerRun=0;
        }
      }

      if(e.fielderId){
        if(e.fielderId===fieldId)fieldRun++;
        else {fieldId=e.fielderId;fieldRun=1;}
        if(fieldRun===3){
          hat.fielder.push({
            playerId:e.fielderId,playerName:e.fielderName||e.fielderId,
            over:e.over||"",inningsNo:e.inningsNo||1
          });
          fieldRun=0;
        }
      }else{fieldId="";fieldRun=0;}
    }else if(e.legal){
      if(e.strikerId===batterId&&(e.batterRuns===4||e.batterRuns===6))batterRun++;
      else{
        batterId=e.strikerId||"";
        batterRun=(e.batterRuns===4||e.batterRuns===6)?1:0;
      }
      if(batterRun===3){
        hat.batter.push({
          playerId:e.strikerId,playerName:e.batterName||e.strikerId,
          over:e.over||"",inningsNo:e.inningsNo||1
        });
        batterRun=0;
      }
      if(e.bowlerId!==bowlerId){bowlerId=e.bowlerId||"";bowlerRun=0;}
    }
  }

  for(const type of ["bowler","batter","fielder"]){
    for(const h of hat[type]){
      const ref=doc(db,"players",h.playerId),ps=await getDoc(ref);
      const cur=ps.exists()?ps.data():{id:h.playerId,name:h.playerName};
      const key=type==="bowler"?"bowlingHatTricks":
        type==="batter"?"battingHatTricks":"fieldingHatTricks";
      await setDoc(ref,{
        ...cur,id:h.playerId,name:cur.name||h.playerName,
        [key]:(cur[key]||0)+1
      },{merge:true});
    }
  }

  await setDoc(doc(db,"matches",state.id),{
    hatTricks:hat,hatTricksRecorded:true
  },{merge:true});
  state.hatTricksRecorded=true;state.hatTricks=hat;
}

async function finalizeTournament(){
  if(!state.winnerTeamId)return;
  await recordMatchStatsOnce();
  await recordHatTricksOnce();

  const ref=doc(db,"tournaments",String(state.season));
  const snap=await getDoc(ref);
  const t=snap.exists()?snap.data():{
    season:state.season,slots:Array(16).fill(""),winners:{},matchIds:{}
  };
  const winners={...(t.winners||{})};
  const matchIds={...(t.matchIds||{})};

  if(state.bracketKey){
    winners[state.bracketKey]=state.winnerTeamId;
    matchIds[state.bracketKey]=state.id;
  }
  if(state.stage==="FINAL")t.championTeamId=state.winnerTeamId;
  t.winners=winners;t.matchIds=matchIds;
  await setDoc(ref,t,{merge:true});
}

async function undo(){
  const prev=eventStack.pop();
  if(!prev){alert("এই session-এ undo করার মতো event নেই");return;}
  state=prev;await save();render();
}

async function loadSetupData(){
  const [ts,ps]=await Promise.all([
    getDocs(collection(db,"teams")),
    getDocs(collection(db,"players"))
  ]);
  teams=ts.docs.map(d=>({id:d.id,...d.data()}))
    .sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  players=ps.docs.map(d=>({id:d.id,...d.data()}))
    .sort((a,b)=>(a.name||"").localeCompare(b.name||""));

  const opts=teams.map(t=>
    `<option value="${esc(t.id)}">${esc(t.name)}${t.shortName?` (${esc(t.shortName)})`:""}</option>`
  ).join("");
  $("team1").innerHTML=`<option value="">প্রথম দল</option>${opts}`;
  $("team2").innerHTML=`<option value="">দ্বিতীয় দল</option>${opts}`;
}

async function createMatch(){
  const t1=$("team1").value,t2=$("team2").value;
  if(!t1||!t2||t1===t2){
    $("setupMsg").textContent="দুটি আলাদা দল নির্বাচন করুন।";return;
  }
  const overs=oversValue();
  if(!overs||overs<1||overs>50){
    $("setupMsg").textContent="Overs 1–50 এর মধ্যে দিন।";return;
  }

  const season=Number($("season").value||2026);
  const stage=$("stage").value;
  const bracketKey=$("bracketKey").value.trim();
  const a=teams.find(t=>t.id===t1),b=teams.find(t=>t.id===t2);
  const p1=players.filter(p=>p.teamId===t1),p2=players.filter(p=>p.teamId===t2);

  if(p1.length<2||p2.length<2){
    $("setupMsg").textContent="দুই দলে অন্তত ২ জন করে খেলোয়াড় প্রয়োজন.";return;
  }

  let id=$("matchId").value.trim();
  if(!id)id=`${season}-${stage.toLowerCase()}-${slug(a.name)}-${slug(b.name)}`;

  const m=newMatch(id,t1,t2,overs,p1,p2,{
    season,stage,stageName:stageNames[stage]||stage,
    team1Name:a.name,team2Name:b.name,bracketKey
  });

  await setDoc(doc(db,"matches",id),m);
  await setDoc(doc(db,"liveMatches",id),m);
  state=m;eventStack=[];
  localStorage.setItem("vcajActiveMatchId",id);
  $("activeMatchId").value=id;
  attachMatchListener(id);
  render();
  $("setupMsg").textContent=`${id} তৈরি হয়েছে।`;
}

function attachMatchListener(id){
  if(unsub)unsub();
  unsub=onSnapshot(doc(db,"matches",id),s=>{
    if(s.exists()){
      const remote=s.data();
      state=remote;render();
    }
  });
}

async function loadMatch(){
  const id=$("activeMatchId").value.trim();
  if(!id){alert("Match ID দিন।");return;}

  try{
    const snap=await getDoc(doc(db,"matches",id));
    if(snap.exists()){
      state=snap.data();eventStack=[];attachMatchListener(id);render();return;
    }
  }catch(e){}

  const local=readLocalState(id);
  if(local){
    state=local;eventStack=[];render();
    $("setupMsg").textContent="Firebase match পাওয়া যায়নি; Local backup থেকে match load হয়েছে।";
    return;
  }
  alert("এই Match ID-এর match পাওয়া যায়নি।");
}

function applyQueryParams(){
  const q=new URLSearchParams(location.search);
  if(q.get("stage"))$("stage").value=q.get("stage");
  if(q.get("bracket"))$("bracketKey").value=q.get("bracket");
  if(q.get("t1"))$("team1").value=q.get("t1");
  if(q.get("t2"))$("team2").value=q.get("t2");
  if(q.get("match"))$("activeMatchId").value=q.get("match");
}

$("overs").onchange=()=>$("customOvers").classList.toggle("hidden",$("overs").value!=="custom");
$("refreshSetup").onclick=loadSetupData;
$("createMatch").onclick=createMatch;
$("loadMatch").onclick=loadMatch;

$("runButtons").querySelectorAll("[data-run]").forEach(b=>{
  b.onclick=()=>apply("run",Number(b.dataset.run));
});
document.querySelectorAll("[data-extra]").forEach(b=>{
  b.onclick=()=>apply(b.dataset.extra,Number(b.dataset.value||1));
});

$("wicketBtn").onclick=openWicketModal;
$("cancelWicket").onclick=closeWicketModal;
$("confirmWicket").onclick=confirmWicket;
$("dismissalType").onchange=updateFielderVisibility;
$("undoBtn").onclick=undo;

$("striker").onchange=()=>{if(state){state.striker=$("striker").value;save();render();}};
$("nonStriker").onchange=()=>{if(state){state.nonStriker=$("nonStriker").value;save();render();}};
$("bowler").onchange=()=>{
  if(!state)return;
  if(state.bowlerChangeRequired){
    const previous=state.bowlerChangeFromId||state.bowler;
    if($("bowler").value===previous){
      alert("আগের বোলারকে আবার নির্বাচন করা যাবে না।");render();return;
    }
    state.bowlerChangeRequired=false;
  }
  state.bowler=$("bowler").value;save();render();
};
$("target").onchange=()=>{if(state){state.target=Number($("target").value||0);save();render();}};

$("startSecond").onclick=startSecondInnings;
$("startSuper").onclick=startSuperOver;
$("finishSuper").onclick=async()=>{
  if(!state?.superOver)return;
  if(!confirm("Super Over innings এখনই শেষ করতে চান?"))return;
  await finishSuperOverInnings();
};

$("endInnings").onclick=async()=>{
  if(!state)return;
  const maxBalls=Number(state.maxOvers||15)*6;
  if(state.legalBalls<maxBalls && state.wickets<Math.max(1,(state.players||[]).length-1)
     && !state.superOver){
    if(!confirm("Innings এখনো শেষ হয়নি। তবুও End করতে চান?"))return;
  }
  await checkInningsEnd();await save();render();
};

$("backupBtn").onclick=()=>{
  if(!state?.id){alert("আগে Match Load/Create করুন");return;}
  persistLocalState();
  const payload={
    version:2,exportedAt:new Date().toISOString(),
    match:state,pendingEvents:pendingEvents()
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`VIVEKANANDA CRICKET ASSOCIATION OF JELIAKHALI-${state.id}-backup.json`;
  a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};

/* Initial load */
await loadSetupData();
applyQueryParams();

const saved=localStorage.getItem("vcajActiveMatchId");
const qMatch=new URLSearchParams(location.search).get("match");
const firstId=qMatch||$("activeMatchId").value.trim()||saved;

if(firstId){
  $("activeMatchId").value=firstId;
  try{
    const snap=await getDoc(doc(db,"matches",firstId));
    if(snap.exists()){
      state=snap.data();attachMatchListener(firstId);render();
    }else{
      const local=readLocalState(firstId);
      if(local){state=local;render();}
    }
  }catch(e){
    const local=readLocalState(firstId);
    if(local){state=local;render();}
  }
}
setNetworkBadge();
