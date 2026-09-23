import {
  auth, db, isAdmin,
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  onAuthStateChanged, signOut
} from "./firebase.js";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
}[c]));

const AWARDS = [
  ["SERIES_MOTM","ম্যান অব দ্য সিরিজ"],
  ["FINAL_MOTM","ফাইনাল ম্যান অব দ্য ম্যাচ"],
  ["MATCH_MOTM","প্রতিটা ম্যাচের ম্যান অব দ্য ম্যাচ"],
  ["BEST_BATSMAN","সেরা ব্যাটসম্যান"],
  ["BEST_BOWLER","সেরা বোলার"],
  ["BEST_ALLROUNDER","সেরা অলরাউন্ডার"],
  ["BEST_WICKETKEEPER","সেরা উইকেটকিপার"],
  ["BEST_FIELDER","সেরা ফিল্ডার"],
  ["MOST_RUNS","সর্বোচ্চ রান সংগ্রাহক"],
  ["MOST_WICKETS","সর্বোচ্চ উইকেট সংগ্রাহক"],
  ["EMERGING","উদীয়মান খেলোয়াড় (Emerging Player)"],
  ["HAT_TRICK","হ্যাটট্রিক পুরস্কার"],
  ["CENTURY","শতরান পুরস্কার"],
  ["FIFTY","অর্ধশতরান পুরস্কার"],
  ["BEST_CATCH","সেরা ক্যাচ"],
  ["BEST_RUN_OUT","সেরা রান-আউট"],
  ["BEST_BOWLING_SPELL","সেরা বোলিং স্পেল"],
  ["BEST_BATTING_INNINGS","সেরা ব্যাটিং ইনিংস"],
  ["MOST_SIXES","সর্বাধিক ছক্কা"],
  ["FAIR_PLAY","Fair Play Trophy"],
  ["TEAM_SPIRIT","Best Team Spirit Award"],
  ["BEST_CAPTAIN","Best Captain Award"],
  ["SUPPORTED_TEAM","Best Supported Team Award"],
  ["SF1_MOTM","সেমিফাইনাল–১ ম্যান অব দ্য ম্যাচ"],
  ["SF2_MOTM","সেমিফাইনাল–২ ম্যান অব দ্য ম্যাচ"],
  ["TOURNAMENT_MOMENT","Moment of the Tournament"]
];

let players = [];
let teams = [];
let matches = [];
let eventCache = new Map();
let calculated = null;

function msg(text, cls="") {
  $("topMsg").textContent = text;
  $("topMsg").className = "msg " + cls;
}

function playerName(p){ return p?.name || p?.playerName || p?.id || ""; }

function numeric(p, key){ return Number(p?.[key] || 0); }

function fillAwardTypes(){
  $("awardType").innerHTML = AWARDS.map(([v,t]) =>
    `<option value="${v}">${esc(t)}</option>`).join("");
}

async function loadAll(){
  const [ps, ts, ms] = await Promise.all([
    getDocs(collection(db,"players")),
    getDocs(collection(db,"teams")),
    getDocs(collection(db,"matches"))
  ]);

  players = ps.docs.map(d=>({id:d.id,...d.data()}))
    .sort((a,b)=>playerName(a).localeCompare(playerName(b)));
  teams = ts.docs.map(d=>({id:d.id,...d.data()}));
  matches = ms.docs.map(d=>({id:d.id,...d.data()}));

  renderPlayers();
  fillPlayerSelect();
  renderSavedAwards();
  msg(`Loaded ${players.length} players, ${matches.length} matches.`, "success");
}

function fillPlayerSelect(){
  const selected = $("awardPlayer").value;
  $("awardPlayer").innerHTML =
    `<option value="">Player নির্বাচন করুন</option>` +
    players.map(p=>`<option value="${esc(p.id)}">${esc(playerName(p))}${p.teamName?` — ${esc(p.teamName)}`:""}</option>`).join("");
  if(players.some(p=>p.id===selected)) $("awardPlayer").value=selected;
}

function renderPlayers(){
  const rows = players.map(p=>`
    <tr>
      <td>${esc(playerName(p))}</td>
      <td>${esc(p.teamName||"")}</td>
      <td>${numeric(p,"totalRuns")}</td>
      <td>${numeric(p,"totalWickets")}</td>
      <td>${numeric(p,"totalSixes")}</td>
      <td>${numeric(p,"fieldingCatches")}</td>
      <td>${numeric(p,"fieldingRunOuts")}</td>
      <td>${numeric(p,"bowlingHatTricks") + numeric(p,"battingHatTricks") + numeric(p,"fieldingHatTricks")}</td>
    </tr>`).join("");

  $("playerStats").innerHTML = rows ? `
    <div class="table-wrap"><table>
      <thead><tr><th>Player</th><th>Team</th><th>Runs</th><th>Wickets</th><th>Sixes</th><th>Catches</th><th>Run Outs</th><th>Hat-tricks</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>` : `<p class="muted">No player records found.</p>`;
}

