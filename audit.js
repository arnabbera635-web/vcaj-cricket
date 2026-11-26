import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,collection,doc,getDoc,getDocs,query,orderBy,limit} from "./firebase.js";
import {runAudit,buildCashBook,reconcile,csvOf,METHODS,TYPE_LABEL} from "./audit-core.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>(Number(v)<0?"−":"")+"₹"+Math.abs(Number(v)||0).toLocaleString("en-IN");
const LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},SV=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
let D=null,A=null,B=null,tab="sum",ack=LS("vcajAuditAck",{}),counted=LS("vcajAuditCount",{}),chk=null,showAck=false;
const opts=()=>({pendingDays:Number($("o_days").value)||3,bigAmount:Number($("o_big").value)||5000,opening:Number($("o_open").value)||0});
const sig=i=>i.id+"|"+i.items.length+"|"+i.items.join("").length;
const fmtD=iso=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||"");return m?`${m[3]}/${m[2]}/${m[1]}`:"তারিখ নেই"};
function recompute(){if(!D)return;const o=opts();A=runAudit(D,o);B=buildCashBook(D,o)}
function drawSum(){
 if(!A){$("p_sum").innerHTML="";return}
 const vis=A.issues.filter(i=>showAck||ack[i.id]!==sig(i)),hid=A.issues.length-vis.length,c=A.counts;
 $("p_sum").innerHTML=`<div class="tiles"><div class="tile ${c.error?"e":"o"}"><b>${c.error}</b><span>ভুল (জরুরি)</span></div><div class="tile ${c.warn?"w":"o"}"><b>${c.warn}</b><span>সন্দেহজনক</span></div><div class="tile"><b>${c.info}</b><span>লক্ষ করার মতো</span></div><div class="tile"><b>${money(A.income)}</b><span>মোট আয়</span></div><div class="tile"><b>${money(A.expense)}</b><span>মোট ব্যয়</span></div></div>
 <p class="hint">পড়া হয়েছে: ${A.checked.receipts}টি রসিদ, ${A.checked.desk}টি টিম রসিদ, ${A.checked.vouchers}টি ভাউচার, ${A.checked.regs}টি দল, ${A.checked.members}জন সদস্য।</p>
 ${A.issues.length?"":'<div class="is info"><h4>✅ কোনো সমস্যা পাওয়া যায়নি</h4><div class="nt">যে নিয়মগুলো এই পেজ দেখে, সব মিলেছে। তবে হাতে আসল টাকা আছে কি না সেটা আপনাকে নিজে গুনে মেলাতে হবে।</div></div>'}
 ${vis.map(i=>`<div class="is ${i.sev}"><h4><span class="b">${esc(i.area)}</span>${esc(i.title)} <small>(${i.items.length}টি)</small></h4><ul>${i.items.slice(0,40).map(x=>`<li>${esc(x)}</li>`).join("")}${i.items.length>40?`<li>… আরও ${i.items.length-40}টি</li>`:""}</ul>${i.note?`<div class="nt">ℹ️ ${esc(i.note)}</div>`:""}<div class="acts noprint" style="margin-top:8px">${i.link?`<a href="${esc(i.link)}"><button class="sm">➡️ ঠিক করতে যান</button></a>`:""}<button class="sm" data-ack="${esc(i.id)}">${ack[i.id]===sig(i)?"↩️ আবার দেখান":"✅ দেখেছি"}</button></div></div>`).join("")}
 ${hid?`<p class="noprint hint">${hid}টি সমস্যা "দেখেছি" চিহ্নিত বলে লুকানো। <button class="sm" id="togAck">${showAck?"লুকান":"দেখান"}</button></p>`:""}
 <div class="acts noprint"><button class="sm" id="csvIs">⬇️ সমস্যার CSV</button></div>`;
 $("p_sum").querySelectorAll("[data-ack]").forEach(b=>b.onclick=()=>{const i=A.issues.find(x=>x.id===b.dataset.ack);if(ack[i.id]===sig(i))delete ack[i.id];else ack[i.id]=sig(i);SV("vcajAuditAck",ack);drawSum()});
 const t=$("togAck");if(t)t.onclick=()=>{showAck=!showAck;drawSum()};
 $("csvIs").onclick=()=>dl("VCAJ-audit-issues.csv",csvOf([["ধরন","এলাকা","সমস্যা","বিবরণ"],...A.issues.flatMap(i=>i.items.map(x=>[i.sev,i.area,i.title,x]))]))}
