import {auth,db,isAdmin,collection,doc,getDoc,getDocs,setDoc,addDoc,updateDoc,deleteDoc,onSnapshot,serverTimestamp,signInWithEmailAndPassword,signOut,onAuthStateChanged} from "./firebase.js";
const $=id=>document.getElementById(id); let state=null,unsub=null,eventStack=[]; let teams=[],players=[],members=[]; let editingMemberId="";
const stageNames={R16:"Round of 16",QF:"Quarter Final",SF:"Semi Final",FINAL:"Final",PRACTICE:"Practice Match",CUSTOM:"Custom"};
const bowlerWicketTypes=["bowled","caught","lbw","stumped","hitWicket"];
const dismissalNames={bowled:{bn:"বোল্ড",en:"Bowled"},caught:{bn:"ক্যাচ আউট",en:"Caught"},lbw:{bn:"LBW",en:"LBW"},runOut:{bn:"রান আউট",en:"Run Out"},stumped:{bn:"স্টাম্পড",en:"Stumped"},hitWicket:{bn:"হিট উইকেট",en:"Hit Wicket"},obstructing:{bn:"ফিল্ডে বাধা",en:"Obstructing the Field"},hitTwice:{bn:"দুবার বল মারা",en:"Hit the Ball Twice"},timedOut:{bn:"টাইমড আউট",en:"Timed Out"},retiredOut:{bn:"রিটায়ার্ড আউট",en:"Retired Out"}};
const slug=s=>(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,35);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
function ballsText(n){return `${Math.floor((n||0)/6)}.${(n||0)%6}`;}
function oversValue(){const v=$("overs").value;return v==="custom"?Number($("customOvers").value||15):Number(v);}
function clone(x){return JSON.parse(JSON.stringify(x));}
function makePlayers(list,teamId){return list.map(p=>({id:p.id,name:p.name,runs:0,balls:0,fours:0,sixes:0,out:false,teamId}));}
function makeBowlers(list,teamId){return list.map(p=>({id:p.id,name:p.name,balls:0,runs:0,wickets:0,teamId,fieldingCatches:0,fieldingStumpings:0,fieldingRunOuts:0}));}
function makeInnings(battingTeamId,battingTeam,bowlingTeamId,bowlingTeam,batList,bowlList,maxOvers,target=0,number=1,superOver=false){const p=makePlayers(batList,battingTeamId),b=makeBowlers(bowlList,bowlingTeamId);return {inningsNo:number,battingTeamId,battingTeam,bowlingTeamId,bowlingTeam,score:0,wickets:0,legalBalls:0,maxOvers,target,powerplayRuns:0,players:p,bowlers:b,striker:p[0]?.id||"",nonStriker:p[1]?.id||"",bowler:b[0]?.id||"",freeHit:false,bowlerChangeRequired:false,bowlerChangeFromId:"",extras:{wide:0,noBall:0,bye:0,legBye:0},commentary:[],status:"LIVE"};}
function newMatch(id,t1,t2,overs,team1Players,team2Players,meta){const inn=makeInnings(t1,meta.team1Name,t2,meta.team2Name,team1Players,team2Players,overs,0,1,false);return {version:3,id,title:`${meta.team1Name} vs ${meta.team2Name} — ${meta.stageName}`,season:Number(meta.season)||2026,stage:meta.stage,stageName:meta.stageName,bracketKey:meta.bracketKey||"",team1Id:t1,team2Id:t2,team1Name:meta.team1Name,team2Name:meta.team2Name,maxOvers:overs,powerplay:{enabled:!!meta.powerplay?.enabled,startOver:Number(meta.powerplay?.startOver||1),endOver:Number(meta.powerplay?.endOver||6)},inningsNo:1,inningsHistory:[],superOver:null,superOverHistory:[],winnerTeamId:"",winnerTeamName:"",resultText:"",status:"LIVE",...inn};}
function isPowerplayBall(match,legalBallsBefore){const pp=match?.powerplay;if(match?.superOver||!pp?.enabled)return false;const overNo=Math.floor(Number(legalBallsBefore||0)/6)+1;return overNo>=Number(pp.startOver||1)&&overNo<=Number(pp.endOver||6);}
function powerplayLabel(){if(!state?.powerplay?.enabled)return "OFF";const pp=state.powerplay;const overNo=Math.floor(Number(state.legalBalls||0)/6)+1;if(overNo<Number(pp.startOver||1))return `Starts O${pp.startOver}`;if(overNo<=Number(pp.endOver||6))return `ON • O${overNo}`;return "OVER";}
function current(){return state;}
const LOCAL_PREFIX='vcaj_match_backup_v1_';
const PENDING_PREFIX='vcaj_pending_events_v1_';
let cloudOnline=navigator.onLine;
function localKey(id){return LOCAL_PREFIX+String(id||'unknown');}
function pendingKey(id){return PENDING_PREFIX+String(id||'unknown');}
function persistLocalState(){
  if(!state?.id)return;
  try{
    const safe=JSON.parse(JSON.stringify({...state,updatedAt:Date.now()}));
    localStorage.setItem(localKey(state.id),JSON.stringify(safe));
    localStorage.setItem('vcajActiveMatchId',state.id);
  }catch(e){console.warn('Local backup failed',e);}
}
function readLocalState(id){try{const x=localStorage.getItem(localKey(id));return x?JSON.parse(x):null;}catch(e){return null;}}
function pendingEvents(){try{return JSON.parse(localStorage.getItem(pendingKey(state?.id))||'[]');}catch(e){return[];}}
function writePendingEvents(list){if(state?.id)localStorage.setItem(pendingKey(state.id),JSON.stringify(list));}
function queueEvent(ev){const list=pendingEvents();if(!list.some(x=>x.eventId===ev.eventId))list.push(ev);writePendingEvents(list);}
function newEventId(){return `evt-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;}
function setNetworkBadge(){
  let el=document.getElementById('syncStatus');
  if(!el)return;
  const pending=pendingEvents().length;
  el.textContent=!navigator.onLine?`OFFLINE • Local backup ON${pending?` • ${pending} pending`:''}`:pending?`ONLINE • ${pending} pending sync`:'ONLINE • Saved to Firebase';
  el.className='pill '+(!navigator.onLine?'danger-pill':pending?'warn-pill':'ok-pill');
}
async function syncEvent(ev){
  try{await setDoc(doc(db,'matches',state.id,'events',ev.eventId),ev);return true;}catch(e){cloudOnline=false;queueEvent(ev);setNetworkBadge();return false;}
}
async function syncPending(){
  if(!state?.id||!navigator.onLine)return;
  const list=pendingEvents();if(!list.length){setNetworkBadge();return;}
  const remain=[];
  for(const ev of list){try{await setDoc(doc(db,'matches',state.id,'events',ev.eventId),ev);}catch(e){remain.push(ev);}}
  writePendingEvents(remain);cloudOnline=remain.length===0;setNetworkBadge();
  if(!remain.length){try{await save();}catch(e){}}
}
async function safeCloudSave(){
  if(!state?.id)return false;
  persistLocalState();
  if(!navigator.onLine){cloudOnline=false;setNetworkBadge();return false;}
  try{
    const cloud={...state,updatedAt:serverTimestamp()};
    await setDoc(doc(db,'matches',state.id),cloud,{merge:true});
    await setDoc(doc(db,'liveMatches',state.id),cloud,{merge:true});
    cloudOnline=true;setNetworkBadge();return true;
  }catch(e){cloudOnline=false;setNetworkBadge();return false;}
}
window.addEventListener('online',()=>{cloudOnline=true;setNetworkBadge();syncPending();});
window.addEventListener('offline',()=>{cloudOnline=false;setNetworkBadge();});
setInterval(()=>{syncPending();},15000);
function render(){if(!state)return;const target=Number(state.target||0);$("matchTitle").textContent=`${state.battingTeam} vs ${state.bowlingTeam}`;$("battingTeam").textContent=state.battingTeam;$("score").textContent=`${state.score||0}/${state.wickets||0}`;$("oversText").textContent=`${ballsText(state.legalBalls)} / ${state.maxOvers||15} overs`;$("crr").textContent=`CRR ${state.legalBalls?(state.score/(state.legalBalls/6)).toFixed(2):"0.00"}`;const rrr=target>0&&state.legalBalls<Number(state.maxOvers||15)*6?((target-state.score)/((Number(state.maxOvers||15)*6-state.legalBalls)/6)):0;$("rrr").textContent=target?`Target ${target} • RRR ${Math.max(0,rrr).toFixed(2)}`:`Target —`;$("matchMeta").textContent=`${state.season||2026} • ${state.stageName||"Match"} • ${state.status||"LIVE"}`;
 const ss=$("striker"),ns=$("nonStriker"),bw=$("bowler");ss.innerHTML=ns.innerHTML=bw.innerHTML="";(state.players||[]).forEach(p=>{const o=new Option(`${p.name}${p.out?" (OUT)":""}`,p.id);ss.add(o.cloneNode(true));ns.add(o.cloneNode(true));});(state.bowlers||[]).forEach(p=>bw.add(new Option(p.name,p.id)));ss.value=state.striker;ns.value=state.nonStriker;bw.value=state.bowler;$("batInfo").textContent=`${state.players?.find(p=>p.id===state.striker)?.runs||0} runs`;$("bowlInfo").textContent=`${state.bowlers?.find(p=>p.id===state.bowler)?.wickets||0} wicket(s)`;$("freeHitBadge").classList.toggle("hidden",!state.freeHit);$("bowlerChangeMsg").textContent=state.bowlerChangeRequired?`ওভার শেষ — নতুন বোলার নির্বাচন করুন (আগের: ${state.bowlers?.find(p=>p.id===state.bowler)?.name||""})`:`${state.freeHit?"FREE HIT • ":""}বর্তমান বোলার: ${state.bowlers?.find(p=>p.id===state.bowler)?.name||""}`;
 $("battingCard").innerHTML=`<table><tr><th>ব্যাটার</th><th>R</th><th>B</th><th>4s</th><th>6s</th></tr>${(state.players||[]).map(p=>`<tr><td>${esc(p.name)}${p.id===state.striker?" *":""}</td><td>${p.runs||0}</td><td>${p.balls||0}</td><td>${p.fours||0}</td><td>${p.sixes||0}</td></tr>`).join("")}</table>`;
 $("bowlingCard").innerHTML=`<table><tr><th>বোলার</th><th>O</th><th>R</th><th>W</th></tr>${(state.bowlers||[]).map(p=>`<tr><td>${esc(p.name)}</td><td>${ballsText(p.balls)}</td><td>${p.runs||0}</td><td>${p.wickets||0}</td></tr>`).join("")}</table>`;
 $("commentary").innerHTML=(state.commentary||[]).slice(-40).reverse().map(x=>`<div><b>${esc(x.over)}</b> — ${esc(x.text)}</div>`).join("");
 $("target").value=state.target||"";$("inningsNo").textContent=state.superOver?`Super Over${state.superOver?.number?` ${state.superOver.number}`:""} • Innings ${state.inningsNo}`:`Innings ${state.inningsNo} of 2`;if($("powerplayStatus"))$("powerplayStatus").textContent=powerplayLabel();if($("powerplayRuns"))$("powerplayRuns").textContent=state.powerplay?.enabled&&!state.superOver?`PP Runs: ${Number(state.powerplayRuns||0)} • Overs ${state.powerplay.startOver}-${state.powerplay.endOver}`:"Powerplay disabled";
 if(state.status==="SUPER_OVER"&&state.superOver)state.status="LIVE";if(state.striker&&state.striker===state.nonStriker){const o=(state.players||[]).find(p=>p.id!==state.striker&&!p.out);if(o)state.nonStriker=o.id}
 const done=state.status!=="LIVE",scoringLocked=done||!!state.bowlerChangeRequired;$("runButtons").querySelectorAll("button").forEach(b=>b.disabled=scoringLocked);document.querySelectorAll("[data-extra]").forEach(b=>b.disabled=scoringLocked);$("wicketBtn").disabled=scoringLocked;$("endInnings").disabled=done;$("startSecond").classList.toggle("hidden",state.status!=="INNINGS_BREAK"||state.inningsNo!==1);$("startSuper").classList.toggle("hidden",state.status!=="SUPER_OVER_READY");$("finishSuper").classList.toggle("hidden",!(state.status==="LIVE"&&!!state.superOver));$("resultBox").classList.toggle("hidden",state.status!=="COMPLETED"&&state.status!=="SUPER_OVER_READY");$("resultText").textContent=state.resultText||"";
}
async function save(){return safeCloudSave();}
function selectedBatter(id){return (state.players||[]).find(p=>p.id===id);}
function commentaryLang(){return $("commentaryLang")?.value||"bn";}
function buildDismissalText(type,batter,fielder){const lang=commentaryLang(),name=batter.name,f=fielder?.name||"",bowler=state.bowlers.find(x=>x.id===state.bowler)?.name||"";if(lang==="en"){if(type==="caught")return `WICKET — ${name} c ${f} b ${bowler}`;if(type==="runOut")return `WICKET — ${name} Run Out by ${f}`;if(type==="stumped")return `WICKET — ${name} st ${f} b ${bowler}`;return `WICKET — ${name} ${dismissalNames[type]?.en||type}`;}if(type==="caught")return `উইকেট — ${name} ক্যাচ ${f}, বোলার ${bowler}`;if(type==="runOut")return `উইকেট — ${name} রান আউট, ফিল্ডার ${f}`;if(type==="stumped")return `উইকেট — ${name} স্টাম্পড ${f}, বোলার ${bowler}`;return `উইকেট — ${name} ${dismissalNames[type]?.bn||type}`;}
function openWicketModal(){if(!state||state.status!=="LIVE")return;const live=(state.players||[]).filter(p=>!p.out);$("dismissedBatter").innerHTML=live.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.id===state.striker?" (Striker)":""}</option>`).join("");$("fielder").innerHTML=`<option value="">ফিল্ডার নির্বাচন করুন</option>`+(state.bowlers||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");$("dismissedBatter").value=state.striker||live[0]?.id||"";updateFielderVisibility();$("wicketModal").classList.remove("hidden");}
function closeWicketModal(){$("wicketModal").classList.add("hidden");}
function updateFielderVisibility(){const type=$("dismissalType")?.value,need=["caught","runOut","stumped"].includes(type);const box=$("fielderBox"),label=$("fielderLabel"),select=$("fielder");if(box)box.classList.toggle("hidden",!need);if(label)label.textContent=type==="stumped"?"Wicketkeeper / Fielder":type==="caught"?"Catcher / Fielder":"Fielder";if(select){select.required=need;if(!need)select.value="";}}
async function confirmWicket(){const batter=selectedBatter($("dismissedBatter").value),type=$("dismissalType").value,fielder=(state.bowlers||[]).find(x=>x.id===$("fielder").value);if(!batter){alert("আউট হওয়া ব্যাটার নির্বাচন করুন।");return;}if(["caught","runOut","stumped"].includes(type)&&!fielder){alert("এই dismissal-এর জন্য ফিল্ডার নির্বাচন করুন।");return;}if(state.freeHit&&bowlerWicketTypes.includes(type)){alert("FREE HIT-এ Bowled/Caught/LBW/Stumped/Hit Wicket আউট হবে না। Run Out/Obstructing/Hit Twice/Timed Out/Retired Out নির্বাচন করুন।");return;}closeWicketModal();await applyWicket(type,batter,fielder);}
async function recordPlayerStats(event){const id=event.strikerId;if(!id)return;const ref=doc(db,"players",id),snap=await getDoc(ref),cur=snap.exists()?snap.data():{id,name:event.batterName||id};await setDoc(ref,{...cur,id,name:cur.name||event.batterName||id,totalRuns:(cur.totalRuns||0)+(event.batterRuns||0),totalBalls:(cur.totalBalls||0)+(event.legal?1:0),totalFours:(cur.totalFours||0)+(event.batterRuns===4?1:0),totalSixes:(cur.totalSixes||0)+(event.batterRuns===6?1:0)},{merge:true});}
async function recordBowlerStats(event){const id=event.bowlerId;if(!id)return;const ref=doc(db,"players",id),snap=await getDoc(ref),cur=snap.exists()?snap.data():{id,name:event.bowlerName||id};await setDoc(ref,{...cur,id,name:cur.name||event.bowlerName||id,totalBowlingBalls:(cur.totalBowlingBalls||0)+(event.legal?1:0),totalBowlingRuns:(cur.totalBowlingRuns||0)+(event.bowlerRuns||0),totalWickets:(cur.totalWickets||0)+(event.bowlerWicket?1:0)},{merge:true});}
async function recordFieldingStats(event){const id=event.fielderId;if(!id)return;const ref=doc(db,"players",id),snap=await getDoc(ref),cur=snap.exists()?snap.data():{id,name:event.fielderName||id};const patch={...cur,id,name:cur.name||event.fielderName||id,fieldingCatches:(cur.fieldingCatches||0)+(event.dismissalType==="caught"?1:0),fieldingStumpings:(cur.fieldingStumpings||0)+(event.dismissalType==="stumped"?1:0),fieldingRunOuts:(cur.fieldingRunOuts||0)+(event.dismissalType==="runOut"?1:0)};patch.fieldingDismissals=(patch.fieldingCatches||0)+(patch.fieldingStumpings||0)+(patch.fieldingRunOuts||0);await setDoc(ref,patch,{merge:true});}
async function applyWicket(type,batter,fielder){if(!state||state.status!=="LIVE")return;if(state.bowlerChangeRequired){alert("৬টি legal ball শেষ হয়েছে। আগে নতুন বোলার নির্বাচন করুন।");return;}if(state.freeHit&&bowlerWicketTypes.includes(type)){alert("FREE HIT-এ এই dismissal বৈধ নয়।");return;}const before=clone(state),bowler=state.bowlers.find(x=>x.id===state.bowler);if(!bowler){alert("আগে বোলার নির্বাচন করুন।");return;}state.wickets++;batter.out=true;const credited=bowlerWicketTypes.includes(type);if(credited)bowler.wickets++;if(type!=="timedOut"&&type!=="retiredOut"){batter.balls++;state.legalBalls++;bowler.balls++;state.freeHit=false;if(state.legalBalls%6===0)state.bowlerChangeRequired=true;}if(batter.id===state.striker){state.striker=(state.players||[]).find(p=>!p.out&&p.id!==state.nonStriker)?.id||"";}else if(batter.id===state.nonStriker){state.nonStriker=(state.players||[]).find(p=>!p.out&&p.id!==state.striker)?.id||"";}const ev={eventId:newEventId(),superOver:!!state.superOver,type:"wicket",dismissalType:type,dismissedBatterId:batter.id,dismissedBatter:batter.name,fielderId:fielder?.id||"",fielderName:fielder?.name||"",batterName:batter.name,batterRuns:0,bowlerId:bowler.id,bowlerName:bowler.name,bowlerRuns:0,legal:type!=="timedOut"&&type!=="retiredOut",bowlerWicket:credited,strikerId:batter.id,inningsNo:state.inningsNo,over:ballsText(before.legalBalls),text:buildDismissalText(type,batter,fielder),createdAt:new Date().toISOString()};state.commentary.push(ev);eventStack.push(before);persistLocalState();const synced=await syncEvent(ev);if(synced)try{await recordFieldingStats(ev);}catch(e){}await checkInningsEnd();await save();render();}
async function apply(type,value=0){if(!state||state.status!=="LIVE")return;if(state.bowlerChangeRequired){alert("৬টি legal ball শেষ হয়েছে। আগে নতুন বোলার নির্বাচন করুন।");return;}const before=clone(state),striker=selectedBatter(state.striker),bowler=state.bowlers.find(x=>x.id===state.bowler);if(!striker||!bowler){alert("আগে ব্যাটার ও বোলার নির্বাচন করুন।");return;}let legal=true,batterRuns=0,extra=0,text="";if(type==="run"){batterRuns=value;text=value===4?"FOUR":value===6?"SIX":`${value} run`;}if(type==="wide"){legal=false;extra=1;state.extras.wide++;text="Wide";}if(type==="noBall"){legal=false;extra=1;state.extras.noBall++;state.freeHit=true;text="NO BALL • FREE HIT";}if(type==="bye"){extra=value;state.extras.bye+=value;text=`Bye ${value}`;}if(type==="legBye"){extra=value;state.extras.legBye+=value;text=`Leg bye ${value}`;}
 state.score+=batterRuns+extra;if(isPowerplayBall(state,before.legalBalls))state.powerplayRuns=(Number(state.powerplayRuns)||0)+batterRuns+extra;striker.runs+=batterRuns;if(legal)striker.balls++;if(batterRuns===4)striker.fours++;if(batterRuns===6)striker.sixes++;bowler.runs+=batterRuns+((type==="wide"||type==="noBall")?1:0);if(legal){state.legalBalls++;bowler.balls++;state.freeHit=false;if(state.legalBalls%6===0)state.bowlerChangeRequired=true;}if((batterRuns+extra)%2===1)[state.striker,state.nonStriker]=[state.nonStriker,state.striker];if(legal&&state.legalBalls%6===0)[state.striker,state.nonStriker]=[state.nonStriker,state.striker];const bowlerRuns=(type==="wide"||type==="noBall")?1:(type==="bye"||type==="legBye"?0:batterRuns);const ev={eventId:newEventId(),superOver:!!state.superOver,type,batterRuns,bowlerRuns,legal,strikerId:striker.id,batterName:striker.name,bowlerId:bowler.id,bowlerName:bowler.name,inningsNo:state.inningsNo,over:ballsText(before.legalBalls),text,createdAt:new Date().toISOString()};state.commentary.push(ev);eventStack.push(before);persistLocalState();const synced=await syncEvent(ev);if(synced){try{await recordPlayerStats(ev);}catch(e){}try{await recordBowlerStats(ev);}catch(e){}}await checkInningsEnd();await save();render();}
function snapshotCurrent(){return {superOver:!!state.superOver,inningsNo:state.inningsNo,battingTeamId:state.battingTeamId,battingTeam:state.battingTeam,bowlingTeamId:state.bowlingTeamId,bowlingTeam:state.bowlingTeam,score:state.score,wickets:state.wickets,legalBalls:state.legalBalls,maxOvers:state.maxOvers,target:state.target,extras:state.extras,players:state.players,bowlers:state.bowlers,commentary:state.commentary,status:state.status};}

// ============================================================
// FIXED: checkInningsEnd — Super Over target reached handling
// ============================================================
async function checkInningsEnd(){
  if(!state)return;
  const maxBalls=Number(state.maxOvers||15)*6;
  const isSO=!!(state.superOver&&typeof state.superOver==="object");
  const allOut=state.wickets>=(isSO?Math.min(2,Math.max(1,(state.players||[]).length-1)):Math.max(1,(state.players||[]).length-1));
  const targetReached=state.target>0&&state.score>=state.target;
  if(targetReached){
    if(isSO){
      state.superOver.scores[state.battingTeamId]=state.score;
      state.inningsHistory=[...(state.inningsHistory||[]),snapshotCurrent()];
    }
    state.status="COMPLETED";
    state.winnerTeamId=state.battingTeamId;
    state.winnerTeamName=state.battingTeam;
    if(isSO){
      const oppScore=state.superOver.scores[state.bowlingTeamId]||0;
      state.resultText=`${state.battingTeam} won the Super Over (${state.score}–${oppScore})`;
    }else{
      state.resultText=`${state.battingTeam} won by ${Math.max(1,(state.players||[]).length-state.wickets)} wicket(s)`;
    }
    await finalizeTournament();
    return;
  }
  if(state.legalBalls>=maxBalls||allOut){
    if(state.inningsNo===1&&!isSO){
      state.status="INNINGS_BREAK";
      return;
