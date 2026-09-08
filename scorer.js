import {auth,db,isAdmin,collection,doc,getDoc,getDocs,setDoc,addDoc,onSnapshot,serverTimestamp,signInWithEmailAndPassword,signOut,onAuthStateChanged} from "./firebase.js";
const $=id=>document.getElementById(id); let state=null,unsub=null,eventStack=[]; let teams=[]; let players=[];
const stageNames={R16:"Round of 16",QF:"Quarter Final",SF:"Semi Final",FINAL:"Final",CUSTOM:"Custom"};
const slug=s=>(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,35);
function ballsText(n){return `${Math.floor((n||0)/6)}.${(n||0)%6}`;}
function esc(s){return String(s??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));}
async function loadSetupData(){
 const [ts,ps]=await Promise.all([getDocs(collection(db,"teams")),getDocs(collection(db,"players"))]);
 teams=ts.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
 players=ps.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
 const teamOptions=teams.map(t=>`<option value="${esc(t.id)}">${esc(t.name||t.id)}${t.shortName?` (${esc(t.shortName)})`:""}</option>`).join("");
 $("team1").innerHTML=`<option value="">প্রথমে দল নির্বাচন করুন</option>${teamOptions}`;
 $("team2").innerHTML=`<option value="">দ্বিতীয় দল নির্বাচন করুন</option>${teamOptions}`;
 $("newPlayerTeam").innerHTML=`<option value="">দল নির্বাচন করুন</option>${teamOptions}`;
 $("teamCount").textContent=`${teams.length} / 16 দল`;
}
function oversValue(){const v=$("overs").value; return v==="custom"?Number($("customOvers").value||15):Number(v);}
function newMatch(id,t1,t2,overs,team1Players,team2Players,meta){
 const batting=team1Players.map((p,i)=>({id:p.id,name:p.name,runs:0,balls:0,fours:0,sixes:0,out:false,teamId:t1}));
 const bowling=team2Players.map(p=>({id:p.id,name:p.name,balls:0,runs:0,wickets:0,teamId:t2}));
 return {id,title:`${meta.team1Name} vs ${meta.team2Name} — ${meta.stageName}`,season:Number(meta.season)||2026,stage:meta.stage,stageName:meta.stageName,battingTeam:meta.team1Name,bowlingTeam:meta.team2Name,team1Id:t1,team2Id:t2,score:0,wickets:0,legalBalls:0,maxOvers:overs,innings:1,target:0,striker:batting[0]?.id||"",nonStriker:batting[1]?.id||"",bowler:bowling[0]?.id||"",players:batting,bowlers:bowling,extras:{wide:0,noBall:0,bye:0,legBye:0},commentary:[],status:"LIVE",updatedAt:null};
}
function render(){
 if(!state)return;
 $("matchTitle").textContent=`${state.battingTeam} vs ${state.bowlingTeam} — ${state.id}`; $("battingTeam").textContent=state.battingTeam;
 $("score").textContent=`${state.score||0}/${state.wickets||0}`; $("oversText").textContent=`${ballsText(state.legalBalls)} / ${state.maxOvers||15} overs`;
 $("crr").textContent=`CRR ${state.legalBalls?(state.score/(state.legalBalls/6)).toFixed(2):"0.00"}`;
 $("matchMeta").textContent=`${state.season||2026} • ${state.stageName||"Match"} • ${state.status||"LIVE"}`;
 const ss=$("striker"),ns=$("nonStriker"),bw=$("bowler"); ss.innerHTML=ns.innerHTML=bw.innerHTML="";
 (state.players||[]).forEach(p=>{const o=new Option(`${p.name}${p.out?" (OUT)":""}`,p.id);ss.add(o.cloneNode(true));ns.add(o.cloneNode(true));});
 (state.bowlers||[]).forEach(p=>bw.add(new Option(p.name,p.id)));
 ss.value=state.striker;ns.value=state.nonStriker;bw.value=state.bowler;
 $("batInfo").textContent=`Striker: ${state.players?.find(p=>p.id===state.striker)?.runs||0} runs`;
 $("bowlInfo").textContent=`${state.bowlers?.find(p=>p.id===state.bowler)?.wickets||0} wicket(s)`;
 $("battingCard").innerHTML=`<table><tr><th>ব্যাটার</th><th>R</th><th>B</th><th>4s</th><th>6s</th></tr>${(state.players||[]).map(p=>`<tr><td>${esc(p.name)}${p.id===state.striker?" *":""}</td><td>${p.runs||0}</td><td>${p.balls||0}</td><td>${p.fours||0}</td><td>${p.sixes||0}</td></tr>`).join("")}</table>`;
 $("bowlingCard").innerHTML=`<table><tr><th>বোলার</th><th>O</th><th>R</th><th>W</th></tr>${(state.bowlers||[]).map(p=>`<tr><td>${esc(p.name)}</td><td>${ballsText(p.balls)}</td><td>${p.runs||0}</td><td>${p.wickets||0}</td></tr>`).join("")}</table>`;
 $("commentary").innerHTML=(state.commentary||[]).slice(-30).reverse().map(x=>`<div><b>${esc(x.over)}</b> — ${esc(x.text)}</div>`).join("");
}
async function save(){if(!state)return;state.updatedAt=serverTimestamp();await setDoc(doc(db,"matches",state.id),state,{merge:true});await setDoc(doc(db,"liveMatches",state.id),{...state,updatedAt:serverTimestamp()},{merge:true});}
function selectedBatter(id){return (state.players||[]).find(p=>p.id===id)}
const dismissalNames={bowled:{bn:"বোল্ড",en:"Bowled"},caught:{bn:"ক্যাচ আউট",en:"Caught"},lbw:{bn:"LBW",en:"LBW"},runOut:{bn:"রান আউট",en:"Run Out"},stumped:{bn:"স্টাম্পড",en:"Stumped"},hitWicket:{bn:"হিট উইকেট",en:"Hit Wicket"},obstructing:{bn:"ফিল্ডে বাধা",en:"Obstructing the Field"},hitTwice:{bn:"দুবার বল মারা",en:"Hit the Ball Twice"},timedOut:{bn:"টাইমড আউট",en:"Timed Out"},retiredOut:{bn:"রিটায়ার্ড আউট",en:"Retired Out"}};
function commentaryLang(){return $("commentaryLang")?.value||"bn"}
function buildDismissalText(type,batter,fielder){const lang=commentaryLang();const name=batter.name;const f=fielder?.name||"";if(lang==="en"){if(type==="caught")return `WICKET — ${name} c ${f} b ${state.bowlers.find(x=>x.id===state.bowler)?.name||""}`;if(type==="runOut")return `WICKET — ${name} Run Out`;return `WICKET — ${name} ${dismissalNames[type]?.en||type}`;}if(type==="caught")return `উইকেট — ${name} ক্যাচ ${f} বোলার ${state.bowlers.find(x=>x.id===state.bowler)?.name||""}`;if(type==="runOut")return `উইকেট — ${name} রান আউট`;return `উইকেট — ${name} ${dismissalNames[type]?.bn||type}`;}
function openWicketModal(){if(!state||state.status!=="LIVE")return;const livePlayers=(state.players||[]).filter(p=>!p.out);$("dismissedBatter").innerHTML=livePlayers.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.id===state.striker?" (Striker)":""}</option>`).join("");$("fielder").innerHTML=(state.bowlers||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");$("dismissedBatter").value=state.striker||livePlayers[0]?.id||"";$("fielderBox").classList.toggle("hidden",$("dismissalType").value!=="caught");$("wicketModal").classList.remove("hidden");}
function closeWicketModal(){$("wicketModal").classList.add("hidden");}
async function confirmWicket(){const batter=selectedBatter($("dismissedBatter").value);const type=$("dismissalType").value;const fielder=(state.bowlers||[]).find(x=>x.id===$("fielder").value);if(!batter){alert("আউট হওয়া ব্যাটার নির্বাচন করুন।");return;}if(type==="caught"&&!fielder){alert("ক্যাচের ফিল্ডার নির্বাচন করুন।");return;}closeWicketModal();await applyWicket(type,batter,fielder);}
async function applyWicket(type,batter, fielder){if(!state||state.status!=="LIVE")return;const before=JSON.parse(JSON.stringify(state));const bowler=(state.bowlers||[]).find(x=>x.id===state.bowler);if(!bowler){alert("আগে বোলার নির্বাচন করুন।");return;}state.wickets++;batter.out=true;bowler.wickets++;if(type!=="timedOut"&&type!=="retiredOut")batter.balls++;if(batter.id===state.striker){const replacement=(state.players||[]).find(p=>!p.out&&p.id!==state.nonStriker);state.striker=replacement?.id||"";}else if(batter.id===state.nonStriker){const replacement=(state.players||[]).find(p=>!p.out&&p.id!==state.striker);state.nonStriker=replacement?.id||"";}if(type!=="timedOut"&&type!=="retiredOut"){state.legalBalls++;bowler.balls++;}bowler.runs+=0;const text=buildDismissalText(type,batter,fielder);const ev={type:"wicket",dismissalType:type,dismissedBatterId:batter.id,dismissedBatter:batter.name,fielderId:fielder?.id||"",fielderName:fielder?.name||"",batterRuns:0,bowlerId:bowler.id,bowlerName:bowler.name,bowlerRuns:0,legal:type!=="timedOut"&&type!=="retiredOut",strikerId:batter.id,over:ballsText(before.legalBalls),text,createdAt:new Date().toISOString()};state.commentary.push(ev);eventStack.push(before);if(state.legalBalls>=Number(state.maxOvers||15)*6)state.status="INNINGS_BREAK";render();await addDoc(collection(db,"matches",state.id,"events"),ev);await save();const bref=doc(db,"players",bowler.id);const bsnap=await getDoc(bref);const bcur=bsnap.exists()?bsnap.data():{id:bowler.id,name:bowler.name,totalWickets:0,totalBalls:0,totalRuns:0};await setDoc(bref,{...bcur,id:bowler.id,name:bowler.name,totalWickets:(bcur.totalWickets||0)+1,totalBowlingBalls:(bcur.totalBowlingBalls||0)+(ev.legal?1:0),totalBowlingRuns:(bcur.totalBowlingRuns||0)},{merge:true});}

async function recordPlayerStats(event){const s=selectedBatter(event.strikerId);if(!s)return;const ref=doc(db,"players",s.id);const snap=await getDoc(ref);const cur=snap.exists()?snap.data():{id:s.id,name:s.name,totalRuns:0,totalBalls:0,totalFours:0,totalSixes:0,totalMatches:0,totalWickets:0};await setDoc(ref,{...cur,id:s.id,name:s.name,totalRuns:(cur.totalRuns||0)+(event.batterRuns||0),totalBalls:(cur.totalBalls||0)+(event.legal?1:0),totalFours:(cur.totalFours||0)+(event.batterRuns===4?1:0),totalSixes:(cur.totalSixes||0)+(event.batterRuns===6?1:0)},{merge:true});}
async function recordBowlerStats(event){
 const id=event.bowlerId;if(!id)return;const ref=doc(db,"players",id);const snap=await getDoc(ref);const cur=snap.exists()?snap.data():{id,name:event.bowlerName||id,totalBowlingBalls:0,totalBowlingRuns:0,totalWickets:0};
 await setDoc(ref,{...cur,id,name:cur.name||event.bowlerName||id,totalBowlingBalls:(cur.totalBowlingBalls||0)+(event.legal?1:0),totalBowlingRuns:(cur.totalBowlingRuns||0)+(event.bowlerRuns||0)},{merge:true});
}
async function apply(type,value=0){
 if(!state||state.status!=="LIVE")return;
 if(state.legalBalls>=Number(state.maxOvers||15)*6){state.status="INNINGS_BREAK";await save();render();return;}
 const before=JSON.parse(JSON.stringify(state));const striker=selectedBatter(state.striker);const bowler=(state.bowlers||[]).find(x=>x.id===state.bowler);if(!striker||!bowler){alert("আগে অন্তত ২ জন ব্যাটার এবং ১ জন বোলার যোগ করুন।");return;}
 let legal=true,batterRuns=0,extra=0,text="";
 if(type==="run"){batterRuns=value;text=value===4?"FOUR":value===6?"SIX":`${value} run`;}
 if(type==="wide"){legal=false;extra=1;state.extras.wide++;text="Wide";}
 if(type==="noBall"){legal=false;extra=1;state.extras.noBall++;text="No Ball";}
 if(type==="bye"){extra=value;state.extras.bye+=value;text=`Bye ${value}`;}
 if(type==="legBye"){extra=value;state.extras.legBye+=value;text=`Leg bye ${value}`;}

 state.score+=batterRuns+extra;striker.runs+=batterRuns;if(legal)striker.balls++;if(batterRuns===4)striker.fours++;if(batterRuns===6)striker.sixes++;bowler.runs+=batterRuns+((type==="wide"||type==="noBall")?1:0);if(legal){state.legalBalls++;bowler.balls++;}
 if((batterRuns+extra)%2===1)[state.striker,state.nonStriker]=[state.nonStriker,state.striker];if(legal&&state.legalBalls%6===0)[state.striker,state.nonStriker]=[state.nonStriker,state.striker];
 const bowlerRuns=(type==="wide"||type==="noBall")?1:(type==="bye"||type==="legBye"?0:batterRuns);const ev={type,batterRuns,legal,strikerId:striker.id,bowlerId:bowler.id,bowlerName:bowler.name,bowlerRuns,over:ballsText(before.legalBalls),text,createdAt:new Date().toISOString()};state.commentary.push(ev);eventStack.push(before);if(state.legalBalls>=Number(state.maxOvers||15)*6)state.status="INNINGS_BREAK";render();await addDoc(collection(db,"matches",state.id,"events"),ev);await save();await recordPlayerStats(ev);await recordBowlerStats(ev);
}
async function undo(){const prev=eventStack.pop();if(!prev){alert("এই session-এ undo করার মতো event নেই");return;}state=prev;render();await save();}
async function loadMatch(id){const snap=await getDoc(doc(db,"matches",id));if(!snap.exists()){alert("Match পাওয়া যায়নি। আগে Match Setup থেকে তৈরি করুন।");return;}state=snap.data();eventStack=[];render();if(unsub)unsub();unsub=onSnapshot(doc(db,"matches",id),s=>{if(s.exists()){state=s.data();render();}});}
$("overs").onchange=()=>$("customOvers").classList.toggle("hidden",$("overs").value!=="custom");
$("refreshSetup").onclick=loadSetupData;
$("addTeam").onclick=async()=>{const name=$("newTeamName").value.trim(),shortName=$("newTeamShort").value.trim();if(!name){$("teamMsg").textContent="দলের নাম দিন।";return;}if(teams.length>=16){$("teamMsg").textContent="১৬টি দলের সীমা পূর্ণ হয়েছে।";return;}const id=`team-${Date.now()}`;await setDoc(doc(db,"teams",id),{id,name,shortName,playersCount:0,season:2026,createdAt:serverTimestamp()});$("newTeamName").value=$("newTeamShort").value="";$("teamMsg").textContent="দল Save হয়েছে।";await loadSetupData();};
$("addPlayer").onclick=async()=>{const name=$("newPlayerName").value.trim(),teamId=$("newPlayerTeam").value;if(!name||!teamId){$("playerMsg").textContent="নাম ও দল দুটোই নির্বাচন করুন।";return;}const id=`player-${Date.now()}`;const team=teams.find(t=>t.id===teamId);await setDoc(doc(db,"players",id),{id,name,teamId,teamName:team?.name||"",totalRuns:0,totalBalls:0,totalFours:0,totalSixes:0,totalMatches:0,totalWickets:0,createdAt:serverTimestamp()});if(team){await setDoc(doc(db,"teams",teamId),{playersCount:(team.playersCount||0)+1},{merge:true});}$("newPlayerName").value="";$("playerMsg").textContent="খেলোয়াড় Save হয়েছে।";await loadSetupData();};
$("createMatch").onclick=async()=>{const t1=$("team1").value,t2=$("team2").value;if(!t1||!t2||t1===t2){$("setupMsg").textContent="দুটি আলাদা দল নির্বাচন করুন।";return;}const overs=oversValue();if(!overs||overs<1||overs>50){$("setupMsg").textContent="Overs 1–50 এর মধ্যে দিন।";return;}const season=Number($("season").value||2026),stage=$("stage").value;const a=teams.find(t=>t.id===t1),b=teams.find(t=>t.id===t2);const p1=players.filter(p=>p.teamId===t1),p2=players.filter(p=>p.teamId===t2);if(p1.length<2||p2.length<1){$("setupMsg").textContent="দুই দলে অন্তত ২ জন করে খেলোয়াড় যোগ করুন; বোলিং দলের অন্তত ১ জন প্রয়োজন।";return;}let id=$("matchId").value.trim();if(!id)id=`${season}-${stage.toLowerCase()}-${slug(a.name)}-${slug(b.name)}`;const m=newMatch(id,t1,t2,overs,p1,p2,{season,stage,stageName:stageNames[stage]||stage,team1Name:a.name,team2Name:b.name});await setDoc(doc(db,"matches",id),m);await setDoc(doc(db,"liveMatches",id),m);$("activeMatchId").value=id;state=m;eventStack=[];render();if(unsub)unsub();unsub=onSnapshot(doc(db,"matches",id),s=>{if(s.exists()){state=s.data();render();}});$("setupMsg").textContent=`${id} তৈরি হয়েছে এবং scoring শুরু হয়েছে।`;};
$("loadMatch").onclick=()=>loadMatch($("activeMatchId").value.trim());
$("runButtons").innerHTML=[0,1,2,3,4,5,6].map(n=>`<button data-run="${n}" class="${n===4||n===6?"accent":""}">${n}</button>`).join("");
document.querySelectorAll("[data-run]").forEach(b=>b.onclick=()=>apply("run",Number(b.dataset.run)));
document.querySelectorAll("[data-extra]").forEach(b=>b.onclick=()=>{const t=b.dataset.extra;apply(t,t==="bye"||t==="legBye"?1:0)});
$("wicketBtn").onclick=openWicketModal;$("closeWicket").onclick=closeWicketModal;$("cancelWicket").onclick=closeWicketModal;$("confirmWicket").onclick=confirmWicket;$("dismissalType").onchange=e=>$("fielderBox").classList.toggle("hidden",e.target.value!=="caught");
$("striker").onchange=e=>{state.striker=e.target.value;save();};$("nonStriker").onchange=e=>{state.nonStriker=e.target.value;save();};$("bowler").onchange=e=>{state.bowler=e.target.value;save();};$("undoBtn").onclick=undo;$("endInnings").onclick=async()=>{state.status="INNINGS_BREAK";await save();render();};
$("loginBtn").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("email").value,$("password").value);}catch(e){$("loginMsg").textContent=e.message}};$("logoutBtn").onclick=()=>signOut(auth);
onAuthStateChanged(auth,async user=>{if(user&&isAdmin(user)){$("loginCard").classList.add("hidden");$("scorerApp").classList.remove("hidden");await loadSetupData();}else{$("loginCard").classList.remove("hidden");$("scorerApp").classList.add("hidden");}});
