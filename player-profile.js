import {db,collection,getDocs} from "./firebase.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const n=v=>Number(v)||0;let P=[];
function fill(){const q=$("q").value.trim().toLowerCase(),cur=$("sel").value;
 $("sel").innerHTML='<option value="">— খেলোয়াড় বাছুন —</option>'+P.filter(p=>!q||(p.name+" "+(p.teamName||"")).toLowerCase().includes(q)).map(p=>`<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.teamName||"")})</option>`).join("");$("sel").value=cur}
function show(){const p=P.find(x=>x.id===$("sel").value);$("box").classList.toggle("hide",!p);if(!p)return;
 history.replaceState(null,"","?id="+encodeURIComponent(p.id));
 $("av").textContent=(p.name||"?").trim()[0]||"?";$("nm").textContent=p.name;$("tm").textContent=p.teamName||"";
 const sr=n(p.totalBalls)?(n(p.totalRuns)*100/n(p.totalBalls)).toFixed(1):"—",avg=n(p.totalMatches)?(n(p.totalRuns)/n(p.totalMatches)).toFixed(1):"—";
 $("tiles").innerHTML=[[n(p.totalMatches),"ম্যাচ"],[n(p.totalRuns),"রান"],[n(p.totalWickets),"উইকেট"],[n(p.totalFours),"চার"],[n(p.totalSixes),"ছক্কা"],[sr,"Strike Rate"],[avg,"রান/ম্যাচ"]].map(x=>`<div class="tile"><b>${x[0]}</b><span>${x[1]}</span></div>`).join("");
 const f=[["ক্যাচ",p.fieldingCatches],["রান আউট",p.fieldingRunOuts],["স্টাম্পিং",p.fieldingStumpings],["মোট ফিল্ডিং আউট",p.fieldingDismissals]].filter(x=>n(x[1])>0);
 $("bars").innerHTML=f.length?"<h3>🧤 ফিল্ডিং</h3>"+f.map(x=>`<div class="row"><span>${x[0]}</span><b>${n(x[1])}</b></div>`).join(""):""}
$("sel").onchange=show;$("q").oninput=fill;
$("shareBtn").onclick=()=>{const u={title:document.title,url:location.href};if(navigator.share)navigator.share(u).catch(()=>{});else navigator.clipboard?.writeText(u.url).then(()=>window.vcToast?.("🔗 লিংক কপি হয়েছে"))};
$("printBtn").onclick=()=>print();
getDocs(collection(db,"players")).then(s=>{P=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));fill();const id=new URLSearchParams(location.search).get("id");if(id){$("sel").value=id;show()}}).catch(()=>{$("sel").innerHTML="<option>লোড হয়নি</option>"});