async function eventsFor(match){
  if(eventCache.has(match.id)) return eventCache.get(match.id);
  const snap = await getDocs(collection(db,"matches",match.id,"events"));
  const events = snap.docs.map(d=>d.data()).sort((a,b)=>
    String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
  eventCache.set(match.id, events);
  return events;
}

function playerScore(p){
  return numeric(p,"totalRuns")
    + numeric(p,"totalWickets")*20
    + numeric(p,"fieldingCatches")*10
    + numeric(p,"fieldingRunOuts")*10
    + numeric(p,"fieldingStumpings")*10;
}

async function bestMatchPlayer(match){
  const events = await eventsFor(match);
  const score = {};
  const info = {};
  for(const e of events){
    if(e.strikerId){
      const id=e.strikerId;
      score[id]=(score[id]||0)+(numeric(e,"batterRuns"));
      info[id] ||= {name:e.batterName||id};
    }
    if(e.bowlerId){
      const id=e.bowlerId;
      score[id]=(score[id]||0)+numeric(e,"bowlerWicket")*20;
      info[id] ||= {name:e.bowlerName||id};
    }
    if(e.fielderId){
      const id=e.fielderId;
      score[id]=(score[id]||0)+10;
      info[id] ||= {name:e.fielderName||id};
    }
  }
  const id=Object.keys(score).sort((a,b)=>score[b]-score[a])[0];
  return id ? {id,name:info[id]?.name||id,score:score[id]} : null;
}

function candidateFor(type){
  if(!players.length) return null;
  const by=(fn)=>
    [...players].sort((a,b)=>fn(b)-fn(a))[0];

  switch(type){
    case "MOST_RUNS": return by(p=>numeric(p,"totalRuns"));
    case "MOST_WICKETS": return by(p=>numeric(p,"totalWickets"));
    case "MOST_SIXES": return by(p=>numeric(p,"totalSixes"));
    case "HAT_TRICK": return by(p=>numeric(p,"bowlingHatTricks")+numeric(p,"battingHatTricks")+numeric(p,"fieldingHatTricks"));
    case "BEST_BATSMAN": return by(p=>numeric(p,"totalRuns") + numeric(p,"totalFours")*2 + numeric(p,"totalSixes")*3);
    case "BEST_BOWLER": return by(p=>numeric(p,"totalWickets")*20 - numeric(p,"totalBowlingRuns")/10);
    case "BEST_ALLROUNDER": return by(p=>numeric(p,"totalRuns") + numeric(p,"totalWickets")*20);
    case "BEST_FIELDER": return by(p=>numeric(p,"fieldingCatches")*10 + numeric(p,"fieldingRunOuts")*10 + numeric(p,"fieldingStumpings")*10);
    case "BEST_WICKETKEEPER": return by(p=>numeric(p,"fieldingCatches") + numeric(p,"fieldingStumpings")*2);
    case "BEST_CATCH": return by(p=>numeric(p,"fieldingCatches"));
    case "BEST_RUN_OUT": return by(p=>numeric(p,"fieldingRunOuts"));
    case "CENTURY": return by(p=>numeric(p,"centuries"));
    case "FIFTY": return by(p=>numeric(p,"fifties"));
    default: return by(playerScore);
  }
}

async function calculateAward(){
  const type=$("awardType").value;
  calculated=null;

  if(["MATCH_MOTM","FINAL_MOTM","SF1_MOTM","SF2_MOTM"].includes(type)){
    let candidates=matches.filter(m=>m.status==="COMPLETED");
    if(type==="FINAL_MOTM") candidates=candidates.filter(m=>m.stage==="FINAL");
    if(type==="SF1_MOTM"||type==="SF2_MOTM"){
      candidates=candidates.filter(m=>m.stage==="SF").sort((a,b)=>String(a.id).localeCompare(String(b.id)));
      candidates=type==="SF1_MOTM"?candidates.slice(0,1):candidates.slice(1,2);
    }
    if(!candidates.length){
      $("calcResult").textContent="এই category-এর জন্য completed match পাওয়া যায়নি।";
      return;
    }
    if(type==="MATCH_MOTM"){
      const results=[];
      for(const m of candidates){
        const best=await bestMatchPlayer(m);
        if(best) results.push({matchId:m.id,...best});
      }
      $("calcResult").innerHTML=results.length ?
        `<b>Calculated Match MOTM candidates:</b><br>${results.map(x=>`${esc(x.matchId)} — ${esc(x.name)} (${x.score})`).join("<br>")}` :
        "Match event data পাওয়া যায়নি।";
      calculated={multi:results};
      return;
    }
    const best=await bestMatchPlayer(candidates[0]);
    if(best){
      $("awardPlayer").value=best.id;
      $("calcResult").textContent=`Calculated: ${best.name} — performance score ${best.score}`;
      showSelectedRecord();
    }
    calculated=best;
    return;
  }

  const p=candidateFor(type);
  if(!p){
    $("calcResult").textContent="Player record পাওয়া যায়নি।";
    return;
  }
  $("awardPlayer").value=p.id;
  const label=AWARDS.find(x=>x[0]===type)?.[1]||type;
  $("calcResult").textContent=`Calculated ${label}: ${playerName(p)}`;
  calculated=p;
  showSelectedRecord();
}

function showSelectedRecord(){
  const p=players.find(x=>x.id===$("awardPlayer").value);
  if(!p){
    $("selectedPlayerRecord").textContent="Player নির্বাচন করলে record এখানে দেখাবে।";
    return;
  }
  $("selectedPlayerRecord").innerHTML=`
    <b>${esc(playerName(p))}</b> — ${esc(p.teamName||"")}<br>
    Runs: ${numeric(p,"totalRuns")} • Balls: ${numeric(p,"totalBalls")} • 4s: ${numeric(p,"totalFours")} • 6s: ${numeric(p,"totalSixes")}<br>
    Wickets: ${numeric(p,"totalWickets")} • Bowling balls: ${numeric(p,"totalBowlingBalls")} • Bowling runs: ${numeric(p,"totalBowlingRuns")}<br>
    Catches: ${numeric(p,"fieldingCatches")} • Stumpings: ${numeric(p,"fieldingStumpings")} • Run Outs: ${numeric(p,"fieldingRunOuts")}<br>
    Hat-tricks: ${numeric(p,"bowlingHatTricks")+numeric(p,"battingHatTricks")+numeric(p,"fieldingHatTricks")}
  `;
}

async function saveAward(){
  const type=$("awardType").value;
  const custom=$("customAwardName").value.trim();
  const playerId=$("awardPlayer").value;
  const season=Number($("awardSeason").value||2026);

  if(!playerId && !["FAIR_PLAY","TEAM_SPIRIT","SUPPORTED_TEAM","TOURNAMENT_MOMENT"].includes(type)){
    $("calcResult").textContent="আগে Player নির্বাচন করুন বা Calculate Award চাপুন।";
    return;
  }

  const p=players.find(x=>x.id===playerId);
  const awardName=custom || AWARDS.find(x=>x[0]===type)?.[1] || type;
  const id=`award-${Date.now()}`;

  const data={
    id,season,type,awardName,
    playerId:playerId||"",
    playerName:p?playerName(p):"",
    teamId:p?.teamId||"",
    teamName:p?.teamName||"",
    prize:$("awardPrize").value.trim(),
    note:$("awardNote").value.trim(),
    public:true,
    createdAt:new Date().toISOString()
  };

  await setDoc(doc(db,"awards",id),data);
  $("calcResult").textContent=`${awardName} save হয়েছে। Public panel-এর জন্য record প্রস্তুত।`;
  await renderSavedAwards();
}

async function renderSavedAwards(){
  const snap=await getDocs(collection(db,"awards"));
  const list=snap.docs.map(d=>({id:d.id,...d.data()}))
    .sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));

  $("savedAwards").innerHTML=list.length ? `
    <div class="table-wrap"><table>
      <thead><tr><th>Award</th><th>Winner</th><th>Team</th><th>Season</th><th>Prize</th><th>Public</th><th>Action</th></tr></thead>
      <tbody>${list.map(a=>`
        <tr>
          <td>${esc(a.awardName)}</td>
          <td>${esc(a.playerName||a.teamName||"—")}</td>
          <td>${esc(a.teamName||"")}</td>
          <td>${esc(a.season)}</td>
          <td>${esc(a.prize||"")}</td>
          <td>${a.public?"YES":"NO"}</td>
          <td><button class="danger" style="width:auto" data-delete-award="${esc(a.id)}">Delete</button></td>
        </tr>`).join("")}</tbody>
    </table></div>` : `<p class="muted">কোনো award save করা হয়নি।</p>`;

  document.querySelectorAll("[data-delete-award]").forEach(b=>{
    b.onclick=async()=>{
      if(!confirm("এই award delete করতে চান?")) return;
      await deleteDoc(doc(db,"awards",b.dataset.deleteAward));
      await renderSavedAwards();
    };
  });
}

$("awardPlayer").onchange=showSelectedRecord;
$("calculateBtn").onclick=()=>calculateAward().catch(e=>{$("calcResult").textContent=`Calculate হয়নি: ${e.message}`;});
$("saveBtn").onclick=()=>saveAward().catch(e=>{$("calcResult").textContent=`Save হয়নি: ${e.message}`;});
$("refreshBtn").onclick=()=>loadAll().catch(e=>msg(`Refresh হয়নি: ${e.message}`,"error"));
$("logoutBtn").onclick=()=>signOut(auth);

onAuthStateChanged(auth, async user=>{
  if(!user || !isAdmin(user)){
    location.replace("index.html");
    return;
  }
  fillAwardTypes();
  try{ await loadAll(); }
  catch(e){ msg(`Data load হয়নি: ${e.message}`,"error"); }
});
