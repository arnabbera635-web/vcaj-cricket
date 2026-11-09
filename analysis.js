import {db,collection,getDocs,onSnapshot} from "./firebase.js";
import {snapOnce} from "./vcaj-cache.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let M=[],ev=[],inn=1,cur="";
function runsOf(e){const t=e.type;if(t==="wide"||t==="noBall")return 1+(Number(e.batterRuns)||0);if(t==="bye"||t==="legBye"){const m=String(e.text||"").match(/(\d+)\s*$/);return m?Number(m[1]):0}return Number(e.batterRuns)||0}
const ts=e=>String(e.createdAt||"");
function innings(n){return ev.filter(e=>!e.superOver&&Number(e.inningsNo)===n).sort((a,b)=>ts(a).localeCompare(ts(b)))}
function analyse(list){const ov={},cum=[];let tot=0,w=0,legal=0,dist={dot:0,one:0,two:0,three:0,four:0,six:0,extra:0,wkt:0},bnd=0;
 list.forEach(e=>{const r=runsOf(e),o=Math.floor(parseFloat(e.over||"0")),isW=e.type==="wicket";
  ov[o]=ov[o]||{r:0,w:0};ov[o].r+=r;if(isW){ov[o].w++;w++;dist.wkt++}tot+=r;
  if(e.legal!==false)legal++;
  if(["wide","noBall","bye","legBye"].includes(e.type))dist.extra++;else if(!isW){const b=Number(e.batterRuns)||0;if(b===0)dist.dot++;else if(b===1)dist.one++;else if(b===2)dist.two++;else if(b===3)dist.three++;else if(b===4){dist.four++;bnd+=4}else if(b>=6){dist.six++;bnd+=6}}
  cum.push({b:legal,r:tot,w:isW})});
 return{ov,cum,tot,w,legal,dist,bnd}}
function manhattan(a){const keys=Object.keys(a.ov).map(Number),n=Math.max(...keys,0)+1,W=Math.max(320,n*34+50),H=220,mx=Math.max(6,...Object.values(a.ov).map(x=>x.r));
 let s=`<svg class="chart" viewBox="0 0 ${W} ${H}">`;for(let i=0;i<=4;i++){const y=20+(H-50)*i/4;s+=`<line class="gl" x1="30" x2="${W-6}" y1="${y}" y2="${y}"/><text x="2" y="${y+4}">${Math.round(mx*(1-i/4))}</text>`}
 for(let o=0;o<n;o++){const d=a.ov[o]||{r:0,w:0},h=(H-50)*d.r/mx,x=36+o*34,y=H-30-h;s+=`<rect x="${x}" y="${y}" width="24" height="${h}" rx="4" fill="#ff8a1f"/><text x="${x+12}" y="${H-14}" text-anchor="middle">${o+1}</text>`;if(d.r)s+=`<text x="${x+12}" y="${y-4}" text-anchor="middle" style="font-weight:700">${d.r}</text>`;for(let k=0;k<d.w;k++)s+=`<circle cx="${x+12}" cy="${y-18-k*12}" r="5" fill="#d64545"/>`}
 return s+"</svg>"}
function worm(){const A=analyse(innings(1)),B=analyse(innings(2)),L=Math.max(A.legal,B.legal,6),R=Math.max(A.tot,B.tot,10),W=420,H=230,px=b=>36+(W-50)*b/L,py=r=>H-30-(H-50)*r/R;
 const path=(a)=>"M"+px(0)+","+py(0)+a.cum.map(p=>`L${px(p.b)},${py(p.r)}`).join("");let s=`<svg class="chart" viewBox="0 0 ${W} ${H}">`;
 for(let i=0;i<=4;i++){const y=20+(H-50)*i/4;s+=`<line class="gl" x1="30" x2="${W-6}" y1="${y}" y2="${y}"/><text x="2" y="${y+4}">${Math.round(R*(1-i/4))}</text>`}
 s+=`<text x="${W/2}" y="${H-6}" text-anchor="middle">বল (legal)</text><path d="${path(A)}" fill="none" stroke="#ff8a1f" stroke-width="3"/>`;
 if(B.cum.length)s+=`<path d="${path(B)}" fill="none" stroke="#2563eb" stroke-width="3"/>`;
 [[A,"#ff8a1f"],[B,"#2563eb"]].forEach(([a,c])=>a.cum.filter(p=>p.w).forEach(p=>s+=`<circle cx="${px(p.b)}" cy="${py(p.r)}" r="5" fill="#d64545" stroke="#fff"/>`));return s+"</svg>"}
