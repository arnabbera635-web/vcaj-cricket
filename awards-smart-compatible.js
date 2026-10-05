import {
  auth,db,isAdmin,onAuthStateChanged,signOut,
  collection,doc,getDoc,getDocs,setDoc,updateDoc,serverTimestamp
} from "./firebase.js";

const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=v=>Number(v||0);

const AWARDS=[
["SERIES_MOTM","ম্যান অব দ্য সিরিজ","TOURNAMENT"],
["FINAL_MOTM","ফাইনাল ম্যান অব দ্য ম্যাচ","MATCH"],
["MATCH_MOTM","প্রতিটা ম্যাচের ম্যান অফ দা ম্যাচ","MATCH"],
["BEST_BATSMAN","সেরা ব্যাটসম্যান","TOURNAMENT"],
["BEST_BOWLER","সেরা বোলার","TOURNAMENT"],
["BEST_ALLROUNDER","সেরা অলরাউন্ডার","TOURNAMENT"],
["BEST_WICKETKEEPER","সেরা উইকেটকিপার","TOURNAMENT"],
["BEST_FIELDER","সেরা ফিল্ডার","TOURNAMENT"],
["MOST_RUNS","সর্বোচ্চ রান সংগ্রাহক","TOURNAMENT"],
["MOST_WICKETS","সর্বোচ্চ উইকেট সংগ্রাহক","TOURNAMENT"],
["EMERGING","উদীয়মান খেলোয়াড় (Emerging Player)","TOURNAMENT"],
["HAT_TRICK","হ্যাটট্রিক পুরস্কার","TOURNAMENT"],
["CENTURY","শতরান পুরস্কার","TOURNAMENT"],
["FIFTY","অর্ধশতরান পুরস্কার","TOURNAMENT"],
["BEST_CATCH","সেরা ক্যাচ","TOURNAMENT"],
["BEST_RUN_OUT","সেরা রান-আউট","TOURNAMENT"],
["BEST_BOWLING_SPELL","সেরা বোলিং স্পেল","TOURNAMENT"],
["BEST_BATTING_INNINGS","সেরা ব্যাটিং ইনিংস","TOURNAMENT"],
["MOST_SIXES","সর্বাধিক ছক্কা","TOURNAMENT"],
["FAIR_PLAY","Fair Play Trophy","TOURNAMENT"],
["TEAM_SPIRIT","Best Team Spirit Award","TOURNAMENT"],
["BEST_CAPTAIN","Best Captain Award","TOURNAMENT"],
["SUPPORTED_TEAM","Best Supported Team Award","TOURNAMENT"],
["SF1_MOTM","সেমিফাইনাল–১ ম্যান অব দ্য ম্যাচ","MATCH"],
["SF2_MOTM","সেমিফাইনাল–২ ম্যান অব দ্য ম্যাচ","MATCH"],
["TOURNAMENT_MOMENT","Moment of the Tournament","TOURNAMENT"],
["CUSTOM","Custom Award","MANUAL"]
];

let players=[],matches=[],awards=[],editingId=null;
let verified={records:{},matches:{},scannedMatches:0,scannedEvents:0};

function stat(){
 return {runs:0,balls:0,fours:0,sixes:0,wickets:0,bowlingRuns:0,bowlingBalls:0,
 catches:0,stumpings:0,runOuts:0,hatTricks:0,innings:[],spells:[]};
}
function pname(id){
 const p=players.find(x=>x.id===id);
 return p?.name||p?.playerName||id||"Unknown";
}
function pteam(id){
 const p=players.find(x=>x.id===id);
 return p?.teamName||"";
}
function recordHtml(s){
 const sr=s.balls?s.runs/s.balls*100:0, eco=s.bowlingBalls?s.bowlingRuns/(s.bowlingBalls/6):0;
 return `<div class="aw-record">
 <div class="aw-stat"><b>${s.runs}</b><small>Runs</small></div>
 <div class="aw-stat"><b>${s.wickets}</b><small>Wickets</small></div>
 <div class="aw-stat"><b>${s.sixes}</b><small>Sixes</small></div>
 <div class="aw-stat"><b>${sr.toFixed(1)}</b><small>SR</small></div>
 <div class="aw-stat"><b>${eco.toFixed(2)}</b><small>Economy</small></div>
 <div class="aw-stat"><b>${s.catches+s.runOuts+s.stumpings}</b><small>Fielding</small></div>
 </div>`;
}

