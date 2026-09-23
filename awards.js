import {db,collection,doc,getDocs,setDoc,serverTimestamp} from "./firebase.js";

const $ = id => document.getElementById(id);
let players = [];
let awards = [];
let calculatedPlayer = null;
let calculatedRows = [];

const esc = s => String(s ?? "").replace(/[&<>\"]/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
}[c]));
function num(v){ return Number(v || 0); }
function strikeRate(p){ const b=num(p.totalBalls); return b ? num(p.totalRuns)/b*100 : 0; }
function economy(p){ const b=num(p.totalBowlingBalls); return b ? num(p.totalBowlingRuns)/(b/6) : 0; }
function hatTricks(p){ return num(p.bowlingHatTricks)+num(p.battingHatTricks)+num(p.fieldingHatTricks); }

const AWARDS = [
  ["SERIES_MOTM","ম্যান অব দ্য সিরিজ"], ["FINAL_MOTM","ফাইনাল ম্যান অব দ্য ম্যাচ"],
  ["MATCH_MOTM","প্রতিটা ম্যাচের ম্যান অব দ্য ম্যাচ"], ["BEST_BATSMAN","সেরা ব্যাটসম্যান"],
  ["BEST_BOWLER","সেরা বোলার"], ["BEST_ALLROUNDER","সেরা অলরাউন্ডার"],
  ["BEST_WICKETKEEPER","সেরা উইকেটকিপার"], ["BEST_FIELDER","সেরা ফিল্ডার"],
  ["MOST_RUNS","সর্বোচ্চ রান সংগ্রাহক"], ["MOST_WICKETS","সর্বোচ্চ উইকেট সংগ্রাহক"],
  ["EMERGING","উদীয়মান খেলোয়াড় (Emerging Player)"], ["HAT_TRICK","হ্যাটট্রিক পুরস্কার"],
  ["CENTURY","শতরান পুরস্কার"], ["FIFTY","অর্ধশতরান পুরস্কার"], ["BEST_CATCH","সেরা ক্যাচ"],
  ["BEST_RUN_OUT","সেরা রান-আউট"], ["BEST_BOWLING_SPELL","সেরা বোলিং স্পেল"],
  ["BEST_BATTING_INNINGS","সেরা ব্যাটিং ইনিংস"], ["MOST_SIXES","সর্বাধিক ছক্কা"],
  ["FAIR_PLAY","Fair Play Trophy"], ["TEAM_SPIRIT","Best Team Spirit Award"],
  ["BEST_CAPTAIN","Best Captain Award"], ["SUPPORTED_TEAM","Best Supported Team Award"],
  ["SF1_MOTM","সেমিফাইনাল–১ ম্যান অব দ্য ম্যাচ"], ["SF2_MOTM","সেমিফাইনাল–২ ম্যান অব দ্য ম্যাচ"],
  ["TOURNAMENT_MOMENT","Moment of the Tournament"]
];

function playerRecord(p){
  return {
    runs:num(p.totalRuns), balls:num(p.totalBalls), fours:num(p.totalFours), sixes:num(p.totalSixes),
    wickets:num(p.totalWickets), bowlingRuns:num(p.totalBowlingRuns), bowlingBalls:num(p.totalBowlingBalls),
    economy:economy(p), strikeRate:strikeRate(p), catches:num(p.fieldingCatches),
    stumpings:num(p.fieldingStumpings), runOuts:num(p.fieldingRunOuts),
    fieldingDismissals:num(p.fieldingDismissals) || num(p.fieldingCatches)+num(p.fieldingStumpings)+num(p.fieldingRunOuts),
    hatTricks:hatTricks(p), centuries:num(p.centuries), fifties:num(p.fifties)
  };
}

function recordHtml(p){
  const r=playerRecord(p);
  const items=[
    ["Runs",r.runs],["Balls",r.balls],["SR",r.strikeRate.toFixed(2)],["4s",r.fours],["6s",r.sixes],
    ["Wickets",r.wickets],["Bowling Runs",r.bowlingRuns],["Bowling Balls",r.bowlingBalls],["Economy",r.economy.toFixed(2)],
    ["Catches",r.catches],["Stumpings",r.stumpings],["Run Outs",r.runOuts],["Hat-tricks",r.hatTricks]
  ];
  return items.map(([label,value])=>`<div class="record"><b>${esc(value)}</b><small>${esc(label)}</small></div>`).join("");
}

function playerOption(p){ return `<option value="${esc(p.id)}">${esc(p.name||p.playerName||p.id)}${p.teamName?` — ${esc(p.teamName)}`:""}</option>`; }

