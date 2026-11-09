import {db,collection,getDocs} from "./firebase.js";
import {snapOnce} from "./vcaj-cache.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));let M=[];
function names(){return[...new Set(M.flatMap(m=>[m.team1Name,m.team2Name]).filter(Boolean))].sort()}
function fill(){const a=$("a").value,b=$("b").value,o='<option value="">— দল —</option>'+names().map(n=>`<option>${esc(n)}</option>`).join("");$("a").innerHTML=o;$("b").innerHTML=o;$("a").value=a;$("b").value=b;go()}
function go(){const A=$("a").value,B=$("b").value;if(!A||!B||A===B){$("o").textContent="দুটো আলাদা দল বেছে নিন";return}
 const g=M.filter(m=>m.status==="COMPLETED"&&[m.team1Name,m.team2Name].includes(A)&&[m.team1Name,m.team2Name].includes(B));
 const wa=g.filter(m=>m.winnerTeamName===A).length,wb=g.filter(m=>m.winnerTeamName===B).length,t=g.length-wa-wb;
 if(!g.length){$("o").innerHTML="<p>এই দুই দল এখনও মুখোমুখি হয়নি।</p>";return}
 $("o").innerHTML=`<div class="vs"><div><h3>${esc(A)}</h3><b>${wa}</b></div><div>জয়<br><small>${g.length} ম্যাচ${t?` • ${t} টাই/অমীমাংসিত`:""}</small></div><div><h3>${esc(B)}</h3><b>${wb}</b></div></div>
 <div class="bar"><i style="width:${wa*100/g.length}%;background:#ff8a1f"></i><i style="width:${wb*100/g.length}%;background:#0d2344"></i></div>
 <h3 style="margin-top:16px">ম্যাচের ফলাফল</h3>${g.map(m=>`<div class="row"><span>${esc(m.stageName||"Match")}</span><b>${esc(m.resultText||(m.winnerTeamName?m.winnerTeamName+" won":"—"))}</b></div>`).join("")}`}
$("a").onchange=go;$("b").onchange=go;
snapOnce(db,getDocs,collection,"matches",s=>{M=s.docs.map(d=>({id:d.id,...d.data()}));fill()},()=>{$("o").textContent="ডেটা লোড হয়নি"});
