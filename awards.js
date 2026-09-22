import {db,collection,doc,getDocs,setDoc,serverTimestamp} from "./firebase.js";
const $=id=>document.getElementById(id);let players=[],awards=[];
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
async function load(){
 const [ps,as]=await Promise.all([getDocs(collection(db,"players")),getDocs(collection(db,"awards"))]);
 players=ps.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
 awards=as.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.createdAt?.seconds||"").localeCompare(String(a.createdAt?.seconds||"")));
 $("awardPlayer").innerHTML=`<option value="">Player নির্বাচন করুন</option>`+
  players.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
 const ranked=[...players].sort((a,b)=>(b.totalRuns||0)-(a.totalRuns||0));
 $("statsTable").innerHTML=ranked.length?`<div class="table-wrap"><table><tr><th>Player</th><th>Team</th><th>Runs</th><th>Balls</th><th>4s</th><th>6s</th><th>Bowling Runs</th><th>Wickets</th><th>Fielding Dismissals</th><th>Hat-tricks</th></tr>${
 ranked.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.teamName||"")}</td><td>${p.totalRuns||0}</td><td>${p.totalBalls||0}</td><td>${p.totalFours||0}</td><td>${p.totalSixes||0}</td><td>${p.totalBowlingRuns||0}</td><td>${p.totalWickets||0}</td><td>${p.fieldingDismissals||0}</td><td>${(p.bowlingHatTricks||0)+(p.battingHatTricks||0)+(p.fieldingHatTricks||0)}</td></tr>`).join("")
 }</table></div>`:"<p class='muted'>কোনো player data নেই।</p>";
 $("awardTable").innerHTML=awards.length?`<div class="table-wrap"><table><tr><th>Season</th><th>Award</th><th>Player</th><th>Prize</th><th>Note</th></tr>${
 awards.map(a=>`<tr><td>${a.season||""}</td><td>${esc(a.awardName||"")}</td><td>${esc(a.playerName||"")}</td><td>${esc(a.prize||"")}</td><td>${esc(a.note||"")}</td></tr>`).join("")
 }</table></div>`:"<p class='muted'>এখনও কোনো award save হয়নি।</p>";
}
$("saveAward").onclick=async()=>{
 const pid=$("awardPlayer").value,p=players.find(x=>x.id===pid);
 if(!pid||!p){$("awardMsg").textContent="Player নির্বাচন করুন।";return;}
 const type=$("awardType").value;
 const awardName=type==="Custom Award"?$("awardCustomName").value.trim():type;
 if(!awardName){$("awardMsg").textContent="Award-এর নাম দিন।";return;}
 const id=`award-${Number($("awardSeason").value||2026)}-${Date.now()}`;
 await setDoc(doc(db,"awards",id),{
  id,season:Number($("awardSeason").value||2026),awardName,
  playerId:p.id,playerName:p.name,teamId:p.teamId||"",teamName:p.teamName||"",
  prize:$("awardPrize").value.trim(),note:$("awardNote").value.trim(),
  createdAt:serverTimestamp()
 });
 $("awardMsg").textContent="Award Save হয়েছে।";$("awardPrize").value=$("awardNote").value=$("awardCustomName").value="";
 await load();
};
await load();