function completedMatch(m,season){
 return String(m.season||"")===String(season) && String(m.status||"").toUpperCase()==="COMPLETED";
}

async function scanMatch(m){
 const snap=await getDocs(collection(db,"matches",m.id,"events"));
 const evs=snap.docs.map(d=>({id:d.id,...d.data()}))
   .sort((a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
 const by={}; const get=id=>by[id]||(by[id]=stat());
 const innings={}; const spells={};

 for(const e of evs){
   if(e.strikerId){
     const s=get(e.strikerId);
     s.runs+=num(e.batterRuns);
     s.balls+=e.legal?1:0;
     s.fours+=e.batterRuns===4?1:0;
     s.sixes+=e.batterRuns===6?1:0;
     const ik=`${e.inningsNo||1}:${e.strikerId}`;
     const x=innings[ik]||(innings[ik]={playerId:e.strikerId,inningsNo:e.inningsNo||1,runs:0,balls:0,fours:0,sixes:0});
     x.runs+=num(e.batterRuns); x.balls+=e.legal?1:0;
     x.fours+=e.batterRuns===4?1:0; x.sixes+=e.batterRuns===6?1:0;
   }
   if(e.bowlerId){
     const s=get(e.bowlerId);
     s.bowlingBalls+=e.legal?1:0;
     s.bowlingRuns+=num(e.bowlerRuns);
     s.wickets+=e.bowlerWicket?1:0;
     const sk=`${e.inningsNo||1}:${e.bowlerId}`;
     const sp=spells[sk]||(spells[sk]={playerId:e.bowlerId,inningsNo:e.inningsNo||1,balls:0,runs:0,wickets:0});
     sp.balls+=e.legal?1:0; sp.runs+=num(e.bowlerRuns); sp.wickets+=e.bowlerWicket?1:0;
   }
   if(e.fielderId){
     const s=get(e.fielderId);
     s.catches+=e.dismissalType==="caught"?1:0;
     s.stumpings+=e.dismissalType==="stumped"?1:0;
     s.runOuts+=e.dismissalType==="runOut"?1:0;
   }
 }
 for(const x of Object.values(innings))get(x.playerId).innings.push({...x,matchId:m.id});
 for(const x of Object.values(spells))get(x.playerId).spells.push({...x,matchId:m.id});

 // Verify bowler hat-trick from consecutive legal credited wickets by same bowler.
 const streak={};
 for(const e of evs){
   if(!e.legal || !e.bowlerId) continue;
   if(e.type==="wicket" && e.bowlerWicket){
     streak[e.bowlerId]=(streak[e.bowlerId]||0)+1;
     if(streak[e.bowlerId]===3){get(e.bowlerId).hatTricks++;streak[e.bowlerId]=0;}
   }else{
     streak[e.bowlerId]=0;
   }
 }

 return {match:m,events:evs,players:by};
}

async function verifySeason(){
 const season=String($("awardSeason").value||2026);
 verified={records:{},matches:{},scannedMatches:0,scannedEvents:0};
 const done=matches.filter(m=>completedMatch(m,season));
 for(const m of done){
   const x=await scanMatch(m);
   verified.matches[m.id]=x;
   verified.scannedMatches++;
   verified.scannedEvents+=x.events.length;
   for(const [id,s] of Object.entries(x.players)){
     const t=verified.records[id]||(verified.records[id]=stat());
     for(const k of ["runs","balls","fours","sixes","wickets","bowlingRuns","bowlingBalls","catches","stumpings","runOuts","hatTricks"])t[k]+=s[k];
     t.innings.push(...s.innings); t.spells.push(...s.spells);
   }
 }
 $("calcMsg").textContent=`${verified.scannedMatches}টি completed match • ${verified.scannedEvents}টি scoring event verified`;
 renderStats();
}

function renderStats(){
 const rows=Object.entries(verified.records).map(([id,s])=>({id,s,name:pname(id),team:pteam(id)}))
 .sort((a,b)=>b.s.runs-a.s.runs||b.s.wickets-a.s.wickets);
 if(!rows.length){
  $("statsTable").innerHTML="<p class='aw-status'>Season-এর completed match event এখনও পাওয়া যায়নি। Player summary নিচে যাচাই করা হয়নি।</p>";
  return;
 }
 $("statsTable").innerHTML=`<div class="aw-table"><table><tr><th>Player</th><th>Team</th><th>Runs</th><th>Wickets</th><th>4s</th><th>6s</th><th>Catches</th><th>Run-outs</th><th>Hat-trick</th></tr>
 ${rows.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.team)}</td><td>${x.s.runs}</td><td>${x.s.wickets}</td><td>${x.s.fours}</td><td>${x.s.sixes}</td><td>${x.s.catches}</td><td>${x.s.runOuts}</td><td>${x.s.hatTricks}</td></tr>`).join("")}</table></div>`;
}

function score(type,s){
 const sr=s.balls?s.runs/s.balls*100:0, eco=s.bowlingBalls?s.bowlingRuns/(s.bowlingBalls/6):99;
 switch(type){
  case "MOST_RUNS":return s.runs*100000+s.balls;
  case "MOST_WICKETS":return s.wickets*100000-s.bowlingRuns;
  case "MOST_SIXES":return s.sixes*100000+s.runs;
  case "CENTURY":return s.innings.filter(x=>x.runs>=100).length*100000+s.runs;
  case "FIFTY":return s.innings.filter(x=>x.runs>=50&&x.runs<100).length*100000+s.runs;
  case "HAT_TRICK":return s.hatTricks*100000+s.wickets;
  case "BEST_BATSMAN":return s.runs+sr*.35+s.sixes*3+s.fours*1.5;
  case "BEST_BOWLER":return s.wickets*100-eco*3+s.bowlingBalls*.03;
  case "BEST_ALLROUNDER":return s.runs+s.wickets*25+(s.catches+s.runOuts+s.stumpings)*6;
  case "BEST_FIELDER":return s.catches*20+s.runOuts*20+s.stumpings*15;
  case "BEST_CATCH":return s.catches;
  case "BEST_RUN_OUT":return s.runOuts;
  case "BEST_BOWLING_SPELL":return Math.max(...s.spells.map(x=>x.wickets*100-x.runs),0);
  case "BEST_BATTING_INNINGS":return Math.max(...s.innings.map(x=>x.runs+x.sixes*3+x.fours*1.5),0);
  default:return 0;
 }
}
function metric(type,s){
 const sr=s.balls?s.runs/s.balls*100:0, eco=s.bowlingBalls?s.bowlingRuns/(s.bowlingBalls/6):0;
 if(type==="MOST_RUNS")return `${s.runs} runs`;
 if(type==="MOST_WICKETS")return `${s.wickets} wickets`;
 if(type==="MOST_SIXES")return `${s.sixes} sixes`;
 if(type==="CENTURY")return `${s.innings.filter(x=>x.runs>=100).length} century`;
 if(type==="FIFTY")return `${s.innings.filter(x=>x.runs>=50&&x.runs<100).length} fifty`;
 if(type==="HAT_TRICK")return `${s.hatTricks} hat-trick`;
 if(type==="BEST_BATSMAN")return `${s.runs} runs • SR ${sr.toFixed(1)}`;
 if(type==="BEST_BOWLER")return `${s.wickets} wickets • Econ ${eco.toFixed(2)}`;
 if(type==="BEST_ALLROUNDER")return `${s.runs} R • ${s.wickets} W`;
 if(type==="BEST_FIELDER")return `${s.catches} catches • ${s.runOuts} run-outs`;
 if(type==="BEST_CATCH")return `${s.catches} catches`;
 if(type==="BEST_RUN_OUT")return `${s.runOuts} run-outs`;
 if(type==="BEST_BOWLING_SPELL"){const x=[...s.spells].sort((a,b)=>b.wickets-a.wickets||a.runs-b.runs)[0];return x?`${x.wickets}/${x.runs} in ${Math.floor(x.balls/6)}.${x.balls%6} overs`:"—";}
 if(type==="BEST_BATTING_INNINGS"){const x=[...s.innings].sort((a,b)=>b.runs-a.runs)[0];return x?`${x.runs} runs in an innings`:"—";}
 return "";
}

function eligible(type,s){
 if(["MOST_WICKETS","BEST_BOWLER","BEST_BOWLING_SPELL"].includes(type))return s.bowlingBalls>0||s.wickets>0;
 if(["BEST_FIELDER","BEST_CATCH","BEST_RUN_OUT"].includes(type))return s.catches+s.runOuts+s.stumpings>0;
 if(type==="HAT_TRICK")return s.hatTricks>0;
 if(["CENTURY","FIFTY","BEST_BATSMAN","BEST_BATTING_INNINGS","MOST_RUNS","MOST_SIXES"].includes(type))return s.balls>0||s.runs>0;
 if(type==="BEST_ALLROUNDER")return s.runs>0&&s.wickets>0;
 return s.runs>0||s.wickets>0||s.catches+s.runOuts+s.stumpings>0;
}

function matchCandidates(type,matchId){
 const m=verified.matches[matchId]; if(!m)return [];
 const rows=[];
 for(const [id,s] of Object.entries(m.players)){
  let sc=0,met="";
  if(type==="MATCH_MOTM"||type.endsWith("_MOTM")){sc=s.runs+s.wickets*25+(s.catches+s.runOuts+s.stumpings)*8;met=`${s.runs} R • ${s.wickets} W • ${s.catches+s.runOuts+s.stumpings} F`;}
  else {sc=score(type,s);met=metric(type,s);}
  if(sc>0)rows.push({id,name:pname(id),team:pteam(id),score:sc,metric:met,s});
 }
 return rows.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
}

function tournamentCandidates(type){
 if(["SERIES_MOTM","FINAL_MOTM","MATCH_MOTM","SF1_MOTM","SF2_MOTM"].includes(type))type="BEST_ALLROUNDER";
 const rows=[];
 for(const [id,s] of Object.entries(verified.records)){
  if(type==="EMERGING")continue;
  if(!eligible(type,s))continue;
  const sc=score(type,s);
  if(sc>0)rows.push({id,name:pname(id),team:pteam(id),score:sc,metric:metric(type,s),s});
 }
 return rows.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
}

function renderCandidates(rows,type){
 if(!rows.length){
  $("candidateList").innerHTML=`<div class="aw-error">এই Award-এর জন্য যথেষ্ট verified event data নেই। এটি manual award হিসেবে Save করতে পারবেন।</div>`;
  return;
 }
 $("candidateList").innerHTML=`<div class="aw-status">${rows.length} জন eligible candidate • #1 হলো statistical recommendation</div>`+
 rows.slice(0,20).map((x,i)=>`<article class="aw-candidate ${i===0?"top":""}">
 <div><b>#${i+1} ${esc(x.name)}</b> <span class="aw-tag">${esc(x.metric)}</span></div>
 <div class="aw-meta">${esc(x.team)}</div>${recordHtml(x.s)}
 <div class="aw-actions"><button class="aw-btn gray" data-select="${esc(x.id)}">এই প্রার্থী নিন</button></div>
 </article>`).join("");
 $("candidateList").querySelectorAll("[data-select]").forEach(b=>b.onclick=()=>{
   const x=rows.find(r=>r.id===b.dataset.select);if(!x)return;
   $("recipient").value=x.name;$("teamName").value=x.team;$("saveType").value=type;
   if($("matchId").value)$("saveMatch").value=$("matchId").value;
   $("awardMsg").textContent=`${x.name} নির্বাচিত হয়েছে। Save Award চাপুন।`;
 });
}

