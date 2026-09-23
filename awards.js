import {db,collection,doc,getDocs,setDoc,serverTimestamp} from "./firebase.js";

const $ = id => document.getElementById(id);
let players = [];
let awards = [];
let calculatedPlayer = null;

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
}[c]));

function num(v){ return Number(v || 0); }

function strikeRate(p){
  const b = num(p.totalBalls);
  return b ? (num(p.totalRuns) / b * 100) : 0;
}

function economy(p){
  const b = num(p.totalBowlingBalls);
  return b ? (num(p.totalBowlingRuns) / (b / 6)) : 0;
}

function hatTricks(p){
  return num(p.bowlingHatTricks) + num(p.battingHatTricks) + num(p.fieldingHatTricks);
}

function playerRecord(p){
  return {
    runs:num(p.totalRuns),
    balls:num(p.totalBalls),
    fours:num(p.totalFours),
    sixes:num(p.totalSixes),
    wickets:num(p.totalWickets),
    bowlingRuns:num(p.totalBowlingRuns),
    bowlingBalls:num(p.totalBowlingBalls),
    economy:economy(p),
    strikeRate:strikeRate(p),
    fieldingDismissals:num(p.fieldingDismissals),
    catches:num(p.fieldingCatches),
    stumpings:num(p.fieldingStumpings),
    runOuts:num(p.fieldingRunOuts),
    hatTricks:hatTricks(p)
  };
}

function recordHtml(p){
  const r = playerRecord(p);
  const items = [
    ["Runs",r.runs],["Balls",r.balls],["4s",r.fours],["6s",r.sixes],
    ["Wickets",r.wickets],["Bowling Runs",r.bowlingRuns],
    ["Economy",r.economy.toFixed(2)],["Strike Rate",r.strikeRate.toFixed(2)],
    ["Fielding Dismissals",r.fieldingDismissals],["Catches",r.catches],
    ["Stumpings",r.stumpings],["Run Outs",r.runOuts],["Hat-tricks",r.hatTricks]
  ];
  return items.map(([label,value]) =>
    `<div class="record"><b>${esc(value)}</b><small>${esc(label)}</small></div>`
  ).join("");
}

function playerOption(p){
  return `<option value="${esc(p.id)}">${esc(p.name)}${p.teamName ? ` — ${esc(p.teamName)}` : ""}</option>`;
}

function renderPlayerStats(){
  const ranked = [...players].sort((a,b) =>
    num(b.totalRuns) - num(a.totalRuns) ||
    num(b.totalWickets) - num(a.totalWickets)
  );

  if(!ranked.length){
    $("statsTable").innerHTML = "<p class='muted'>কোনো player record পাওয়া যায়নি।</p>";
    return;
  }

  $("statsTable").innerHTML = `<div class="table-wrap"><table>
    <tr>
      <th>Player</th><th>Team</th><th>Runs</th><th>Balls</th><th>SR</th>
      <th>4s</th><th>6s</th><th>Wickets</th><th>Bowling Runs</th>
      <th>Economy</th><th>Fielding</th><th>Hat-tricks</th>
    </tr>
    ${ranked.map(p => {
      const r = playerRecord(p);
      return `<tr>
        <td><b>${esc(p.name)}</b></td>
        <td>${esc(p.teamName || "")}</td>
        <td>${r.runs}</td><td>${r.balls}</td><td>${r.strikeRate.toFixed(2)}</td>
        <td>${r.fours}</td><td>${r.sixes}</td><td>${r.wickets}</td>
        <td>${r.bowlingRuns}</td><td>${r.economy.toFixed(2)}</td>
        <td>${r.fieldingDismissals}</td><td>${r.hatTricks}</td>
      </tr>`;
    }).join("")}
  </table></div>`;
}

function renderPlayerSelect(){
  $("awardPlayer").innerHTML =
    `<option value="">Player নির্বাচন করুন</option>` +
    players.map(playerOption).join("");
}

