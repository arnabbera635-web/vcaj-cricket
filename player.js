import {db,doc,getDoc,collection,getDocs,query,orderBy} from "./firebase.js";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ballsText=n=>`${Math.floor(Number(n||0)/6)}.${Number(n||0)%6}`;
async function load(){
  const id=new URLSearchParams(location.search).get("id");
  if(!id){$("playerName").textContent="খেলোয়াড় পাওয়া যায়নি";$("playerMeta").textContent="Players page থেকে একজন খেলোয়াড় নির্বাচন করুন।";return;}
  try{
    const snap=await getDoc(doc(db,"players",id));
    if(!snap.exists()){$("playerName").textContent="খেলোয়াড় পাওয়া যায়নি";$("playerMeta").textContent="এই Player ID-এর কোনো রেকর্ড নেই।";return;}
    const p={id:snap.id,...snap.data()};
    $("playerName").textContent=p.name||p.id;
    $("playerMeta").textContent=`${p.teamName||"দল নির্ধারিত নয়"} • VCAJ Cricket Player Record`;
    const runs=Number(p.totalRuns||0), balls=Number(p.totalBalls||0), fours=Number(p.totalFours||0), sixes=Number(p.totalSixes||0), wickets=Number(p.totalWickets||0), matches=Number(p.totalMatches||0);
    const sr=balls?((runs/balls)*100).toFixed(2):"0.00";
    $("careerStats").innerHTML=`<div class="stat"><b>${matches}</b><span>ম্যাচ</span></div><div class="stat"><b>${runs}</b><span>রান</span></div><div class="stat"><b>${balls}</b><span>বল</span></div><div class="stat"><b>${sr}</b><span>Strike Rate</span></div><div class="stat"><b>${fours}</b><span>4s</span></div><div class="stat"><b>${sixes}</b><span>6s</span></div><div class="stat"><b>${wickets}</b><span>উইকেট</span></div>`;
    $("profile").innerHTML=`<p><b>নাম:</b> ${esc(p.name||p.id)}</p><p><b>দল:</b> ${esc(p.teamName||"—")}</p><p><b>Player ID:</b> ${esc(p.id)}</p><p class="muted">এই পেজটি Public — লগইন ছাড়াই দেখা যাবে।</p>`;
    await loadMatchRecords(p);
  }catch(e){console.error(e);$("playerMeta").textContent="রেকর্ড লোড করা যায়নি।";$("matchRecords").innerHTML=`<p>ডাটা লোড করার সময় সমস্যা হয়েছে।</p>`;}
}
async function loadMatchRecords(p){
  const matches=await getDocs(query(collection(db,"matches"),orderBy("updatedAt","desc")));
  const battingRows=[], bowlingRows=[];
  let careerBowlingBalls=0, careerBowlingRuns=0, careerBowlingWickets=0;
  for(const m of matches.docs){
    const match=m.data();
    const evSnap=await getDocs(collection(db,"matches",m.id,"events"));
    let runs=0,balls=0,fours=0,sixes=0;
    let bBalls=0,bRuns=0,bWickets=0;
    evSnap.docs.forEach(d=>{
      const e=d.data();
      if(e.strikerId===p.id){
        const r=Number(e.batterRuns||0); runs+=r;
        if(e.legal)balls++;
        if(r===4)fours++; if(r===6)sixes++;
      }
      if(e.bowlerId===p.id){
        if(e.legal)bBalls++;
        bRuns+=Number(e.bowlerRuns ?? ((e.type==="wide"||e.type==="noBall")?1:Number(e.batterRuns||0)));
        if(e.type==="wicket")bWickets++;
      }
    });
    if(runs||balls||fours||sixes) battingRows.push({id:m.id,title:match.title||m.id,season:match.season||"—",runs,balls,fours,sixes});
    if(bBalls||bRuns||bWickets){
      bowlingRows.push({id:m.id,title:match.title||m.id,season:match.season||"—",balls:bBalls,runs:bRuns,wickets:bWickets});
      careerBowlingBalls+=bBalls; careerBowlingRuns+=bRuns; careerBowlingWickets+=bWickets;
    }
  }
  const storedBalls=Number(p.totalBowlingBalls||0), storedRuns=Number(p.totalBowlingRuns||0), storedWickets=Number(p.totalWickets||0);
  const bb=storedBalls||careerBowlingBalls, br=storedRuns||careerBowlingRuns, bw=storedWickets||careerBowlingWickets;
  const econ=bb?(br/(bb/6)).toFixed(2):"0.00";
  const bowlingSummary=$("bowlingSummary");
  bowlingSummary.innerHTML=`<div class="stats"><div class="stat"><b>${ballsText(bb)}</b><span>বোলিং ওভার</span></div><div class="stat"><b>${br}</b><span>বোলিং রান</span></div><div class="stat"><b>${bw}</b><span>উইকেট</span></div><div class="stat"><b>${econ}</b><span>Economy</span></div></div>` + (bowlingRows.length?`<table><tr><th>ম্যাচ</th><th>Season</th><th>O</th><th>R</th><th>W</th></tr>${bowlingRows.map(r=>`<tr><td>${esc(r.title)}</td><td>${esc(r.season)}</td><td>${ballsText(r.balls)}</td><td>${r.runs}</td><td>${r.wickets}</td></tr>`).join("")}</table>`:`<p class="muted">এই খেলোয়াড়ের বোলিং রেকর্ড এখনও নেই। নতুন ম্যাচে বোলিং করলে ওভার ও উইকেট এখানে জমা হবে।</p>`);
  if(!battingRows.length){$("matchRecords").innerHTML=`<p>এই খেলোয়াড়ের ম্যাচভিত্তিক ব্যাটিং রেকর্ড এখনও নেই।</p>`;return;}
  $("matchRecords").innerHTML=`<table><tr><th>ম্যাচ</th><th>Season</th><th>R</th><th>B</th><th>4s</th><th>6s</th></tr>${battingRows.map(r=>`<tr><td><a href="archive.html">${esc(r.title)}</a></td><td>${esc(r.season)}</td><td>${r.runs}</td><td>${r.balls}</td><td>${r.fours}</td><td>${r.sixes}</td></tr>`).join("")}</table>`;
}
load();