function setupAwards(){
 $("awardType").innerHTML=AWARDS.filter(a=>a[2]!=="MANUAL").map(a=>`<option value="${a[0]}">${esc(a[1])}</option>`).join("");
 $("saveType").innerHTML=AWARDS.map(a=>`<option value="${a[0]}">${esc(a[1])}</option>`).join("");
 $("awardScope").onchange=()=>{
   const scope=$("awardScope").value;
   $("matchBox").classList.toggle("hidden",scope!=="MATCH");
   const opts=AWARDS.filter(a=>a[2]===scope||a[0]==="MATCH_MOTM"&&scope==="MATCH");
   $("awardType").innerHTML=opts.map(a=>`<option value="${a[0]}">${esc(a[1])}</option>`).join("");
 };
 $("awardScope").dispatchEvent(new Event("change"));
}

function setupMatches(){
 const opts=matches.map(m=>`<option value="${esc(m.id)}">${esc(m.id)} — ${esc(m.stageName||m.stage||"Match")} — ${esc(m.team1Name||"")} vs ${esc(m.team2Name||"")}</option>`).join("");
 $("matchId").innerHTML=opts;
 $("saveMatch").innerHTML=`<option value="">প্রযোজ্য নয়</option>${opts}`;
}

async function calculateAward(){
 const type=$("awardType").value,scope=$("awardScope").value;
 await verifySeason();
 if(scope==="MATCH"){
   const mid=$("matchId").value,m=matches.find(x=>x.id===mid);
   if(!m){$("calcError").className="aw-error";$("calcError").textContent="একটি ম্যাচ নির্বাচন করুন।";return;}
   if(!completedMatch(m,$("awardSeason").value)){ $("calcError").className="aw-error";$("calcError").textContent="শুধু COMPLETED ম্যাচের award calculation করা যাবে।";return;}
   if(type==="FINAL_MOTM"&&m.stage!=="FINAL"){ $("calcError").className="aw-error";$("calcError").textContent="Final MOTM-এর জন্য FINAL stage match নির্বাচন করুন।";return;}
   if((type==="SF1_MOTM"||type==="SF2_MOTM")&&m.stage!=="SF"){ $("calcError").className="aw-error";$("calcError").textContent="Semi-final MOTM-এর জন্য SF match নির্বাচন করুন।";return;}
   $("calcError").classList.add("hidden");
   renderCandidates(matchCandidates(type,mid),type);
 }else{
   $("calcError").classList.add("hidden");
   if(["FAIR_PLAY","TEAM_SPIRIT","BEST_CAPTAIN","SUPPORTED_TEAM","TOURNAMENT_MOMENT","EMERGING"].includes(type)){
     $("candidateList").innerHTML=`<div class="aw-ok">এই award-টি subjective/manual। Smart Engine এখানে ভুল statistical winner বানাবে না। Admin নিজে প্রাপক নির্বাচন করে Save করবেন।</div>`;
   }else renderCandidates(tournamentCandidates(type),type);
 }
}

