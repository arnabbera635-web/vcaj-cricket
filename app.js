import {db,collection,query,orderBy,limit,onSnapshot} from "./firebase.js";
const $=id=>document.getElementById(id);
onSnapshot(query(collection(db,"matches"),orderBy("updatedAt","desc"),limit(20)),snap=>{
 const docs=snap.docs.map(d=>({id:d.id,...d.data()}));
 const live=docs.filter(x=>x.status==="LIVE");
 $("liveStatus").textContent=live.length?`${live.length} LIVE`:"কোনও live ম্যাচ নেই";
 $("liveMatches").innerHTML=live.map(m=>`<a class="live-card" href="index.html?match=${m.id}"><div><b>${m.battingTeam}</b> ${m.score}/${m.wickets}</div><span>${m.overs||`${Math.floor((m.legalBalls||0)/6)}.${(m.legalBalls||0)%6}`} overs</span></a>`).join("")||"<p>এখন কোনও ম্যাচ live নেই।</p>";
 $("recentMatches").innerHTML=docs.map(m=>`<div class="row"><span>${m.title||m.id}</span><b>${m.score||0}/${m.wickets||0}</b><span>${m.status||""}</span></div>`).join("");
 const allRuns=docs.reduce((a,m)=>a+(m.score||0),0); $("quickStats").innerHTML=`<div><b>${docs.length}</b><span>মোট ম্যাচ</span></div><div><b>${allRuns}</b><span>মোট রান (loaded)</span></div><div><b>${live.length}</b><span>Live</span></div>`;
});