function scoreFor(type,p){
  const r=playerRecord(p);
  switch(type){
    case "MOST_RUNS": return r.runs*100000+r.balls;
    case "MOST_WICKETS": return r.wickets*100000-r.economy;
    case "MOST_SIXES": return r.sixes*100000+r.runs;
    case "HAT_TRICK": return r.hatTricks*100000+r.wickets;
    case "CENTURY": return r.centuries*100000+r.runs;
    case "FIFTY": return r.fifties*100000+r.runs;
    case "BEST_BATSMAN": return r.runs + r.sixes*3 + r.fours*2 + r.strikeRate*0.5;
    case "BEST_BOWLER": return r.wickets*100 - r.economy*2 + r.bowlingBalls*0.05;
    case "BEST_ALLROUNDER": return r.runs + r.wickets*20 + r.fieldingDismissals*5;
    case "BEST_WICKETKEEPER": return r.stumpings*30+r.catches*10+r.runs*0.2;
    case "BEST_FIELDER": return r.catches*20+r.runOuts*20+r.stumpings*15;
    case "BEST_CATCH": return r.catches*1000+r.fieldingDismissals;
    case "BEST_RUN_OUT": return r.runOuts*1000+r.fieldingDismissals;
    case "BEST_BOWLING_SPELL": return r.wickets*100-r.bowlingRuns+r.bowlingBalls*0.1;
    case "BEST_BATTING_INNINGS": return r.runs+r.sixes*3+r.fours*2;
    default: return r.runs+r.wickets*20+r.fieldingDismissals*10+r.sixes*2;
  }
}

function eligibleFor(type,p){
  const r=playerRecord(p);
  if(["BEST_BOWLER","MOST_WICKETS","BEST_BOWLING_SPELL"].includes(type)) return r.bowlingBalls>0 || r.wickets>0;
  if(["BEST_FIELDER","BEST_CATCH","BEST_RUN_OUT"].includes(type)) return r.fieldingDismissals>0;
  if(type==="BEST_WICKETKEEPER") return r.catches>0 || r.stumpings>0;
  if(type==="HAT_TRICK") return r.hatTricks>0;
  if(type==="CENTURY") return r.centuries>0 || r.runs>=100;
  if(type==="FIFTY") return r.fifties>0 || r.runs>=50;
  if(["BEST_BATSMAN","MOST_RUNS","MOST_SIXES","BEST_BATTING_INNINGS"].includes(type)) return r.balls>0 || r.runs>0;
  return r.runs>0 || r.wickets>0 || r.fieldingDismissals>0;
}

function renderPlayerStats(){
  const ranked=[...players].sort((a,b)=>num(b.totalRuns)-num(a.totalRuns)||num(b.totalWickets)-num(a.totalWickets));
  $("statsTable").innerHTML=ranked.length?`<div class="table-wrap"><table><tr><th>Player</th><th>Team</th><th>Runs</th><th>Balls</th><th>SR</th><th>4s</th><th>6s</th><th>Wickets</th><th>Bowling Runs</th><th>Economy</th><th>Fielding</th><th>Hat-tricks</th></tr>${ranked.map(p=>{const r=playerRecord(p);return `<tr><td><b>${esc(p.name||p.playerName||p.id)}</b></td><td>${esc(p.teamName||"")}</td><td>${r.runs}</td><td>${r.balls}</td><td>${r.strikeRate.toFixed(2)}</td><td>${r.fours}</td><td>${r.sixes}</td><td>${r.wickets}</td><td>${r.bowlingRuns}</td><td>${r.economy.toFixed(2)}</td><td>${r.fieldingDismissals}</td><td>${r.hatTricks}</td></tr>`}).join("")}</table></div>`:`<p class="muted">কোনো player record পাওয়া যায়নি।</p>`;
}

function renderPlayerSelect(){ $("awardPlayer").innerHTML=`<option value="">Player নির্বাচন করুন</option>`+players.map(playerOption).join(""); }

function renderCalculatedRows(type){
  const eligible=players.filter(p=>eligibleFor(type,p));
  const rows=(eligible.length?eligible:[...players]).sort((a,b)=>scoreFor(type,b)-scoreFor(type,a));
  calculatedRows=rows;
  if(!rows.length){ $("calculatedPlayers").innerHTML="<p class='muted'>কোনো player record পাওয়া যায়নি।</p>"; return; }
  $("calculatedPlayers").innerHTML=`<div class="calc-head"><b>${esc($("awardType").selectedOptions[0]?.textContent||type)}</b><span>${rows.length} জন player calculated</span></div><div class="player-cards">${rows.map((p,i)=>{const r=playerRecord(p);const selected=calculatedPlayer&&calculatedPlayer.id===p.id;return `<article class="player-card ${i===0?"recommended":""} ${selected?"selected":""}" data-player-id="${esc(p.id)}"><div class="player-top"><div><div class="rank">#${i+1}${i===0?" • Recommended":""}</div><h3>${esc(p.name||p.playerName||p.id)}</h3><div class="team">${esc(p.teamName||"")}</div></div><button type="button" class="choose-player" data-id="${esc(p.id)}">Select</button></div><div class="record-grid">${recordHtml(p)}</div></article>`}).join("")}</div>`;
  $("calculatedPlayers").querySelectorAll(".choose-player").forEach(btn=>btn.addEventListener("click",()=>selectCalculatedPlayer(btn.dataset.id)));
}

