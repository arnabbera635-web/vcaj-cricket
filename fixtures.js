/* Fixtures & schedule layer for bracket.html. Reads the bracket's own state (teams, winners, match ids) — nothing is guessed. */
import {auth,db,isAdmin,onAuthStateChanged,doc,getDoc,setDoc,collection,getDocs} from "./firebase.js";
import {getCached,clearCached} from "./vcaj-cache.js";
import * as F from "./fixtures-core.js";
import {fmtDate,fmtTime,buildMessage,DEFAULTS} from "./broadcast-core.js";
import {siteRoot,liveLinks} from "./site-link.js";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const B=()=>window.__vcajBracket?window.__vcajBracket.state():{current:{slots:[],winners:{},matchIds:{}},teams:[],user:null};
const season=()=>String(document.getElementById("season")?.value||2026);
const todayISO=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
let FX={fixtures:{},reserveDate:"",venue:""},LIVE={},WORK={},GEN={startDate:"2026-12-25",startTime:"08:00",gapMin:180,restDays:1},loaded="",panel=null,msg="";
const nameOf=id=>B().teams.find(t=>t.id===id)?.name||"TBD";
const ADMIN=()=>isAdmin(auth.currentUser);
const list=()=>{const {current}=B();return F.items(FX.fixtures,current,nameOf).map(x=>({...x,winner:current.winners?.[x.key]||"",matchId:current.matchIds?.[x.key]||""}))};
const cfg=()=>({...DEFAULTS,...LS("vcajBcCfg",{})});
function fullText(L){return buildMessage({teamName:"",body:F.scheduleBody(L,{reserveDate:FX.reserveDate,venue:FX.venue}),liveLine:liveLinks(siteRoot()),addressTeam:false},cfg())}
function scorerHref(x){return`scorer.html?stage=${x.stage.toUpperCase()}&bracket=${x.key}&t1=${encodeURIComponent(x.a)}&t2=${encodeURIComponent(x.b)}`}
function badges(x){
 const b=F.liveBadge(LIVE[x.matchId]),out=[];
 if(b)out.push(`<span class="fxk ${b.kind}">${esc(b.text)}</span>`);
 else if(x.winner)out.push(`<span class="fxk done">✅ ${esc(nameOf(x.winner))} জিতেছে</span>`);
 if(x.fx.status==="postponed")out.push(`<span class="fxk pp">⏸️ স্থগিত${x.fx.note?" — "+esc(x.fx.note):""}</span>`);
 return out.join("")}
function acts(x){
 const a=[];
 if(x.matchId)a.push(`<a class="fxb" href="live.html?match=${encodeURIComponent(x.matchId)}">🔴 Live Score</a>`);
 if(ADMIN()&&x.known&&!x.winner)a.push(`<a class="fxb go" href="${scorerHref(x)}">▶ ম্যাচ শুরু / স্কোরিং</a>`);
 if(ADMIN()&&x.known)a.push(`<button class="fxb" data-act="send" data-k="${x.key}">📣 দুই দলকে জানান</button>`);
 if(ADMIN())a.push(`<button class="fxb" data-act="edit" data-k="${x.key}">✏️</button>`);
 return a.join("")}
function row(x){
 const f=x.fx;
 return`<div class="fxr"><div class="fxn">M${x.no}</div><div class="fxm"><b>${esc(x.aName)} <span class="vs">বনাম</span> ${esc(x.bName)}</b><br><small>${esc(F.STAGE_LABEL[x.stage])}${f.time?" • ⏰ "+esc(fmtTime(f.time)):""}${(f.venue||FX.venue)?" • 📍 "+esc(f.venue||FX.venue):""}</small><div>${badges(x)}</div></div><div class="fxa">${acts(x)}</div></div>`}