async function load(){
 const [ps,ms,as]=await Promise.all([getDocs(collection(db,"players")),getDocs(collection(db,"matches")),getDocs(collection(db,"awards"))]);
 players=ps.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||a.playerName||"").localeCompare(b.name||b.playerName||""));
 matches=ms.docs.map(d=>({id:d.id,...d.data()}));
 awards=as.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>Number(b.createdAt?.seconds||b.updatedAt?.seconds||0)-Number(a.createdAt?.seconds||a.updatedAt?.seconds||0));
 renderPlayerSummary();
 setupMatches();setupAwards();renderAwards();
}

function renderPlayerSummary(){
 const rows=[...players].sort((a,b)=>num(b.totalRuns)-num(a.totalRuns)||num(b.totalWickets)-num(a.totalWickets));
 $("statsTable").innerHTML=rows.length?`<div class="aw-table"><table><tr><th>Player</th><th>Team</th><th>Runs</th><th>Balls</th><th>SR</th><th>4s</th><th>6s</th><th>Wickets</th><th>Bowling Runs</th><th>Economy</th><th>Fielding</th></tr>${rows.map(p=>{const sr=p.totalBalls?num(p.totalRuns)/num(p.totalBalls)*100:0,eco=p.totalBowlingBalls?num(p.totalBowlingRuns)/(num(p.totalBowlingBalls)/6):0;return `<tr><td><b>${esc(p.name||p.playerName||p.id)}</b></td><td>${esc(p.teamName||"")}</td><td>${num(p.totalRuns)}</td><td>${num(p.totalBalls)}</td><td>${sr.toFixed(1)}</td><td>${num(p.totalFours)}</td><td>${num(p.totalSixes)}</td><td>${num(p.totalWickets)}</td><td>${num(p.totalBowlingRuns)}</td><td>${eco.toFixed(2)}</td><td>${num(p.fieldingDismissals)||num(p.fieldingCatches)+num(p.fieldingStumpings)+num(p.fieldingRunOuts)}</td></tr>`}).join("")}</table></div>`:"<p class='aw-status'>কোনো player record নেই।</p>";
}