function selectCalculatedPlayer(id){
  const p=players.find(x=>x.id===id); if(!p)return;
  calculatedPlayer=p; $("awardPlayer").value=p.id;
  $("calculatedPlayer").innerHTML=`<b>${esc(p.name||p.playerName||p.id)}</b>${p.teamName?` • ${esc(p.teamName)}`:""}`;
  $("calculatedRecord").innerHTML=recordHtml(p);
  $("awardMsg").textContent=`${p.name||p.playerName||p.id} selected. Save Award চাপলে এই player-এর record save হবে।`;
  renderCalculatedRows($("awardType").value);
}

function calculateAward(){
  const type=$("awardType").value;
  const rows=players.filter(p=>eligibleFor(type,p));
  const ranked=(rows.length?rows:[...players]).sort((a,b)=>scoreFor(type,b)-scoreFor(type,a));
  calculatedPlayer=ranked[0]||null;
  $("awardResult").classList.remove("hidden");
  if(calculatedPlayer){
    $("awardPlayer").value=calculatedPlayer.id;
    $("calculatedPlayer").innerHTML=`<b>${esc(calculatedPlayer.name||calculatedPlayer.playerName||calculatedPlayer.id)}</b>${calculatedPlayer.teamName?` • ${esc(calculatedPlayer.teamName)}`:""}`;
    $("calculatedRecord").innerHTML=recordHtml(calculatedPlayer);
    $("calcMsg").textContent=`${ranked.length} জন player-এর record calculate হয়েছে। প্রথম player-টি recommended; চাইলে নিচের list থেকে অন্য player Select করতে পারবেন।`;
    $("awardMsg").textContent="Calculate Award-এর পরে প্রতিটি player-এর নাম ও সম্পূর্ণ record নিচে দেখানো হয়েছে।";
  }else{
    $("calculatedPlayer").textContent="Player record পাওয়া যায়নি।";
    $("calculatedRecord").innerHTML="";
    $("calcMsg").textContent="Calculation-এর জন্য player record প্রয়োজন।";
  }
  renderCalculatedRows(type);
}

async function load(){
  const [ps,as]=await Promise.all([getDocs(collection(db,"players")),getDocs(collection(db,"awards"))]);
  players=ps.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||a.playerName||"").localeCompare(b.name||b.playerName||""));
  awards=as.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>Number(b.createdAt?.seconds||0)-Number(a.createdAt?.seconds||0));
  renderPlayerSelect(); renderPlayerStats();
  $("awardTable").innerHTML=awards.length?`<div class="table-wrap"><table><tr><th>Season</th><th>Award</th><th>Player</th><th>Team</th><th>Prize</th><th>Record at Award</th><th>Note</th></tr>${awards.map(a=>{const r=a.recordSnapshot||{};return `<tr><td>${a.season||""}</td><td>${esc(a.awardName||"")}</td><td><b>${esc(a.playerName||"")}</b></td><td>${esc(a.teamName||"")}</td><td>${esc(a.prize||"")}</td><td>${r.runs??0} R • ${r.wickets??0} W • ${r.fieldingDismissals??0} F • ${r.hatTricks??0} H</td><td>${esc(a.note||"")}</td></tr>`}).join("")}</table></div>`:"<p class='muted'>এখনও কোনো award save হয়নি।</p>";
}

$("awardType").innerHTML=AWARDS.map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join("");
$("calculateAward").onclick=calculateAward;
$("awardType").onchange=()=>{calculatedPlayer=null;$("awardResult").classList.add("hidden");$("calculatedPlayers").innerHTML="";$("calcMsg").textContent="";};
$("awardPlayer").onchange=()=>selectCalculatedPlayer($("awardPlayer").value);
$("saveAward").onclick=async()=>{
  const pid=$("awardPlayer").value; const p=players.find(x=>x.id===pid);
  if(!p){$("awardMsg").textContent="Calculate Award করুন বা নিচের list থেকে player Select করুন।";return;}
  const type=$("awardType").value; const label=$("awardType").selectedOptions[0]?.textContent||type;
  const awardName=type==="CUSTOM"?$("awardCustomName").value.trim():($("awardCustomName").value.trim()||label);
  if(!awardName){$("awardMsg").textContent="Award-এর নাম দিন।";return;}
  const season=Number($("awardSeason").value||2026); const r=playerRecord(p); const id=`award-${season}-${Date.now()}`;
  await setDoc(doc(db,"awards",id),{id,season,awardName,awardType:type,playerId:p.id,playerName:p.name||p.playerName||p.id,teamId:p.teamId||"",teamName:p.teamName||"",prize:$("awardPrize").value.trim(),note:$("awardNote").value.trim(),recordSnapshot:r,public:true,calculatedBy:"VCAJ Awards Calculator",createdAt:serverTimestamp()});
  $("awardMsg").textContent=`Award Save হয়েছে: ${p.name||p.playerName||p.id} — ${awardName}`;
  $("awardPrize").value=""; $("awardNote").value=""; $("awardCustomName").value=""; await load();
};

await load();
