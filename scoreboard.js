import {db,collection,onSnapshot} from "./firebase.js";

const box=document.getElementById("scoreboardContent");
const section=document.getElementById("liveScoreboard");
const fullBtn=document.getElementById("scoreFullscreen");
const esc=s=>String(s??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const num=v=>Number(v||0);
const overs=b=>`${Math.floor(num(b)/6)}.${num(b)%6}`;
const stamp=v=>v?.toMillis?.()??(v?.seconds? v.seconds*1000:0);
function render(m){
  if(!box)return;
  const batting=m.battingTeam||m.battingTeamName||"ব্যাটিং দল";
  const bowling=m.bowlingTeam||m.bowlingTeamName||"বোলিং দল";
  const players=Array.isArray(m.players)?m.players:[];
  const bowlers=Array.isArray(m.bowlers)?m.bowlers:[];
  const striker=players.find(p=>p.id===m.striker)||null;
  const non=players.find(p=>p.id===m.nonStriker)||null;
  const currentBowler=bowlers.find(p=>p.id===m.bowler)||null;
  const isDone=["COMPLETED","ABANDONED"].includes(String(m.status||"").toUpperCase());
  const isBreak=["INNINGS_BREAK","SUPER_OVER_READY"].includes(String(m.status||"").toUpperCase());
  const extras=m.extras||{};
  const target=num(m.target);
  const runRate=num(m.legalBalls)?(num(m.score)/(num(m.legalBalls)/6)).toFixed(2):"0.00";
  const batRows=[striker,non].filter(Boolean).map(p=>`<div class="score-row"><strong>${esc(p.name)}${p.id===m.striker?" *":""}</strong><span>${num(p.runs)} (${num(p.balls)})</span></div>`).join("")||'<div class="score-row">ব্যাটসম্যানের তথ্য অপেক্ষায়</div>';
  const bowlRows=currentBowler?`<div class="score-row"><strong>${esc(currentBowler.name)}</strong><span>${overs(currentBowler.balls)} ov • ${num(currentBowler.runs)} R • ${num(currentBowler.wickets)} W</span></div>`:'<div class="score-row">বোলারের তথ্য অপেক্ষায়</div>';
  const result=isDone?(m.resultText||`${esc(m.winnerTeamName||"ম্যাচ শেষ")}`):isBreak?(m.status==="SUPER_OVER_READY"?"ম্যাচ টাই — Super Over প্রয়োজন":"ইনিংস বিরতি"):target?`লক্ষ্য ${target} • প্রয়োজন ${Math.max(0,target-num(m.score))} রান`:"লাইভ ম্যাচ চলছে";
  box.innerHTML=`
    <div class="score-match-title">${esc(m.title||`${bat} বনাম ${bowling}`)} • ${esc(m.stageName||"VCAJ Tournament")}</div>
    <div class="score-main">
      <div class="score-team">${esc(batting)}</div>
      <div class="score-big">${num(m.score)}<span style="font-size:.48em;color:#fff">/${num(m.wickets)}</span></div>
      <div class="score-overs">${overs(m.legalBalls)} overs <span style="opacity:.65">/ ${num(m.maxOvers||15)}</span></div>
      <div class="score-meta">Run Rate: ${runRate} ${target?` • Target: ${target}`:""} ${m.superOver?" • SUPER OVER":""}</div>
    </div>
    <div class="score-columns">
      <div class="score-panel"><h3>ব্যাটিং</h3>${batRows}<div class="score-row"><span>Extras</span><strong>${Object.values(extras).reduce((a,b)=>a+num(b),0)}</strong></div></div>
      <div class="score-panel"><h3>বোলিং</h3>${bowlRows}<div class="score-row"><span>বোলিং দল</span><strong>${esc(bowling)}</strong></div></div>
    </div>
    <div class="score-result">${esc(result)}</div>
    <div class="score-meta" style="text-align:center">স্কোরার প্যানেল থেকে আপডেট হলেই এই বোর্ড স্বয়ংক্রিয়ভাবে বদলাবে</div>`;
}
function selectMatch(docs){
  const matches=docs.map(d=>({id:d.id,...d.data()}));
  const active=matches.filter(m=>["LIVE","INNINGS_BREAK","SUPER_OVER_READY"].includes(String(m.status||"").toUpperCase()));
  const pool=active.length?active:matches.filter(m=>["COMPLETED"].includes(String(m.status||"").toUpperCase()));
  pool.sort((a,b)=>stamp(b.updatedAt)-stamp(a.updatedAt));
  return pool[0]||null;
}
try{
  onSnapshot(collection(db,"liveMatches"),snap=>{
    const match=selectMatch(snap.docs);
    if(match)render(match);
    else if(box)box.innerHTML='<div class="score-wait">টুর্নামেন্ট শুরু হয়েছে। Admin/Scorer থেকে প্রথম ম্যাচ চালু হলেই লাইভ স্কোর এখানে দেখা যাবে।</div>';
  },err=>{
    console.error("Live scoreboard error:",err);
    if(box)box.innerHTML='<div class="score-wait">লাইভ স্কোর লোড হচ্ছে না। Firebase Rules-এ liveMatches read permission পরীক্ষা করুন।</div>';
  });
}catch(err){
  console.error(err);
  if(box)box.textContent="লাইভ স্কোরবোর্ড চালু করা যায়নি।";
}
fullBtn?.addEventListener("click",async()=>{
  try{
    if(!document.fullscreenElement) await section.requestFullscreen();
    else await document.exitFullscreen();
  }catch(e){alert("এই ব্রাউজারে Full Screen অনুমতি পাওয়া যায়নি।");}
});