function renderAwards(){
 $("awardTable").innerHTML=awards.length?`<table><tr><th>Season</th><th>Award</th><th>Recipient</th><th>Team</th><th>Match</th><th>Prize</th><th>Action</th></tr>${awards.map(a=>`<tr><td>${esc(a.season||"")}</td><td>${esc(a.awardName||"")}</td><td><b>${esc(a.playerName||a.recipientName||"")}</b></td><td>${esc(a.teamName||"")}</td><td>${esc(a.matchId||"")}</td><td>${esc(a.prize||"")}</td><td><button class="aw-btn gray" data-edit="${esc(a.id)}">Edit</button></td></tr>`).join("")}</table>`:"<p class='aw-status'>এখনও কোনো award save হয়নি।</p>";
 $("awardTable").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editAward(b.dataset.edit));
}

function editAward(id){
 const a=awards.find(x=>x.id===id);if(!a)return;
 editingId=id;$("saveType").value=a.awardType||"CUSTOM";$("recipient").value=a.playerName||a.recipientName||"";
 $("teamName").value=a.teamName||"";$("awardPrize").value=a.prize||"";$("awardCustomName").value=a.awardType==="CUSTOM"?a.awardName||"":"";
 $("awardNote").value=a.note||"";$("saveMatch").value=a.matchId||"";$("awardSeason").value=a.season||2026;
 $("saveAward").textContent="✏️ Update Award";$("cancelEdit").classList.remove("hidden");
 $("awardMsg").textContent="Edit mode চালু হয়েছে। পরিবর্তন করে Update Award চাপুন।";
 window.scrollTo({top:0,behavior:"smooth"});
}

