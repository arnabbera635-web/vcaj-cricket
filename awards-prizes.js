/* Awards Management add-on: calculate the printed prize list from verified scoring events, then select & save winners. */
import {db,doc,setDoc,serverTimestamp} from "./firebase.js";
import {loadOverrides,merge,prizeText} from "./prizes-merge.js";
import {clearCached} from "./vcaj-cache.js";
import {calcPrize,KIND,MODE,RULE} from "./prize-calc.js";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const bn=s=>String(s).replace(/\d/g,d=>"০১২৩৪৫৬৭৮৯"[d]);
const slug=s=>String(s).replace(/[^A-Za-z0-9_-]+/g,"-").slice(0,90);
let P={all:[]},cur=null;
function init(){
 const A=window.__vcajAwards,anchor=$("calculateAward")?.closest(".aw-card");
 if(!anchor||document.getElementById("prizePanel"))return;
 if(!A){anchor.insertAdjacentHTML("beforebegin",'<section class="aw-card"><div class="aw-error">Prize panel চালু হয়নি — awards-smart-compatible.js নতুন ভার্সন আপলোড করুন।</div></section>');return}
 anchor.insertAdjacentHTML("beforebegin",`<section class="aw-card" id="prizePanel"><h2>🏆 পুরস্কার তালিকা থেকে Auto-Calculate</h2>
 <div class="aw-sub">ছাপা তালিকার প্রতিটি পুরস্কারের জন্য স্কোরারের ডেটা থেকে প্রার্থী হিসাব হবে। যেটা হিসাব করা যায় না সেটা Manual। নিচের Season ঘরের সালই ধরা হবে (Calculate Award-এর Season)।</div>
 <div class="aw-actions"><button class="aw-btn gray" id="ppScan">🔄 ম্যাচ ডেটা নতুন করে স্ক্যান</button><a class="aw-btn gray" href="prize-admin.html" style="text-decoration:none">✏️ পুরস্কার তালিকা সম্পাদনা</a><span class="aw-status" id="ppMsg"></span></div>
 <div id="ppOverview" class="aw-table"></div><div id="ppResult"></div></section>`);
 const sv=$("awardPrize");if(sv&&!$("awardPrizeNo"))sv.insertAdjacentHTML("afterend",'<input id="awardPrizeNo" type="hidden">');
 $("ppScan").onclick=async()=>{$("ppMsg").textContent="স্ক্যান হচ্ছে…";try{await A.verify(true);$("ppMsg").textContent="✅ স্ক্যান শেষ";}catch(e){$("ppMsg").textContent="❌ "+e.message}};
 overview()}
const season=()=>Number($("awardSeason")?.value||2026);
function savedCount(no){return window.__vcajAwards.state().awards.filter(a=>String(a.prizeNo||"")===String(no)&&String(a.season)===String(season())).length}
async function overview(){
 P=merge(await loadOverrides());
 $("ppOverview").innerHTML=`<table><tr><th>নং</th><th>পুরস্কার</th><th>হিসাব</th><th>সেভ</th><th></th></tr>${P.all.map(p=>{const k=KIND[p.no]||"manual",c=savedCount(p.no);
  return`<tr><td>${bn(p.no)}</td><td>${p.icon||""} ${esc(p.title)}${p.hidden?" <small>(লুকানো)</small>":""}</td><td title="${esc(MODE[k][1])}">${MODE[k][0]}</td><td>${c?`<b style="color:#16a34a">${bn(c)}টি</b>`:"—"}</td><td><button class="aw-btn ${k==="manual"?"gray":""}" data-no="${esc(p.no)}">${k==="manual"?"✍️ Manual":"🧮 Calculate"}</button></td></tr>`}).join("")}</table>`;
 $("ppOverview").querySelectorAll("[data-no]").forEach(b=>b.onclick=()=>run(b.dataset.no))}
async function run(no){
 const A=window.__vcajAwards,meta=P.all.find(p=>String(p.no)===String(no));if(!meta)return;
 const k=KIND[no]||"manual",out=$("ppResult");
 if(k==="manual"){
  $("saveType").value="CUSTOM";$("awardCustomName").value=meta.title;$("awardPrize").value=prizeText(meta);$("awardPrizeNo").value=String(no);
  out.innerHTML=`<div class="aw-ok">✋ <b>${esc(meta.title)}</b> ডেটা থেকে হিসাব করা যায় না। নিচের "Save / Edit Award" ঘরে নাম ও দল বসিয়ে Save করুন (পুরস্কারের নাম ও বিবরণ ভরে দিয়েছি)।</div>`;
  $("saveAward").closest(".aw-card").scrollIntoView({behavior:"smooth"});return}
 out.innerHTML='<div class="aw-status">হিসাব হচ্ছে…</div>';
 try{
  await A.verify(false);
  const r=calcPrize(no,A,season());
  if(r.error){out.innerHTML=`<div class="aw-error">${esc(r.error)}</div>`;return}
  cur={no:String(no),meta,groups:r.groups,empty:r.empty};drawResult(r.empty)
 }catch(e){out.innerHTML=`<div class="aw-error">Calculation error: ${esc(e.message)}</div>`}}
