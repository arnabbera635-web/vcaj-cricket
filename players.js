import {db,collection,getDocs,query,orderBy} from "./firebase.js";
const $=id=>document.getElementById(id); let all=[];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function load(){const snap=await getDocs(query(collection(db,"players"),orderBy("totalRuns","desc")));all=snap.docs.map(d=>({id:d.id,...d.data()}));render();}
function render(){const q=($('search').value||'').toLowerCase();const rows=all.filter(p=>(p.name||'').toLowerCase().includes(q));$('players').innerHTML=`<table><tr><th>খেলোয়াড়</th><th>দল</th><th>মোট রান</th><th>বল</th><th>4s</th><th>6s</th><th>বোলিং ওভার</th><th>উইকেট</th></tr>${rows.map(p=>`<tr><td><a href="player.html?id=${encodeURIComponent(p.id)}"><b>${esc(p.name||p.id)}</b></a></td><td>${esc(p.teamName||'—')}</td><td>${p.totalRuns||0}</td><td>${p.totalBalls||0}</td><td>${p.totalFours||0}</td><td>${p.totalSixes||0}</td><td>${Math.floor((p.totalBowlingBalls||0)/6)}.${(p.totalBowlingBalls||0)%6}</td><td>${p.totalWickets||0}</td></tr>`).join('')}</table>`}
$('search').oninput=render;load();