function adminEditor(L){
 const names=Object.fromEntries(L.map(x=>[x.key,`M${x.no} ${F.STAGE_LABEL[x.stage]}: ${x.aName} বনাম ${x.bName}`]));
 const probs=F.problems(WORK);
 return`<details class="fxd" id="fxEd"${msg?" open":""}><summary>✏️ সময়সূচি সম্পাদনা (Admin)</summary>
 <div class="fxg"><label>প্রথম দিন<input type="date" data-g="startDate" value="${esc(GEN.startDate)}"></label><label>প্রথম ম্যাচ<input type="time" data-g="startTime" value="${esc(GEN.startTime)}"></label><label>ম্যাচের মাঝে ব্যবধান (মিনিট)<input type="number" min="30" max="480" data-g="gapMin" value="${esc(GEN.gapMin)}"></label><label>রিজার্ভের পর বিরতি (দিন)<input type="number" min="1" max="5" data-g="restDays" value="${esc(GEN.restDays)}"></label></div>
 <p><button class="fxb go" data-act="gen">⚡ পরিকল্পনা অনুযায়ী সব ম্যাচের সময় বসান</button> <small class="muted">৪ দিন প্রতিদিন ২টি প্রথম রাউন্ড + ১টি কোয়ার্টার, তারপর রিজার্ভ দিন, শেষ দিনে ২ সেমিফাইনাল + ফাইনাল। সময় পরে বদলানো যাবে।</small></p>
 <label class="fxg1">ডিফল্ট মাঠ (সব ম্যাচে দেখাবে, ঐচ্ছিক)<input data-g="venue" value="${esc(WORK.__venue??FX.venue??"")}" placeholder="যেমন: জেলিয়াখালী মাঠ"></label>
 <div class="fxt">${L.map(x=>{const f=WORK[x.key]||{};return`<div class="fxe" id="fxe-${x.key}"><b>${esc(names[x.key])}</b><div class="fxg"><input type="date" data-k="${x.key}" data-f="date" value="${esc(f.date||"")}"><input type="time" data-k="${x.key}" data-f="time" value="${esc(f.time||"")}"><input data-k="${x.key}" data-f="venue" placeholder="মাঠ (ফাঁকা = ডিফল্ট)" value="${esc(f.venue||"")}"><select data-k="${x.key}" data-f="status"><option value="scheduled"${f.status!=="postponed"?" selected":""}>নির্ধারিত</option><option value="postponed"${f.status==="postponed"?" selected":""}>⏸️ স্থগিত</option></select><input data-k="${x.key}" data-f="note" placeholder="নোট / কারণ" value="${esc(f.note||"")}"></div></div>`}).join("")}</div>
 <label class="fxg1">রিজার্ভ / বিশ্রামের দিন<input type="date" data-g="reserveDate" value="${esc(WORK.__reserve??FX.reserveDate??"")}"></label>
 ${probs.length?`<div class="fxw">⚠️ ${probs.map(esc).join("<br>⚠️ ")}</div>`:""}
 <p><button class="fxb go" data-act="save">💾 সময়সূচি সেভ</button> <span class="muted">${esc(msg)}</span></p></details>`}