function drawCb(){
 if(!B){$("p_cb").innerHTML="";return}
 const o=opts();
 $("p_cb").innerHTML=`<div class="tiles"><div class="tile"><b>${money(B.opening)}</b><span>শুরুর জমা</span></div><div class="tile o"><b>${money(B.income)}</b><span>মোট আয়</span></div><div class="tile e"><b>${money(B.expense)}</b><span>মোট ব্যয়</span></div><div class="tile"><b>${money(B.closing)}</b><span>চলতি জমা</span></div></div>
 ${B.undated?`<p class="hint">⚠️ ${B.undated}টি এন্ট্রির তারিখ নেই — সেগুলো তালিকার শেষে আছে আর চলতি জমার সারিতে ধরা হয়নি, কিন্তু মোটে ধরা আছে।</p>`:""}
 <div class="tw"><table class="cb"><tr><th>তারিখ</th><th>বিবরণ</th><th>মাধ্যম</th><th>আয়</th><th>ব্যয়</th><th>জমা</th></tr>${B.rows.map(r=>`<tr><td>${esc(fmtD(r.date))}</td><td>${esc(r.desc)}</td><td>${esc(r.method)}</td><td class="n">${r.in?money(r.in):""}</td><td class="n">${r.out?money(r.out):""}</td><td class="n ${r.bal<0?"neg":""}">${r.bal===null?"—":money(r.bal)}</td></tr>`).join("")}<tr class="tot"><td colspan="3">মোট</td><td class="n">${money(B.income)}</td><td class="n">${money(B.expense)}</td><td class="n">${money(B.closing)}</td></tr></table></div>
 <div class="acts noprint" style="margin-top:10px"><button class="sm" id="csvCb">⬇️ CSV</button></div>`;
 $("csvCb").onclick=()=>dl("VCAJ-cashbook.csv",csvOf([["তারিখ","বিবরণ","মাধ্যম","আয়","ব্যয়","জমা"],...B.rows.map(r=>[r.date,r.desc,r.method,r.in||"",r.out||"",r.bal??""])]))}
function drawRec(){
 if(!B){$("p_rec").innerHTML="";return}
 const R=reconcile(B,counted);
 $("p_rec").innerHTML=`<p class="hint">"সিস্টেম অনুযায়ী জমা" মানে এই মাধ্যমে যত আয়-ব্যয় লেখা আছে তার হিসাব (শুরুর জমা ধরা হয়নি)। হাতে/ব্যাংকে/UPI অ্যাকাউন্টে আসলে যত আছে সেটা নিজে গুনে বসান, ফারাক নিচে দেখাবে। ঘরের লেখা এই ফোনে মনে থাকে।</p>
 <div class="tw"><table class="cb"><tr><th>মাধ্যম</th><th>আয়</th><th>ব্যয়</th><th>সিস্টেম অনুযায়ী জমা</th><th class="noprint">আসল গোনা (₹)</th><th>ফারাক</th></tr>${R.map(x=>`<tr><td>${esc(x.method)}</td><td class="n">${money(x.in)}</td><td class="n">${money(x.out)}</td><td class="n">${money(x.bal)}</td><td class="noprint"><input data-c="${esc(x.method)}" type="number" value="${x.counted??""}" style="width:110px"></td><td class="n ${x.diff?"neg":""}">${x.diff===null?"—":(x.diff===0?"✅ মিলেছে":(x.diff>0?"+":"")+money(x.diff))}</td></tr>`).join("")}</table></div>
 <p class="hint">ফারাক = আসল গোনা − সিস্টেমের জমা। ধনাত্মক হলে হাতে বেশি, ঋণাত্মক হলে কম আছে।</p>`;
 $("p_rec").querySelectorAll("[data-c]").forEach(i=>i.onchange=()=>{if(i.value==="")delete counted[i.dataset.c];else counted[i.dataset.c]=i.value;SV("vcajAuditCount",counted);drawRec()})}
