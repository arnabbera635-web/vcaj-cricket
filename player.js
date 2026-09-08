import {db,doc,getDoc,collection,getDocs,query,orderBy} from "./firebase.js";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ballsText=n=>`${Math.floor(Number(n||0)/6)}.${Number(n||0)%6}`;
const bowlerWicketTypes=["bowled","caught","lbw","stumped","hitWicket"];
async function load(){
  const id=new URLSearchParams(location.search).get("id");
  if(!id){$("playerName").textContent="খেলোয়াড় পাওয়া যায়নি";$("playerMeta").textContent="Players page থেকে একজন খেলোয়াড় নির্বাচন করুন।";return;}
  try{
    const snap=await getDoc(doc(db,"players",id));
    if(!snap.exists()){$("playerName").textContent="খেলোয়াড় পাওয়া যায়নি";$("playerMeta").textContent="এই Player ID-এর কোনো রেকর্ড নেই।";return;}
    const p={id:snap.id,...snap.data()};
    $("playerName").textContent=p.name||p.id;
    $("playerMeta").textContent=`${p.teamName||"দল নির্ধারিত নয়"} • VCAJ Cricket Player Record`;
    const runs=Number(p.totalRuns||0), balls=Number(p.totalBalls||0), fours=Number(p.totalFours||0), sixes=Number(p.totalSixes||0), matches=Number(p.totalMatches||0);
    const sr=balls?((runs/balls)*100).toFixed(2):"0.00";
    $("careerStats").innerHTML=`<div class="stat"><b>${matches}</b><span>ম্যাচ</span></div><div class="stat"><b>${runs}</b><span>রান</span></div><div class="stat"><b>${balls}</b><span>বল</span></div><div class="stat"><b>${sr}</b><span>Strike Rate</span></div><div class="stat"><b>${fours}</b><span>4s</span></div><div class="stat"><b>${sixes}</b><span>6s</span></div>`;
    $("profile").innerHTML=`<p><b>নাম:</b> ${esc(p.name||p.id)}</p><p><b>দল:</b> ${esc(p.teamName||"—")}</p><p><b>Player ID:</b> ${esc(p.id)}</p><p class="muted">এই পেজটি Public — লগইন ছাড়াই দেখা যাবে।</p>`;
    await loadMatchRecords(p);
  }catch(e){console.error(e);$("playerMeta").textContent="রেকর্ড লোড করা যায়নি।";$("matchRecords").innerHTML=`<p>ডাটা লোড করার সময় সমস্যা হয়েছে।</p>`;}
}
async function loadMatchRecords(p){
  const matches=await getDocs(query(collection(db,"matches"),orderBy("updatedAt","desc")));
  const battingRows=[], bowlingRows=[], fieldingRows=[], dismissalRows=[];
  let careerBowlingBalls=0, careerBowlingRuns=0, careerBowlingWickets=0, catches=0, stumpings=0, runOuts=0;
  for(const m of matches.docs){
    const match=m.data(); const evSnap=await getDocs(collection(db,"matches",m.id,"events"));
    let runs=0,balls=0,fours=0,sixes=0,bBalls=0,bRuns=0,bWickets=0,fCatches=0,fStumpings=0,fRunOuts=0;
    const dismissals=[];
    evSnap.docs.forEach(d=>{
      const e=d.data();
      if(e.strikerId===p.id){const r=Number(e.batterRuns||0);runs+=r;if(e.legal)balls++;if(r===4)fours++;if(r===6)sixes++;}
      if(e.bowlerId===p.id){if(e.legal)bBalls++;bRuns+=Number(e.bowlerRuns??((e.type==="wide"||e.type==="noBall")?1:Number(e.batterRuns||0)));if(e.type==="wicket"&&e.bowlerWicket)bWickets++;}
      if(e.fielderId===p.id){if(e.dismissalType==="caught")fCatches++;if(e.dismissalType==="stumped")fStumpings++;if(e.dismissalType==="runOut")fRunOuts++;if(e.type==="wicket")dismissals.push(e);}
    });
    if(runs||balls||fours||sixes)battingRows.push({id:m.id,title:match.title||m.id,season:match.season||"—",runs,balls,fours,sixes});
    if(bBalls||bRuns||bWickets){bowlingRows.push({id:m.id,title:match.title||m.id,season:match.season||"—",balls:bBalls,runs:bRuns,wickets:bWickets});careerBowlingBalls+=bBalls;careerBowlingRuns+=bRuns;careerBowlingWickets+=bWickets;}
    if(fCatches||fStumpings||fRunOuts){fieldingRows.push({id:m.id,title:match.title||m.id,season:match.season||"—",catches:fCatches,stumpings:fStumpings,runOuts:fRunOuts,total:fCatches+fStumpings+fRunOuts});catches+=fCatches;stumpings+=fStumpings;runOuts+=fRunOuts;}
    dismissals.forEach(e=>dismissalRows.push({id:m.id,title:match.title||m.id,season:match.season||"—",type:e.dismissalType||"wicket",batter:e.dismissedBatter||"—",fielder:e.fielderName||"—",bowler:e.bowlerName||"—"}));
  }
  const storedBalls=Number(p.totalBowlingBalls||0), storedRuns=Number(p.totalBowlingRuns||0), storedWickets=Number(p.totalWickets||0);
  const bb=storedBalls||careerBowlingBalls, br=storedRuns||careerBowlingRuns, bw=storedWickets||careerBowlingWickets;
  const storedCatches=Number(p.fieldingCatches||0), storedStumpings=Number(p.fieldingStumpings||0), storedRunOuts=Number(p.fieldingRunOuts||0);
  const fc=storedCatches||catches, fs=storedStumpings||stumpings, fr=storedRunOuts||runOuts, fd=fc+fs+fr;
  const econ=bb?(br/(bb/6)).toFixed(2):"0.00";
  $("bowlingSummary").innerHTML=`<div class="stats"><div class="stat"><b>${ballsText(bb)}</b><span>বোলিং ওভার</span></div><div class="stat"><b>${br}</b><span>বোলিং রান</span></div><div class="stat"><b>${bw}</b><span>বোলিং উইকেট</span></div><div class="stat"><b>${econ}</b><span>Economy</span></div></div>`+(bowlingRows.length?`<table><tr><th>ম্যাচ</th><th>Season</th><th>O</th><th>R</th><th>W</th></tr>${bowlingRows.map(r=>`<tr><td>${esc(r.title)}</td><td>${esc(r.season)}</td><td>${ballsText(r.balls)}</td><td>${r.runs}</td><td>${r.wickets}</td></tr>`).join("")}</table>`:`<p class="muted">এই খেলোয়াড়ের বোলিং রেকর্ড এখনও নেই।</p>`);
  $("fieldingSummary").innerHTML=`<div class="stats"><div class="stat"><b>${fc}</b><span>ক্যাচ</span></div><div class="stat"><b>${fs}</b><span>স্টাম্পিং</span></div><div class="stat"><b>${fr}</b><span>রান আউট</span></div><div class="stat"><b>${fd}</b><span>মোট Fielding Dismissals</span></div></div>`+(fieldingRows.length?`<table><tr><th>ম্যাচ</th><th>Season</th><th>Catch</th><th>Stumping</th><th>Run Out</th><th>মোট</th></tr>${fieldingRows.map(r=>`<tr><td>${esc(r.title)}</td><td>${esc(r.season)}</td><td>${r.catches}</td><td>${r.stumpings}</td><td>${r.runOuts}</td><td>${r.total}</td></tr>`).join("")}</table>`:`<p class="muted">ক্যাচ/স্টাম্পিং/রান আউটের রেকর্ড এখনও নেই।`);
  $("dismissalSummary").innerHTML=dismissalRows.length?`<table><tr><th>ম্যাচ</th><th>ব্যাটার</th><th>Dismissal</th><th>ফিল্ডার</th><th>বোলার</th></tr>${dismissalRows.map(r=>`<tr><td>${esc(r.title)}</td><td>${esc(r.batter)}</td><td>${esc(r.type)}</td><td>${esc(r.fielder)}</td><td>${esc(r.bowler)}</td></tr>`).join("")}</table>`:`<p class="muted">এই খেলোয়াড়ের করা/সম্পর্কিত dismissal record এখনও নেই।`;
  $("matchRecords").innerHTML=battingRows.length?`<table><tr><th>ম্যাচ</th><th>Season</th><th>R</th><th>B</th><th>4s</th><th>6s</th></tr>${battingRows.map(r=>`<tr><td>${esc(r.title)}</td><td>${esc(r.season)}</td><td>${r.runs}</td><td>${r.balls}</td><td>${r.fours}</td><td>${r.sixes}</td></tr>`).join("")}</table>`:`<p>এই খেলোয়াড়ের ম্যাচভিত্তিক ব্যাটিং রেকর্ড এখনও নেই।</p>`;
}
load();