function render(){
 if(!panel)return;
 const L=list(),now=Date.now(),today=todayISO(),days=F.byDay(L),nx=F.nextUp(L,now);
 const todays=L.filter(x=>x.fx.date===today);
 const unsched=L.filter(x=>!x.fx.date);
 const any=Object.keys(FX.fixtures||{}).length>0;
 panel.innerHTML=`<div class="fxprint"><b>${esc(cfg().title)}</b><br>পরিচালনায় — ${esc(cfg().organizer)}</div>
 <div class="card-head"><h2>📅 ফিকশ্চার ও সময়সূচি</h2><span class="pill" id="fxNext">${nx?`⏳ পরের ম্যাচ M${nx.no} — ${F.countdown(nx.ms-now)} পরে`:(any?"সব ম্যাচের সময় পার":"সময়সূচি শীঘ্রই")}</span></div>
 ${todays.length?`<div class="fxtd"><b>🗓️ আজকের ম্যাচ</b>${todays.map(row).join("")}</div>`:""}
 <div class="fxtool"><button class="fxb" data-act="share">📤 WhatsApp-এ শেয়ার</button><button class="fxb" data-act="ics">📆 Calendar (.ics)</button><button class="fxb" data-act="print">🖨️ Print / PDF</button>${ADMIN()?`<button class="fxb go" data-act="sendAll">📣 সব দলকে সময়সূচি পাঠান</button><button class="fxb" data-act="sendToday">📣 আজকের ম্যাচের দলকে</button>`:""}</div>
 ${any?days.map(([d,a])=>`<div class="fxday"><h3>🗓️ ${esc(F.dayTitle(d))}</h3>${a.map(row).join("")}</div>`).join(""):'<p class="muted">ম্যাচের সময়সূচি এখনও দেওয়া হয়নি।</p>'}
 ${FX.reserveDate?`<div class="fxday rest"><h3>🗓️ ${esc(F.dayTitle(FX.reserveDate))}</h3><p>রিজার্ভ / বিশ্রামের দিন — প্রয়োজনে স্থগিত ম্যাচ এই দিনে</p></div>`:""}
 ${any&&unsched.length?`<div class="fxday"><h3>⏳ সময় ঠিক হয়নি</h3>${unsched.map(row).join("")}</div>`:""}
 ${ADMIN()?adminEditor(L):""}`;
 decorate(L)}
function decorate(L){
 L=L||list();
 document.querySelectorAll("#bracket .match-card[data-key]").forEach(card=>{
  const x=L.find(m=>m.key===card.dataset.key);if(!x)return;
  card.querySelector(".fxline")?.remove();
  const f=x.fx,bits=[f.date&&"🗓️ "+fmtDate(f.date),f.time&&"⏰ "+fmtTime(f.time),(f.venue||FX.venue)&&"📍 "+(f.venue||FX.venue)].filter(Boolean).join(" • ");
  const live=x.matchId?`<a class="fxb" href="live.html?match=${encodeURIComponent(x.matchId)}">🔴 Live Score</a>`:"";
  if(bits||live||badges(x))card.insertAdjacentHTML("beforeend",`<div class="fxline">${bits?`<small>${esc(bits)}</small>`:'<small class="muted">সময় ঠিক হয়নি</small>'}<div>${badges(x)}</div>${live}</div>`)})}
function seedWork(){
 WORK={};for(const m of F.matchList())WORK[m.key]={...(FX.fixtures?.[m.key]||{})};
 WORK.__venue=FX.venue||"";WORK.__reserve=FX.reserveDate||""}
async function loadFx(){
 const s=season();
 try{FX=await getCached("vc_fx_"+s,()=>getDoc(doc(db,"tournaments","fixtures-"+s)).then(x=>x.exists()?x.data():{}),60000)||{}}catch{FX={}}
 FX={fixtures:FX.fixtures||{},reserveDate:FX.reserveDate||"",venue:FX.venue||""};
 loaded=s;seedWork();await loadLive();render()}
async function loadLive(){
 const ids=Object.values(B().current.matchIds||{}).filter(Boolean);
 if(!ids.length){LIVE={};return}
 try{LIVE=await getCached("vc_fxlive",()=>getDocs(collection(db,"liveMatches")).then(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());return o}),45000)}catch{}}
