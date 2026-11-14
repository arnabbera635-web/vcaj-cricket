/* Prize list block for the public Awards pages. Fills <section id="prizeList">. Static data → no Firebase reads. */
import {CATS,MAIN,SPECIAL} from "./prizes-data.js";
const root=document.getElementById("prizeList");
if(root){
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const bn=s=>String(s).replace(/\d/g,d=>"০১২৩৪৫৬৭৮৯"[d]);
const money=n=>"₹"+bn(Number(n).toLocaleString("en-IN"));
let cat="all",q="";
const css=document.createElement("style");
css.textContent=`#prizeList h2{margin:0 0 4px}#prizeList .pl-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start}#prizeList .pl-b{border:2px solid var(--line);background:transparent;color:inherit;border-radius:12px;padding:8px 12px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block;font-size:14px}#prizeList .pl-b:hover{border-color:var(--orange)}
#prizeList .pl-main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:14px 0}#prizeList .pl-m{position:relative;border-radius:18px;padding:18px;color:#07152d;overflow:hidden}#prizeList .pl-m.r1{background:linear-gradient(135deg,#fde68a,#fbbf24 55%,#f59e0b)}#prizeList .pl-m.r2{background:linear-gradient(135deg,#f1f5f9,#cbd5e1 55%,#94a3b8)}#prizeList .pl-m .em{position:absolute;right:12px;top:6px;font-size:54px;opacity:.28}#prizeList .pl-m h3{margin:0;font-size:15px;letter-spacing:.3px}#prizeList .pl-m .am{font-size:34px;font-weight:900;margin:2px 0}#prizeList .pl-m small{display:block;opacity:.85}#prizeList .pl-m p{margin:6px 0 0;font-size:13px;line-height:1.5}
#prizeList .pl-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0 10px}#prizeList .pl-bar input{flex:1;min-width:180px;padding:10px 12px;border:2px solid var(--line);border-radius:12px;background:transparent;color:inherit}#prizeList .pl-chip{border:2px solid var(--line);background:transparent;color:inherit;border-radius:99px;padding:6px 12px;font-size:13px;cursor:pointer}#prizeList .pl-chip.on{border-color:var(--orange);background:rgba(255,138,31,.15);font-weight:800}
#prizeList .pl-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}#prizeList .pl-c{position:relative;border:1px solid var(--line);border-top:4px solid var(--orange);border-radius:14px;padding:14px;background:var(--card,transparent);break-inside:avoid}#prizeList .pl-c .no{position:absolute;right:10px;top:8px;font-size:11px;font-weight:800;opacity:.6}#prizeList .pl-c .ic{font-size:30px}#prizeList .pl-c h4{margin:6px 0 4px;font-size:15px;line-height:1.4}#prizeList .pl-c .mm{font-size:12.5px;color:var(--orange);font-weight:700;margin:2px 0}#prizeList .pl-c .by{font-size:13px;margin-top:8px;padding:6px 9px;border-radius:9px;background:rgba(255,138,31,.1)}#prizeList .pl-e{padding:18px;text-align:center;opacity:.7}
@media print{body.pr-prize *{visibility:hidden}body.pr-prize #prizeList,body.pr-prize #prizeList *{visibility:visible}body.pr-prize #prizeList{position:absolute;left:0;top:0;width:100%}body.pr-prize .pl-bar,body.pr-prize .pl-top .pl-act{display:none!important}#prizeList .pl-m{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
document.head.appendChild(css);
const shareText=()=>`🏆 VCAJ ২০২৬ — পুরস্কার তালিকা\n🥇 প্রথম: ${money(MAIN[0].amount)}\n🥈 দ্বিতীয়: ${money(MAIN[1].amount)}\n🎁 আরও ${bn(SPECIAL.length)}টি বিশেষ পুরস্কার\n\n${location.origin}${location.pathname}#prizeList`;
function list(){
 const k=q.trim().toLowerCase();
 return SPECIAL.filter(p=>(cat==="all"||p.cat===cat)&&(!k||[p.title,p.memorial,p.by,p.no].join(" ").toLowerCase().includes(k)))}
function draw(){
 const L=list(),total=MAIN.reduce((a,m)=>a+m.amount,0);
 root.innerHTML=`<div class="pl-top"><div><h2>🏆 পুরস্কার তালিকা</h2><div class="muted" style="font-size:13px">প্রধান দুই পুরস্কার মিলিয়ে ${money(total)} • সঙ্গে ${bn(SPECIAL.length)}টি বিশেষ পুরস্কার</div></div><div class="pl-act" style="display:flex;gap:8px;flex-wrap:wrap"><button class="pl-b" data-a="print">🖨️ Print / PDF</button><button class="pl-b" data-a="share">📤 শেয়ার</button><a class="pl-b" href="sponsors.html">🤝 Sponsors</a></div></div>
 <div class="pl-main">${MAIN.map(m=>`<div class="pl-m r${m.rank}"><div class="em">${m.rank===1?"🥇":"🥈"}</div><h3>${esc(m.label)}</h3><div class="am">${money(m.amount)}/-</div><small>(${esc(m.words)})</small><p>🕯️ ${esc(m.memorial)}<br>🤝 সৌজন্যে: <b>${esc(m.by)}</b><br>🏆 সঙ্গে সুদৃশ্য ট্রফি — ${esc(m.trophy)}, দাতা ${esc(m.trophyBy)}</p></div>`).join("")}</div>
 <div class="pl-bar"><input id="plq" type="search" placeholder="🔍 পুরস্কার, স্মৃতি বা দাতার নাম খুঁজুন" value="${esc(q)}">${Object.entries(CATS).map(([k,[n,e]])=>`<button class="pl-chip ${cat===k?"on":""}" data-c="${k}">${e} ${esc(n)}</button>`).join("")}</div>
 <div class="muted" style="font-size:12.5px;margin-bottom:8px">${bn(L.length)}টি পুরস্কার দেখানো হচ্ছে</div>
 <div class="pl-g">${L.length?L.map(p=>`<div class="pl-c"><span class="no">পুরস্কার নং ${bn(p.no)}</span><div class="ic">${p.icon}</div><h4>${esc(p.title)}</h4>${p.memorial?`<div class="mm">🕯️ ${esc(p.memorial)}</div>`:""}<div class="by">সৌজন্যে: ${esc(p.by)}</div></div>`).join(""):'<div class="pl-e" style="grid-column:1/-1">কিছু পাওয়া যায়নি</div>'}</div>`;
 const inp=root.querySelector("#plq");inp.oninput=e=>{q=e.target.value;const pos=e.target.selectionStart;draw();const n=root.querySelector("#plq");n.focus();n.setSelectionRange(pos,pos)}}
root.addEventListener("click",e=>{
 const c=e.target.closest("[data-c]");if(c){cat=c.dataset.c;draw();return}
 const a=e.target.closest("[data-a]");if(!a)return;
 if(a.dataset.a==="print"){document.body.classList.add("pr-prize");print();setTimeout(()=>document.body.classList.remove("pr-prize"),600)}
 else if(a.dataset.a==="share"){if(navigator.share)navigator.share({title:"VCAJ পুরস্কার তালিকা",text:shareText()}).catch(()=>{});else window.open("https://wa.me/?text="+encodeURIComponent(shareText()),"_blank")}});
draw()}
