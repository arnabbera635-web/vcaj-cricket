import {auth,db,isAdmin,collection,doc,getDocs,setDoc,serverTimestamp,onAuthStateChanged,signOut} from "./firebase.js";
const $=id=>document.getElementById(id),N=v=>Number(v||0),esc=s=>String(s??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let players=[],matches=[],playerMap=new Map(),chosenMatch=null,calc=[],aggregate=null;
const TOURNAMENT=[
["MOST_RUNS","সর্বোচ্চ রান সংগ্রাহক"],["MOST_WICKETS","সর্বোচ্চ উইকেট সংগ্রাহক"],["MOST_SIXES","সর্বাধিক ছক্কা"],["BEST_BATSMAN","সেরা ব্যাটসম্যান"],["BEST_BOWLER","সেরা বোলার"],["BEST_ALLROUNDER","সেরা অলরাউন্ডার"],["BEST_WICKETKEEPER","সেরা উইকেটকিপার"],["BEST_FIELDER","সেরা ফিল্ডার"],["HAT_TRICK","হ্যাটট্রিক পুরস্কার"],["CENTURY","শতরান পুরস্কার"],["FIFTY","অর্ধশতরান পুরস্কার"],["BEST_BOWLING_SPELL","সেরা বোলিং স্পেল"],["BEST_BATTING_INNINGS","সেরা ব্যাটিং ইনিংস"],["BEST_CATCH","সেরা ক্যাচ"],["BEST_RUN_OUT","সেরা রান-আউট"],["SERIES_MOTM","ম্যান অব দ্য সিরিজ"],["EMERGING","উদীয়মান খেলোয়াড়"],["FAIR_PLAY","Fair Play Trophy"],["TEAM_SPIRIT","Best Team Spirit Award"],["BEST_CAPTAIN","Best Captain Award"],["SUPPORTED_TEAM","Best Supported Team Award"],["TOURNAMENT_MOMENT","Moment of the Tournament"],["CUSTOM","Custom Tournament Award"]];
const MATCH=[
["MATCH_MOTM","ম্যান অব দ্য ম্যাচ"],["MOST_RUNS","ম্যাচে সর্বোচ্চ রান"],["MOST_WICKETS","ম্যাচে সর্বোচ্চ উইকেট"],["MOST_SIXES","ম্যাচে সর্বাধিক ছক্কা"],["BEST_BATTING_INNINGS","সেরা ব্যাটিং ইনিংস"],["BEST_BOWLING_SPELL","সেরা বোলিং স্পেল"],["BEST_FIELDER","সেরা ফিল্ডার"],["BEST_CATCH","সেরা ক্যাচ"],["BEST_RUN_OUT","সেরা রান-আউট"],["HAT_TRICK","হ্যাটট্রিক পুরস্কার"],["CENTURY","শতরান"],["FIFTY","অর্ধশতরান"],["CUSTOM","বিশেষ ম্যাচ পুরস্কার"]];
const zero=()=>({runs:0,balls:0,fours:0,sixes:0,wickets:0,bowlingBalls:0,bowlingRuns:0,catches:0,stumpings:0,runOuts:0,hatTricks:0,centuries:0,fifties:0,innings:[],spells:[]});
const rate=p=>p.balls?p.runs/p.balls*100:0,eco=p=>p.bowlingBalls?p.bowlingRuns/(p.bowlingBalls/6):0;
const pname=id=>playerMap.get(id)?.name||id||"Unknown";
function add(map,id){if(!id)return null;if(!map.has(id))map.set(id,zero());return map.get(id)}
function aggregateEvents(events){
 const map=new Map(),inn=new Map(),spell=new Map(),streak=new Map();
 const ordered=[...events].sort((a,b)=>{
  const dateValue=v=>{try{if(v?.toDate)return v.toDate().getTime();const n=Date.parse(v||'');return Number.isFinite(n)?n:0}catch{return 0}};
  const ta=dateValue(a.createdAt)||Number(String(a.eventId||'').match(/\d{10,}/)?.[0]||0);
  const tb=dateValue(b.createdAt)||Number(String(b.eventId||'').match(/\d{10,}/)?.[0]||0);
  return ta-tb||String(a.eventId||'').localeCompare(String(b.eventId||''));
 });
 for(const e of ordered){
  if(e.superOver===true)continue;
  const no=Number(e.inningsNo||1),matchId=e._matchId||'unknown-match',ik=`${matchId}|${no}`;
  if(e.strikerId){
   const p=add(map,e.strikerId);p.runs+=N(e.batterRuns);if(e.legal===true)p.balls++;if(N(e.batterRuns)===4)p.fours++;if(N(e.batterRuns)===6)p.sixes++;
   const k=ik+'|'+e.strikerId;if(!inn.has(k))inn.set(k,{playerId:e.strikerId,inningsNo:no,matchId,runs:0,balls:0,fours:0,sixes:0});
   const x=inn.get(k);x.runs+=N(e.batterRuns);if(e.legal===true)x.balls++;if(N(e.batterRuns)===4)x.fours++;if(N(e.batterRuns)===6)x.sixes++;
  }
  if(e.bowlerId){
   const p=add(map,e.bowlerId);if(e.legal===true)p.bowlingBalls++;p.bowlingRuns+=N(e.bowlerRuns);if(e.bowlerWicket===true)p.wickets++;
   const k=ik+'|'+e.bowlerId;if(!spell.has(k))spell.set(k,{playerId:e.bowlerId,inningsNo:no,matchId,balls:0,runs:0,wickets:0});
   const sp=spell.get(k);if(e.legal===true)sp.balls++;sp.runs+=N(e.bowlerRuns);if(e.bowlerWicket===true)sp.wickets++;
   const streakKey=ik+'|'+e.bowlerId;
   if(e.legal===true){const seq=streak.get(streakKey)||0,now=e.type==='wicket'&&e.bowlerWicket===true?seq+1:0;streak.set(streakKey,now);if(now===3){p.hatTricks++;streak.set(streakKey,0)}}
  }
  if(e.fielderId){const p=add(map,e.fielderId);if(e.dismissalType==='caught')p.catches++;if(e.dismissalType==='stumped')p.stumpings++;if(e.dismissalType==='runOut')p.runOuts++}
 }
 for(const x of inn.values()){const p=map.get(x.playerId);if(x.runs>=100)p.centuries++;else if(x.runs>=50)p.fifties++;p.innings.push(x)}
 for(const sp of spell.values())map.get(sp.playerId).spells.push(sp);
 return {map,innings:[...inn.values()],spells:[...spell.values()]};
}
function score(t,p){switch(t){case'MOST_RUNS':case'BEST_BATSMAN':return p.runs;case'MOST_WICKETS':case'BEST_BOWLER':return p.wickets;case'MOST_SIXES':return p.sixes;case'BEST_ALLROUNDER':return p.runs+p.wickets*20;case'BEST_FIELDER':return p.catches*10+p.stumpings*12+p.runOuts*12;case'BEST_CATCH':return p.catches;case'BEST_RUN_OUT':return p.runOuts;case'HAT_TRICK':return p.hatTricks;case'CENTURY':return p.centuries;case'FIFTY':return p.fifties;default:return 0}}
function eligible(t,p){if(['MOST_RUNS','BEST_BATSMAN'].includes(t))return p.balls>0;if(['MOST_WICKETS','BEST_BOWLER'].includes(t))return p.bowlingBalls>0||p.wickets>0;if(t==='MOST_SIXES')return p.sixes>0;if(t==='BEST_ALLROUNDER')return p.runs>0&&p.wickets>0;if(t==='BEST_FIELDER')return p.catches+p.stumpings+p.runOuts>0;if(t==='BEST_CATCH')return p.catches>0;if(t==='BEST_RUN_OUT')return p.runOuts>0;if(t==='HAT_TRICK')return p.hatTricks>0;if(t==='CENTURY')return p.centuries>0;if(t==='FIFTY')return p.fifties>0;return false}

function recGrid(p){return [["Runs",p.runs],["Balls",p.balls],["SR",rate(p).toFixed(2)],["4s",p.fours],["6s",p.sixes],["Wickets",p.wickets],["Bowl Runs",p.bowlingRuns],["Overs",`${Math.floor(p.bowlingBalls/6)}.${p.bowlingBalls%6}`],["Economy",eco(p).toFixed(2)],["Catches",p.catches],["Stumpings",p.stumpings],["Run Outs",p.runOuts],["Hat-tricks",p.hatTricks]].map(([k,v])=>`<div class="record"><b>${esc(v)}</b><small>${k}</small></div>`).join("")}
function candidateList(t,a){
 if(t==="BEST_BATTING_INNINGS")return a.innings.filter(x=>x.runs>0).sort((x,y)=>y.runs-x.runs).map(x=>({id:x.playerId,name:pname(x.playerId),detail:`${x.runs} runs (${x.balls} balls), innings ${x.inningsNo}`,record:a.map.get(x.playerId)}));
 if(t==="BEST_BOWLING_SPELL")return a.spells.filter(x=>x.balls>0||x.wickets>0).sort((x,y)=>y.wickets-x.wickets||x.runs-y.runs).map(x=>({id:x.playerId,name:pname(x.playerId),detail:`${x.wickets}/${x.runs} in ${Math.floor(x.balls/6)}.${x.balls%6} overs, innings ${x.inningsNo}`,record:a.map.get(x.playerId)}));
 return [...a.map.entries()].map(([id,p])=>({id,name:pname(id),...p,record:p})).filter(p=>eligible(t,p)).sort((x,y)=>score(t,y)-score(t,x)||(t==='BEST_BATSMAN'?rate(y)-rate(x):t==='BEST_BOWLER'?eco(x)-eco(y):0)||y.runs-x.runs||x.name.localeCompare(y.name)).map(p=>({...p,detail:`${p.runs} runs • ${p.wickets} wickets • ${p.catches+p.stumpings+p.runOuts} fielding dismissals`}));
}
function scope(){return $("awardScope").value}
function options(){const list=scope()==="MATCH"?MATCH:TOURNAMENT;$("awardType").innerHTML=list.map(([v,n])=>`<option value="${v}">${esc(n)}</option>`).join("");$("matchWrap").classList.toggle("hidden",scope()!=="MATCH");$("results").innerHTML="";calc=[];$("winnerPlayer").innerHTML='<option value="">আগে Calculate করুন</option>';$("modeNote").textContent=scope()==="MATCH"?"একটি ম্যাচের event থেকে হিসাব হবে।":"নির্বাচিত Season-এর সব completed match-এর event থেকে হিসাব হবে।"}
function renderMatches(){const old=$("matchPicker").value,season=N($("season").value||2026),list=matches.filter(m=>N(m.season||2026)===season);$("matchPicker").innerHTML='<option value="">ম্যাচ নির্বাচন করুন</option>'+list.map(m=>`<option value="${esc(m.id)}">${esc(m.title||`${m.team1Name||""} vs ${m.team2Name||""}`)} • ${esc(m.stageName||m.stage||"")}</option>`).join("");if(list.some(m=>m.id===old))$("matchPicker").value=old}
async function loadSaved(){try{const s=await getDocs(collection(db,"awards")),a=s.docs.map(d=>d.data());$("saved").innerHTML=a.length?`<div class="table-wrap"><table><tr><th>Type</th><th>Season</th><th>Match</th><th>Award</th><th>Winner</th><th>Record</th></tr>${a.map(x=>`<tr><td>${esc(x.scope||"TOURNAMENT")}</td><td>${esc(x.season||"")}</td><td>${esc(x.matchTitle||"—")}</td><td>${esc(x.awardName||"")}</td><td>${esc(x.playerName||"")}</td><td>${N(x.recordSnapshot?.runs)} R • ${N(x.recordSnapshot?.wickets)} W</td></tr>`).join("")}</table></div>`:"এখনও কোনো Award save হয়নি।"}catch(e){$("saved").textContent=`Saved Awards load error: ${e.code||e.message}`}}
async function load(){const [ps,ms]=await Promise.all([getDocs(collection(db,"players")),getDocs(collection(db,"matches"))]);players=ps.docs.map(d=>({id:d.id,...d.data()}));playerMap=new Map(players.map(p=>[p.id,p]));matches=ms.docs.map(d=>({id:d.id,...d.data()}));$("playerCount").textContent=`${players.length} জন Player • ${matches.length} টি Match`;renderMatches();await loadSaved()}
async function calculate(){
 const season=N($("season").value||2026),isMatch=scope()==="MATCH";let list;
 if(isMatch){chosenMatch=matches.find(m=>m.id===$("matchPicker").value);if(!chosenMatch){$("calcMsg").textContent="একটি ম্যাচ নির্বাচন করুন।";return}if(String(chosenMatch.status||"").toUpperCase()!=="COMPLETED"){ $("calcMsg").textContent="Award হিসাবের আগে ম্যাচটি COMPLETED হতে হবে।";return;}list=[chosenMatch]}
 else{list=matches.filter(m=>N(m.season||2026)===season&&String(m.status||"").toUpperCase()==="COMPLETED");if(!list.length){$("calcMsg").textContent=`${season} Season-এ completed match নেই।`;return}}
 $("calculate").disabled=true;$("calcMsg").textContent="Match event হিসাব হচ্ছে...";
 try{
  const groups=await Promise.all(list.map(async m=>({match:m,events:(await getDocs(collection(db,"matches",m.id,"events"))).docs.map(d=>({...d.data(),_matchId:m.id}))})));
  const events=groups.flatMap(x=>x.events),a=aggregateEvents(events),type=$("awardType").value;aggregate=a;
  const manual=["BEST_WICKETKEEPER","MATCH_MOTM","SERIES_MOTM","EMERGING","FAIR_PLAY","TEAM_SPIRIT","BEST_CAPTAIN","SUPPORTED_TEAM","TOURNAMENT_MOMENT","CUSTOM"].includes(type);
  calc=manual?[]:candidateList(type,a);
  $("results").innerHTML=manual?'<div class="notice">এই পুরস্কারটি manual selection-এর জন্য। Player dropdown থেকে বিজয়ী নির্বাচন করুন। Wicketkeeper-এর আলাদা role data scorer-এ নেই, তাই catch/stumping দেখে স্বয়ংক্রিয়ভাবে keeper নির্ধারণ করা হচ্ছে না।</div>':calc.length?`<div class="calc-head"><b>Calculated Candidates</b><span>${calc.length} জন</span></div><div class="player-cards">${calc.map((p,i)=>`<article class="player-card ${i===0?"recommended":""}"><div class="player-top"><div><div class="rank">#${i+1}${i===0?" • Top result":""}</div><h3>${esc(p.name)}</h3><div class="team">${esc(p.detail||"")}</div></div><button type="button" data-pick="${esc(p.id)}">Select</button></div>${p.record?`<div class="record-grid">${recGrid(p.record)}</div>`:""}</article>`).join("")}</div>`:"এই award-এর eligible record পাওয়া যায়নি।";
  const order=[...calc.map(p=>p.id),...players.filter(p=>!calc.some(c=>c.id===p.id)).map(p=>p.id)];
  $("winnerPlayer").innerHTML='<option value="">Player নির্বাচন করুন</option>'+order.map(id=>`<option value="${esc(id)}">${esc(pname(id))}</option>`).join("");
  if(calc[0])$("winnerPlayer").value=calc[0].id;
  $("results").querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{$("winnerPlayer").value=b.dataset.pick});
  $("calcMsg").textContent=`${list.length} টি ম্যাচ • ${events.length} টি event • ${calc.length} eligible result`;
 }catch(e){console.error(e);$("calcMsg").textContent=`Calculation error: ${e.code||e.message}`}finally{$("calculate").disabled=false}
}
async function save(){
 const id=$("winnerPlayer").value;if(!id){$("saveMsg").textContent="Winner player নির্বাচন করুন।";return}
 const season=N($("season").value||2026),type=$("awardType").value,match=scope()==="MATCH"?matches.find(m=>m.id===$("matchPicker").value):null;
 const label=(scope()==="MATCH"?MATCH:TOURNAMENT).find(x=>x[0]===type)?.[1]||type,custom=$("customName").value.trim(),name=type==="CUSTOM"?custom:label;
 if(!name){$("saveMsg").textContent="Award-এর নাম লিখুন।";return}
 const p=playerMap.get(id),r=aggregate?.map?.get(id)||zero(),bestInnings=r.innings.slice().sort((a,b)=>b.runs-a.runs)[0]||null,bestSpell=r.spells.slice().sort((a,b)=>b.wickets-a.wickets||a.runs-b.runs)[0]||null;
 const recordSnapshot={runs:r.runs,balls:r.balls,fours:r.fours,sixes:r.sixes,wickets:r.wickets,bowlingBalls:r.bowlingBalls,bowlingRuns:r.bowlingRuns,catches:r.catches,stumpings:r.stumpings,runOuts:r.runOuts,hatTricks:r.hatTricks,centuries:r.centuries,fifties:r.fifties,bestInnings,bestSpell};
 $("save").disabled=true;
 try{const aid=`award-${season}-${Date.now()}`;await setDoc(doc(db,"awards",aid),{id:aid,season,scope:scope(),matchId:match?.id||"",matchTitle:match?.title||"",awardType:type,awardName:name,playerId:id,playerName:p?.name||id,teamId:p?.teamId||"",teamName:p?.teamName||"",prize:$("prize").value.trim(),note:$("note").value.trim(),recordSnapshot,public:true,createdAt:serverTimestamp()});$("saveMsg").textContent="Award save হয়েছে।";$("prize").value=$("note").value=$("customName").value="";await loadSaved()}catch(e){$("saveMsg").textContent=`Save error: ${e.code||e.message}. Firestore awards write permission পরীক্ষা করুন।`}finally{$("save").disabled=false}
}
$("awardScope").onchange=options;$("season").onchange=renderMatches;$("calculate").onclick=calculate;$("save").onclick=save;
onAuthStateChanged(auth,async user=>{if(!user||!isAdmin(user)){location.href="admin.html";return}try{await load();options()}catch(e){$("playerCount").textContent=`Firebase load error: ${e.code||e.message}`}});
$("logout").onclick=()=>signOut(auth);