function toBroadcast(body,teams){try{localStorage.setItem("vcajBcDraft",JSON.stringify({body,teams:teams||[]}))}catch{}location.href="broadcast.html"}
const pickTeams=a=>[...new Set(a.flatMap(x=>[x.a&&x.aName,x.b&&x.bName]).filter(Boolean))];
async function save(){
 const fixtures={};
 for(const m of F.matchList()){const f=WORK[m.key]||{};if(f.date||f.time||f.venue||f.note||f.status==="postponed")fixtures[m.key]={date:f.date||"",time:f.time||"",venue:(f.venue||"").trim(),note:(f.note||"").trim(),status:f.status==="postponed"?"postponed":"scheduled"}}
 try{
  await setDoc(doc(db,"tournaments","fixtures-"+season()),{season:Number(season()),fixtures,reserveDate:WORK.__reserve||"",venue:(WORK.__venue||"").trim(),updatedAtMs:Date.now(),updatedBy:auth.currentUser?.email||""});
  clearCached("vc_fx_"+season());FX={fixtures,reserveDate:WORK.__reserve||"",venue:(WORK.__venue||"").trim()};msg="✅ সময়সূচি সেভ হয়েছে";seedWork();render()
 }catch(e){msg="❌ "+(e.code==="permission-denied"?"অনুমতি নেই — Admin হিসেবে Login আছে কি?":e.message);render()}}
function onClick(e){
 const t=e.target.closest&&e.target.closest("[data-act]");if(!t)return;
 const act=t.dataset.act,L=list(),k=t.dataset.k;
 if(act==="share"){window.open("https://wa.me/?text="+encodeURIComponent(fullText(L)),"_blank")}
 else if(act==="ics"){const c=F.toIcs(L,{season:season(),title:cfg().title,venue:FX.venue});const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([c],{type:"text/calendar"}));a.download=`VCAJ-fixtures-${season()}.ics`;a.click()}
 else if(act==="print"){document.body.classList.add("pr-fx");window.print();setTimeout(()=>document.body.classList.remove("pr-fx"),600)}
 else if(act==="sendAll"){toBroadcast(F.scheduleBody(L,{reserveDate:FX.reserveDate,venue:FX.venue}),[])}
 else if(act==="sendToday"){const td=L.filter(x=>x.fx.date===todayISO());if(!td.length){alert("আজকের কোনো ম্যাচ নেই");return}toBroadcast(F.scheduleBody(td,{venue:FX.venue}),pickTeams(td))}
 else if(act==="send"){const x=L.find(m=>m.key===k);if(x)toBroadcast(F.matchBody(x,{venue:FX.venue}),pickTeams([x]))}
 else if(act==="edit"){const el=document.getElementById("fxe-"+k);const d=document.getElementById("fxEd");if(d)d.open=true;el&&el.scrollIntoView({behavior:"smooth"})}
 else if(act==="gen"){const g=F.generate(GEN);if(g.error){msg="⚠️ "+g.error;render();return}
  if(Object.values(WORK).some(v=>v&&v.date)&&!confirm("এখনকার সব সময় বদলে পরিকল্পনা অনুযায়ী নতুন সময় বসবে (সেভ না করা পর্যন্ত স্থায়ী হবে না)। ঠিক আছে?"))return;
  const keep={};for(const m of F.matchList())keep[m.key]={...g.fixtures[m.key],venue:WORK[m.key]?.venue||""};
  WORK={...keep,__venue:WORK.__venue,__reserve:g.reserveDate};msg="পরিকল্পনা বসানো হয়েছে — যাচাই করে 💾 সেভ করুন";render()}
 else if(act==="save")save()}
function onInput(e){
 const t=e.target,d=t.dataset||{};
 if(d.g){if(d.g==="venue")WORK.__venue=t.value;else if(d.g==="reserveDate")WORK.__reserve=t.value;else GEN[d.g]=t.value;return}
 if(d.k&&d.f){WORK[d.k]=WORK[d.k]||{};WORK[d.k][d.f]=t.value;
  const w=panel.querySelector&&panel.querySelector(".fxw");const p=F.problems(WORK);
  if(e.type==="change"){render()}}}