function dist(a){const d=a.dist,T=Math.max(1,Object.values(d).reduce((x,y)=>x+y,0)),it=[["ডট বল",d.dot,"#94a3b8"],["১ রান",d.one,"#38bdf8"],["২ রান",d.two,"#22c55e"],["৩ রান",d.three,"#a3e635"],["চার",d.four,"#ff8a1f"],["ছক্কা",d.six,"#a855f7"],["এক্সট্রা",d.extra,"#facc15"],["উইকেট",d.wkt,"#d64545"]];
 return it.map(([n,v,c])=>`<div class="row"><span><i style="display:inline-block;width:10px;height:10px;background:${c};border-radius:3px;margin-right:6px"></i>${n}</span><b>${v}</b></div><div style="height:6px;border-radius:6px;background:${c};width:${v*100/T}%;min-width:${v?3:0}px;margin-bottom:4px"></div>`).join("")}
function draw(){const m=M.find(x=>x.id===cur);if(!m){$("out").textContent="একটা ম্যাচ বেছে নিন";$("tabs").innerHTML="";return}
 if(!ev.length){$("out").innerHTML="<p>এই ম্যাচের বল-বাই-বল ডেটা এখনও নেই।</p>";$("tabs").innerHTML="";return}
 const a=analyse(innings(inn)),n1=m.team1Name||"Team 1",n2=m.team2Name||"Team 2",bat=inn===1?(m.firstBattingTeam||n1):(m.secondBattingTeam||n2);
 $("tabs").innerHTML=[1,2].map(i=>`<button data-i="${i}" class="${i===inn?"on":""}">${i}st Innings</button>`).join("");
 $("tabs").querySelectorAll("button").forEach(b=>b.onclick=()=>{inn=Number(b.dataset.i);draw()});
 const crr=a.legal?(a.tot*6/a.legal).toFixed(2):"0.00";
 $("out").innerHTML=`<p><b>${esc(n1)} vs ${esc(n2)}</b>${m.resultText?` • ${esc(m.resultText)}`:""}</p>
 <div class="tiles"><div class="tile"><b>${a.tot}/${a.w}</b><span>স্কোর</span></div><div class="tile"><b>${Math.floor(a.legal/6)}.${a.legal%6}</b><span>ওভার</span></div><div class="tile"><b>${crr}</b><span>Run Rate</span></div><div class="tile"><b>${a.dist.four}/${a.dist.six}</b><span>চার / ছক্কা</span></div><div class="tile"><b>${a.legal?Math.round(a.dist.dot*100/Math.max(1,a.legal)):0}%</b><span>ডট বল</span></div></div>
 ${a.cum.length?`<h3>📊 ওভার-বাই-ওভার রান <small class="muted">(🔴 = উইকেট)</small></h3>${manhattan(a)}<h3 style="margin-top:18px">📈 Worm গ্রাফ</h3>${worm()}<div class="lg"><i style="background:#ff8a1f"></i>১ম ইনিংস<i style="background:#2563eb"></i>২য় ইনিংস<i style="background:#d64545;border-radius:50%"></i>উইকেট</div><h3 style="margin-top:18px">🎯 বলের ধরন</h3>${dist(a)}`:"<p class='muted'>এই ইনিংসের ডেটা নেই।</p>"}`}
let unsub=null;
function pick(id){cur=id;inn=1;ev=[];if(unsub){unsub();unsub=null}if(!id){draw();return}
 unsub=onSnapshot(collection(db,"matches",id,"events"),s=>{ev=s.docs.map(d=>d.data());draw()},()=>{$("out").textContent="ডেটা লোড হয়নি"})}
$("ms").onchange=()=>pick($("ms").value);
snapOnce(db,getDocs,collection,"matches",s=>{M=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.updatedAt?.seconds||"").localeCompare(String(a.updatedAt?.seconds||"")));
 const v=$("ms").value;$("ms").innerHTML='<option value="">— ম্যাচ বাছুন —</option>'+M.map(m=>`<option value="${esc(m.id)}">${esc((m.stageName||"Match")+": "+(m.team1Name||"")+" vs "+(m.team2Name||""))}${m.status==="LIVE"?" 🔴":""}</option>`).join("");$("ms").value=v;
 const q=new URLSearchParams(location.search).get("match");if(q&&!cur&&M.find(m=>m.id===q)){$("ms").value=q;pick(q)}},()=>{});