function resetEdit(){
 editingId=null;$("saveAward").textContent="💾 Save Award";$("cancelEdit").classList.add("hidden");
 $("recipient").value="";$("teamName").value="";$("awardPrize").value="";$("awardCustomName").value="";$("awardNote").value="";$("awardMsg").textContent="";
}

async function saveAward(){
 const type=$("saveType").value,label=AWARDS.find(a=>a[0]===type)?.[1]||type;
 const custom=$("awardCustomName").value.trim(),recipient=$("recipient").value.trim();
 const name=custom||label;
 if(!recipient){$("awardMsg").textContent="প্রাপক / Player / Team-এর নাম দিন।";return;}
 const season=Number($("awardSeason").value||2026);
 const matchId=$("saveMatch").value||"";
 const player=players.find(p=>(p.name||p.playerName)===recipient);
 const payload={
  season,awardType:type,awardName:name,playerId:player?.id||"",playerName:recipient,recipientName:recipient,
  teamId:player?.teamId||"",teamName:$("teamName").value.trim(),matchId,
  prize:$("awardPrize").value.trim(),note:$("awardNote").value.trim(),public:true,
  calculatedBy:"VCAJ Free Smart Awards Engine",updatedAt:serverTimestamp()
 };
 if(editingId){
   await updateDoc(doc(db,"awards",editingId),payload);
   $("awardMsg").textContent="Award update হয়েছে।";
 }else{
   const id=`award-${season}-${Date.now()}`;
   await setDoc(doc(db,"awards",id),{...payload,id,createdAt:serverTimestamp()});
   $("awardMsg").textContent="Award save হয়েছে।";
 }
 const snap=await getDocs(collection(db,"awards"));
 awards=snap.docs.map(d=>({id:d.id,...d.data()}));
 renderAwards();resetEdit();
}

$("calculateAward").onclick=()=>calculateAward().catch(e=>{$("calcError").className="aw-error";$("calcError").textContent=`Calculation error: ${e.message}`;});
$("saveAward").onclick=()=>saveAward().catch(e=>{$("awardMsg").textContent=`Save error: ${e.message}`;});
$("cancelEdit").onclick=resetEdit;
$("awardScope").onchange=()=>{};
$("logout").onclick=()=>signOut(auth);

onAuthStateChanged(auth,async user=>{
 if(!user||!isAdmin(user)){
   $("authError").textContent="Admin access প্রয়োজন। Login করুন।";
   $("authError").classList.remove("hidden");$("app").classList.add("hidden");
   if(user)await signOut(auth);
   return;
 }
 $("app").classList.remove("hidden");
 try{await load();}
 catch(e){$("authError").textContent=`Awards Panel load error: ${e.message}`;$("authError").className="aw-error";}
});