function css(){
 const s=document.createElement("style");
 s.textContent=`#fxPanel .fxr{display:grid;grid-template-columns:auto 1fr;gap:10px;padding:10px 0;border-bottom:1px solid var(--line,#dbe4f0);align-items:start}#fxPanel .fxn{background:#0d2344;color:#fff;border-radius:10px;padding:4px 8px;font-weight:800;font-size:12px}#fxPanel .fxa{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap}
#fxPanel .vs{color:var(--orange,#ff8a1f);font-weight:700;font-size:12px}#fxPanel .fxb{border:2px solid var(--line,#dbe4f0);background:transparent;color:inherit;border-radius:10px;padding:6px 10px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block}#fxPanel .fxb.go{background:#16a34a;border-color:#16a34a;color:#fff}
#fxPanel .fxk{display:inline-block;margin:4px 4px 0 0;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:800;background:#e2e8f0;color:#334155}#fxPanel .fxk.live{background:#fee2e2;color:#b91c1c}#fxPanel .fxk.done{background:#dcfce7;color:#166534}#fxPanel .fxk.pp{background:#fef3c7;color:#92400e}
#fxPanel .fxday{margin-top:14px}#fxPanel .fxday h3{margin:0 0 4px;font-size:16px}#fxPanel .fxday.rest{padding:10px 12px;border-radius:12px;background:rgba(255,138,31,.1)}#fxPanel .fxtd{padding:10px 12px;border-radius:14px;background:rgba(22,163,74,.1);margin-bottom:10px}
#fxPanel .fxtool{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}#fxPanel .fxd{margin-top:16px;border:1px dashed var(--line,#dbe4f0);border-radius:14px;padding:10px 12px}#fxPanel .fxd summary{cursor:pointer;font-weight:800}
#fxPanel .fxg{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0}#fxPanel .fxg input,#fxPanel .fxg select,#fxPanel .fxg1 input{width:100%;font:inherit}#fxPanel .fxg1{display:block;font-weight:700;font-size:13px;margin:8px 0}#fxPanel .fxe{padding:8px 0;border-bottom:1px solid var(--line,#dbe4f0)}#fxPanel .fxw{background:#fef3c7;color:#92400e;border-radius:12px;padding:8px 12px;font-size:13px;margin:8px 0}
#fxPanel .fxprint{display:none}.match-card .fxline{margin-top:8px;padding-top:6px;border-top:1px dashed var(--line,#dbe4f0)}.match-card .fxline .fxk{display:inline-block;margin:4px 4px 0 0;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:800;background:#e2e8f0;color:#334155}.match-card .fxline .fxk.live{background:#fee2e2;color:#b91c1c}.match-card .fxline .fxk.done{background:#dcfce7;color:#166534}.match-card .fxline .fxk.pp{background:#fef3c7;color:#92400e}.match-card .fxline .fxb{display:inline-block;margin-top:6px;border:2px solid #dc2626;color:#dc2626;border-radius:10px;padding:4px 9px;font-size:12px;font-weight:800;text-decoration:none}
@media print{body.pr-fx *{visibility:hidden}body.pr-fx #fxPanel,body.pr-fx #fxPanel *{visibility:visible}body.pr-fx #fxPanel{position:absolute;left:0;top:0;width:100%;box-shadow:none}body.pr-fx #fxPanel .fxprint{display:block;margin-bottom:10px;text-align:center}body.pr-fx #fxPanel .fxa,body.pr-fx #fxPanel .fxtool,body.pr-fx #fxPanel .fxd{display:none!important}}`;
 document.head.appendChild(s)}
function init(){
 const anchor=document.getElementById("bracket")?.closest("section");if(!anchor)return;
 css();panel=document.createElement("section");panel.className="card";panel.id="fxPanel";anchor.insertAdjacentElement("beforebegin",panel);
 panel.addEventListener("click",onClick);panel.addEventListener("input",onInput);panel.addEventListener("change",onInput);
 window.addEventListener("vcaj-bracket-render",async()=>{if(season()!==loaded)await loadFx();else{await loadLive();render()}});
 onAuthStateChanged(auth,()=>render());
 setInterval(async()=>{if(document.hidden)return;await loadLive();render()},60000);
 loadFx()}
init();
export{init};
