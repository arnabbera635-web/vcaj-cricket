import {db,collection,getDocs} from "./firebase.js";
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
try{const s=await getDocs(collection(db,"sponsors"));const a=s.docs.map(d=>d.data()).filter(x=>x.active!==false).sort((x,y)=>(x.order??99)-(y.order??99));
 if(a.length){const w=document.createElement("section");w.className="card";w.style.cssText="margin:18px auto;max-width:1180px;text-align:center";
  w.innerHTML=`<h2 style="margin-top:0">🤝 আমাদের Sponsors</h2><div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;align-items:center">${a.map(x=>`<a href="sponsors.html" title="${esc(x.name)}" style="text-align:center;max-width:120px">${x.logo?`<img src="${esc(x.logo)}" alt="${esc(x.name)}" style="max-height:60px;max-width:120px;object-fit:contain">`:`<b>${esc(x.name)}</b>`}</a>`).join("")}</div><p style="margin:10px 0 0"><a href="sponsors.html"><b>সবাইকে দেখুন →</b></a></p>`;
  const m=document.querySelector("main")||document.body;m.appendChild(w)}}catch{}
