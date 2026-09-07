import {db,collection,getDocs,query,orderBy} from "./firebase.js";
const $=id=>document.getElementById(id); let all=[];
async function load(){const snap=await getDocs(query(collection(db,"players"),orderBy("totalRuns","desc")));all=snap.docs.map(d=>d.data());render();}
function render(){const q=($("search").value||"").toLowerCase();const rows=all.filter(p=>(p.name||"").toLowerCase().includes(q));$("players").innerHTML=`<table><tr><th>খেলোয়াড়</th><th>মোট রান</th><th>বল</th><th>4s</th><th>6s</th><th>উইকেট</th></tr>${rows.map(p=>`<tr><td><b>${p.name||p.id}</b></td><td>${p.totalRuns||0}</td><td>${p.totalBalls||0}</td><td>${p.totalFours||0}</td><td>${p.totalSixes||0}</td><td>${p.totalWickets||0}</td></tr>`).join("")}</table>`}
$("search").oninput=render;load();