function drawChk(){
 const n=(D?.receipts||[]).length;
 $("p_chk").innerHTML=`<p class="hint">প্রতিটা সদস্য/অনুদান/Sponsor রসিদের সঙ্গে সবার জন্য খোলা যাচাইয়ের নথি (যেটা দেখে কেউ রসিদ আসল কি না যাচাই করে) মিলিয়ে দেখা হয়। ${n}টি রসিদের জন্য ${n}টি নথি পড়া হবে, তাই বোতাম চেপে চালাতে হয়।</p><p class="noprint"><button id="runChk" ${n?"":"disabled"}>▶ মেলানো শুরু (${n}টি)</button> <span id="chkSt" class="muted"></span></p>
 ${chk?`<div class="is ${chk.bad.length?"error":"info"}"><h4>${chk.bad.length?`❌ ${chk.bad.length}টি অমিল`:"✅ সবগুলো মিলেছে"}</h4><ul>${chk.bad.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><div class="nt">পড়া হয়েছে ${chk.done}টি, যাচাইয়ের নথি পাওয়া গেছে ${chk.found}টি।</div></div>`:""}`;
 const b=$("runChk");if(b)b.onclick=runChk}
async function runChk(){
 const R=D.receipts;chk={bad:[],done:0,found:0};
 for(const r of R){
  $("chkSt").textContent=`${chk.done}/${R.length}…`;
  try{const s=await getDoc(doc(db,"receiptChecks",r.code));chk.done++;
   if(!s.exists()){chk.bad.push(`${r.receiptNo} — যাচাইয়ের নথি নেই (লিংক খুললে "পাওয়া যায়নি" দেখাবে)`);continue}
   chk.found++;const c=s.data(),diffs=[];
   if(Number(c.amount)!==Number(r.amount))diffs.push(`টাকা: নথিতে ${money(c.amount)}, রসিদে ${money(r.amount)}`);
   if(String(c.receiptNo)!==String(r.receiptNo))diffs.push("রসিদ নম্বর আলাদা");
   if(String(c.name||"")!==String(r.name||""))diffs.push(`নাম: নথিতে "${c.name}", রসিদে "${r.name}"`);
   if(String(c.date||"")!==String(r.date||""))diffs.push("তারিখ আলাদা");
   if(String(c.type||"")!==String(r.type||""))diffs.push("ধরন আলাদা");
   if(diffs.length)chk.bad.push(`${r.receiptNo} — ${diffs.join("; ")}`)
  }catch(e){chk.bad.push(`${r.receiptNo} — পড়া যায়নি (${e.code||e.message})`)}}
 drawChk()}
function dl(name,text){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/csv"}));a.download=name;a.click()}
function show(t){tab=t;["sum","cb","rec","chk"].forEach(k=>$("p_"+k).classList.toggle("hide",k!==t));$("tabs").querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.t===t));
 ({sum:drawSum,cb:drawCb,rec:drawRec,chk:drawChk})[t]();
 $("phT").textContent="VCAJ — হিসাব অডিট প্রতিবেদন";$("phS").textContent=({sum:"সমস্যা ও সারাংশ",cb:"ক্যাশ বুক",rec:"মাধ্যম অনুযায়ী মিলান",chk:"যাচাইয়ের নথি"})[t]+" • "+new Date().toLocaleDateString("en-IN")}
async function load(){
 $("st").textContent="পড়া হচ্ছে…";
 const rd=async(n,q)=>(await getDocs(q||collection(db,n))).docs.map(d=>({...d.data(),id:d.id}));
 try{
  const [pr,vo,rg,mb]=await Promise.all([rd("paymentReceipts"),rd("paymentVouchers"),rd("teamRegistrations"),rd("members")]);
  let logs=[],complete=false;try{logs=await rd("activityLog",query(collection(db,"activityLog"),orderBy("at","desc"),limit(1000)));complete=logs.length<1000}catch(e){}
  D={receipts:pr.filter(r=>TYPE_LABEL[r.type]).map(r=>({...r,code:r.id})),desk:pr.filter(r=>r.payer&&!r.type).map(r=>({...r,code:r.id})),vouchers:vo,regs:rg,members:mb,logs,logsComplete:complete};
  chk=null;recompute();$("st").textContent=`✅ ${new Date().toLocaleTimeString("en-IN")} এ শেষ হয়েছে${complete?"":" (Activity Log পুরোটা পড়া যায়নি, তাই লগ-মেলানো বাদ)"}`;show(tab)
 }catch(e){$("st").textContent="❌ "+(e.code==="permission-denied"?"অনুমতি নেই — Admin হিসেবে Login আছে কি?":e.message)}}
$("run").onclick=load;["o_days","o_big","o_open"].forEach(i=>$(i).onchange=()=>{recompute();show(tab)});
$("tabs").querySelectorAll("button").forEach(b=>b.onclick=()=>show(b.dataset.t));
$("prt").onclick=()=>print();
$("lb").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value.trim(),$("pw2").value)}catch{$("lm").textContent="Login হয়নি"}};
onAuthStateChanged(auth,async u=>{const ok=isAdmin(u);$("lg").classList.toggle("hide",ok);$("app").classList.toggle("hide",!ok);if(ok)await load()});