function idOf(no,row){return`award-${season()}-p${no}-${slug(row.key)}`}
function drawResult(){
 const A=window.__vcajAwards,saved=new Set(A.state().awards.map(a=>a.id)),{no,meta,groups}=cur,k=KIND[no];
 const note=k==="auto"?"":`<div class="aw-note">${MODE[k][0]} — ${esc(MODE[k][1])}</div>`;
 const total=groups.reduce((a,g)=>a+g.rows.length,0);
 $("ppResult").innerHTML=`<div style="margin-top:14px"><h3 style="margin:0 0 4px">${meta.icon||"🏆"} পুরস্কার নং ${bn(no)} — ${esc(meta.title)}</h3><div class="aw-sub">📐 নিয়ম: ${esc(RULE[no]||"")}</div>${note}
 ${total?"":`<div class="aw-error">${esc(cur.empty||"কোনো প্রার্থী পাওয়া যায়নি — completed ম্যাচের ডেটা আছে কি না দেখুন")}</div>`}
 ${groups.map((g,gi)=>`<div style="margin:12px 0 4px"><b>${esc(g.title)}</b> <small class="aw-meta">${g.rows.length?`(${bn(g.rows.length)}টি প্রার্থী)`:"(কেউ নেই)"}</small></div>${g.rows.map((r,ri)=>{const isSaved=saved.has(idOf(no,r));
  return`<label class="aw-candidate ${ri<g.pick?"top":""}" style="display:block;cursor:pointer"><input type="checkbox" data-g="${gi}" data-r="${ri}" ${ri<g.pick&&!isSaved?"checked":""} ${isSaved?"disabled":""}> <b>#${ri+1} ${esc(r.name)}</b> <span class="aw-tag">${esc(r.metric)}</span>${isSaved?' <span class="aw-tag" style="background:#dcfce7;color:#166534">✅ আগেই সেভ</span>':""}<div class="aw-meta">${esc(r.team)}</div></label>`}).join("")}`).join("")}
 ${total?`<div class="aw-actions"><button class="aw-btn gold" id="ppSave">✅ টিক দেওয়াগুলো Save করুন</button><span class="aw-status" id="ppSaveMsg">টিক বদলে নিজে বেছে নিতে পারেন। সেভের পর Awards পেজে নিজে থেকে দেখাবে।</span></div>`:""}</div>`;
 $("ppSave")?.addEventListener("click",save)}
async function save(){
 const A=window.__vcajAwards,{no,meta,groups}=cur,players=A.state().players,existing=new Set(A.state().awards.map(a=>a.id));
 const picks=[...$("ppResult").querySelectorAll("input[data-g]:checked")].map(i=>({g:groups[+i.dataset.g],r:groups[+i.dataset.g].rows[+i.dataset.r]}));
 if(!picks.length){$("ppSaveMsg").textContent="কিছু টিক দেননি";return}
 $("ppSave").disabled=true;$("ppSaveMsg").textContent="সেভ হচ্ছে…";let n=0;
 try{
  for(const {g,r} of picks){
   const id=idOf(no,r),pl=players.find(p=>p.id===r.id);
   const payload={season:season(),scope:r.matchId?"MATCH":"TOURNAMENT",awardType:"CUSTOM",awardName:meta.title,playerId:r.id||"",playerName:r.name,recipientName:r.name,teamId:pl?.teamId||"",teamName:r.team||"",matchId:r.matchId||"",prize:prizeText(meta),note:`${g.title}${r.metric?" — "+r.metric:""}`,prizeNo:String(no),public:true,calculatedBy:"VCAJ Prize-list Auto Engine",updatedAt:serverTimestamp()};
   if(!existing.has(id))payload.createdAt=serverTimestamp(),payload.id=id;
   await setDoc(doc(db,"awards",id),payload,{merge:true});n++}
  clearCached("vc_prizeAwards");await A.load();await overview();drawResult();
  $("ppSaveMsg").textContent=`✅ ${bn(n)}টি Award সেভ হয়েছে`
 }catch(e){$("ppSave").disabled=false;$("ppSaveMsg").textContent="❌ "+(e.code==="permission-denied"?"অনুমতি নেই — Admin হিসেবে Login করা আছে কি?":e.message)}}
let tries=0;(function wait(){if(window.__vcajAwards&&$("calculateAward")){init();return}if(++tries<80)setTimeout(wait,150);else init()})();