function sortForAward(type){
  const eligible = players.filter(p => {
    const r = playerRecord(p);
    if(type === "Best Batter") return r.balls > 0 || r.runs > 0;
    if(type === "Best Bowler") return r.bowlingBalls > 0 || r.wickets > 0;
    if(type === "Best Fielder") return r.fieldingDismissals > 0;
    if(type === "Best Wicketkeeper") return r.stumpings > 0 || r.catches > 0;
    if(type === "Player of the Tournament")
      return r.runs > 0 || r.wickets > 0 || r.fieldingDismissals > 0;
    return false;
  });

  if(type === "Best Batter"){
    return eligible.sort((a,b) =>
      num(b.totalRuns)-num(a.totalRuns) ||
      strikeRate(b)-strikeRate(a) ||
      num(b.totalSixes)-num(a.totalSixes)
    );
  }

  if(type === "Best Bowler"){
    return eligible.sort((a,b) =>
      num(b.totalWickets)-num(a.totalWickets) ||
      economy(a)-economy(b) ||
      num(b.totalBowlingBalls)-num(a.totalBowlingBalls)
    );
  }

  if(type === "Best Fielder"){
    return eligible.sort((a,b) =>
      num(b.fieldingDismissals)-num(a.fieldingDismissals) ||
      num(b.fieldingCatches)-num(a.fieldingCatches) ||
      num(b.fieldingRunOuts)-num(a.fieldingRunOuts)
    );
  }

  if(type === "Best Wicketkeeper"){
    return eligible.sort((a,b) =>
      num(b.fieldingStumpings)-num(a.fieldingStumpings) ||
      num(b.fieldingCatches)-num(a.fieldingCatches) ||
      num(b.fieldingDismissals)-num(a.fieldingDismissals)
    );
  }

  if(type === "Player of the Tournament"){
    return eligible.sort((a,b) => {
      const ra=playerRecord(a), rb=playerRecord(b);
      const scoreA=ra.runs + ra.wickets*20 + ra.fieldingDismissals*10 + ra.sixes*2;
      const scoreB=rb.runs + rb.wickets*20 + rb.fieldingDismissals*10 + rb.sixes*2;
      return scoreB-scoreA || rb.runs-ra.runs || rb.wickets-ra.wickets;
    });
  }

  return [];
}

function calculateAward(){
  const type = $("awardType").value;
  const season = Number($("awardSeason").value || 2026);

  if(type === "Custom Award" || type === "Best Emerging Player" || type === "Man of the Match"){
    calculatedPlayer = null;
    $("awardResult").classList.remove("hidden");
    $("calculatedAwardName").textContent = type;
    $("calculatedPlayer").innerHTML =
      `<b>${esc(type)}</b><br><span class="muted">এই award-এর জন্য player manually নির্বাচন করুন।</span>`;
    $("calculatedRecord").innerHTML = "";
    $("awardPlayer").value = "";
    $("calcMsg").textContent =
      type === "Best Emerging Player"
        ? "Age/eligibility data নেই, তাই manually select করুন।"
        : "এই category automatically calculate করা যাচ্ছে না।";
    return;
  }

  const ranked = sortForAward(type);
  const p = ranked[0];

  if(!p){
    calculatedPlayer = null;
    $("awardResult").classList.remove("hidden");
    $("calculatedAwardName").textContent = type;
    $("calculatedPlayer").textContent = "পর্যাপ্ত player record পাওয়া যায়নি।";
    $("calculatedRecord").innerHTML = "";
    $("calcMsg").textContent = "Calculation-এর জন্য record প্রয়োজন।";
    return;
  }

  calculatedPlayer = p;
  $("awardPlayer").value = p.id;
  $("awardResult").classList.remove("hidden");
  $("calculatedAwardName").textContent = `${type} — ${season}`;
  $("calculatedPlayer").innerHTML =
    `<b>${esc(p.name)}</b> ${p.teamName ? `• ${esc(p.teamName)}` : ""}`;
  $("calculatedRecord").innerHTML = recordHtml(p);

  const r = playerRecord(p);
  let basis = "";
  if(type === "Best Batter") basis = `Highest runs (${r.runs})`;
  if(type === "Best Bowler") basis = `Highest wickets (${r.wickets})`;
  if(type === "Best Fielder") basis = `Highest fielding dismissals (${r.fieldingDismissals})`;
  if(type === "Best Wicketkeeper") basis = `Most stumpings (${r.stumpings}), then catches (${r.catches})`;
  if(type === "Player of the Tournament")
    basis = `Performance score: ${r.runs} runs + ${r.wickets}×20 wickets + ${r.fieldingDismissals}×10 fielding dismissals + ${r.sixes}×2 sixes`;

  $("calcMsg").textContent = `Calculated: ${p.name} • ${basis}`;
  $("awardMsg").textContent = "Player automatically selected। Record দেখে Save Award করুন।";
}

async function load(){
  const [ps,as] = await Promise.all([
    getDocs(collection(db,"players")),
    getDocs(collection(db,"awards"))
  ]);

  players = ps.docs.map(d => ({id:d.id,...d.data()}))
    .sort((a,b)=>(a.name||"").localeCompare(b.name||""));

  awards = as.docs.map(d => ({id:d.id,...d.data()}))
    .sort((a,b)=>Number(b.createdAt?.seconds||0)-Number(a.createdAt?.seconds||0));

  renderPlayerSelect();
  renderPlayerStats();

  $("awardTable").innerHTML = awards.length
    ? `<div class="table-wrap"><table>
        <tr><th>Season</th><th>Award</th><th>Player</th><th>Team</th><th>Prize</th><th>Record at Award</th><th>Note</th></tr>
        ${awards.map(a => {
          const r = a.recordSnapshot || {};
          return `<tr>
            <td>${a.season || ""}</td>
            <td>${esc(a.awardName || "")}</td>
            <td><b>${esc(a.playerName || "")}</b></td>
            <td>${esc(a.teamName || "")}</td>
            <td>${esc(a.prize || "")}</td>
            <td>${r.runs ?? 0} R • ${r.wickets ?? 0} W • ${r.fieldingDismissals ?? 0} F</td>
            <td>${esc(a.note || "")}</td>
          </tr>`;
        }).join("")}
      </table></div>`
    : "<p class='muted'>এখনও কোনো award save হয়নি।</p>";
}

$("calculateAward").onclick = calculateAward;
$("awardType").onchange = () => {
  $("awardResult").classList.add("hidden");
  $("calcMsg").textContent = "";
  calculatedPlayer = null;
};

$("awardPlayer").onchange = () => {
  const p = players.find(x => x.id === $("awardPlayer").value);
  if(!p) return;
  calculatedPlayer = p;
  $("awardResult").classList.remove("hidden");
  $("calculatedAwardName").textContent = $("awardType").value;
  $("calculatedPlayer").innerHTML =
    `<b>${esc(p.name)}</b> ${p.teamName ? `• ${esc(p.teamName)}` : ""}`;
  $("calculatedRecord").innerHTML = recordHtml(p);
};

$("saveAward").onclick = async () => {
  const pid = $("awardPlayer").value;
  const p = players.find(x => x.id === pid);
  if(!p){
    $("awardMsg").textContent = "আগে player নির্বাচন বা Calculate Award করুন।";
    return;
  }

  const type = $("awardType").value;
  const awardName = type === "Custom Award"
    ? $("awardCustomName").value.trim()
    : type;

  if(!awardName){
    $("awardMsg").textContent = "Award-এর নাম দিন।";
    return;
  }

  const season = Number($("awardSeason").value || 2026);
  const r = playerRecord(p);
  const id = `award-${season}-${Date.now()}`;

  await setDoc(doc(db,"awards",id),{
    id,
    season,
    awardName,
    playerId:p.id,
    playerName:p.name,
    teamId:p.teamId || "",
    teamName:p.teamName || "",
    prize:$("awardPrize").value.trim(),
    note:$("awardNote").value.trim(),
    recordSnapshot:r,
    calculatedBy:"VCAJ Awards Calculator",
    createdAt:serverTimestamp()
  });

  $("awardMsg").textContent = `Award Save হয়েছে: ${p.name} — ${awardName}`;
  $("awardPrize").value = "";
  $("awardNote").value = "";
  $("awardCustomName").value = "";
  await load();
};

await load();
