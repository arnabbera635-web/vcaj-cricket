import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,collection,doc,getDocs,updateDoc,deleteDoc,writeBatch} from "./firebase.js";
import {isDeskReceipt,classify,registryOf} from "./team-income.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>"₹"+Number(v||0).toLocaleString("en-IN");
const LOCAL_KEY="vcajIssuedReceipts";
const LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
let rows=[],reg=registryOf([]),sel=new Set();
const REASON={trial:["🧪 Trial","t"],registered:["⚠️ নিবন্ধিত দল — আয়ে আলাদা ধরা হয়নি","r"],excluded:["🚫 হাতে বাদ","x"],included:["✅ হাতে আয়ে ধরা","c"],unregistered:["✅ আয়ে ধরা","c"]};
const when=r=>{const t=r.issuedAtMs||0;return t?new Date(t).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):(r.paymentDate||"")};
const view=()=>{const f=$("flt").value,q=$("q").value.trim().toLowerCase();
 return rows.filter(r=>{const c=r._c;return(f==="all"||(f==="trial"&&r.trial)||(f==="counted"&&c.counted)||(f==="skipped"&&!c.counted&&!r.trial))&&(!q||[r.payer,r.phone,r.category].join(" ").toLowerCase().includes(q))})};
function render(){
 rows.forEach(r=>r._c=classify(r,reg));
 const sum=a=>a.reduce((t,r)=>t+Number(r.amount||0),0),cn=rows.filter(r=>r._c.counted),tr=rows.filter(r=>r.trial),rg=rows.filter(r=>r._c.reason==="registered"||r._c.reason==="excluded");
 $("tiles").innerHTML=`<div class="tile"><b>${rows.length}</b><span>মোট রসিদ</span></div><div class="tile"><b>${money(sum(cn))}</b><span>আয়ে যোগ হচ্ছে (${cn.length}টি)</span></div><div class="tile"><b>${money(sum(rg))}</b><span>আয়ে ধরা হয়নি (${rg.length}টি)</span></div><div class="tile"><b>${tr.length}</b><span>🧪 Trial (${money(sum(tr))})</span></div>`;
 const L=view();
 $("list").innerHTML=L.length?L.map(r=>{const [t,k]=REASON[r._c.reason];return`<div class="rw"><input type="checkbox" data-k="${esc(r.code)}" ${sel.has(r.code)?"checked":""}><div><b>${esc(r.payer)}</b> <small>${esc(r.phone||"নম্বর নেই")}</small><br><small>${esc(r.category||"")} • ${esc(when(r))} • ${esc(r.code)}</small><br><span class="b ${k}">${t}</span></div><div class="rr acts"><b>${money(r.amount)}</b><select data-m="${esc(r.code)}" title="আয়ের হিসাবে"><option value="auto"${(r.incomeMode||"auto")==="auto"?" selected":""}>আয়ে: স্বয়ংক্রিয়</option><option value="include"${r.incomeMode==="include"?" selected":""}>আয়ে ধরুন</option><option value="exclude"${r.incomeMode==="exclude"?" selected":""}>আয়ে ধরবেন না</option></select><button class="sm" data-t="${esc(r.code)}">${r.trial?"↩️ Trial ফেরান":"🧪 Trial"}</button></div></div>`}).join(""):"<p class='muted'>কোনো রসিদ নেই।</p>";
 $("list").querySelectorAll("[data-k]").forEach(c=>c.onchange=()=>{c.checked?sel.add(c.dataset.k):sel.delete(c.dataset.k)});
 $("list").querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>setTrial([b.dataset.t],!rows.find(r=>r.code===b.dataset.t).trial));
 $("list").querySelectorAll("[data-m]").forEach(s=>s.onchange=()=>setMode(s.dataset.m,s.value))}
async function setTrial(codes,on){
 if(!codes.length){$("msg").textContent="কিছু বাছা হয়নি";return}
 $("msg").textContent="সেভ হচ্ছে…";
 try{
  for(let i=0;i<codes.length;i+=400){const b=writeBatch(db);codes.slice(i,i+400).forEach(c=>b.update(doc(db,"paymentReceipts",c),{trial:on,trialAtMs:on?Date.now():0}));await b.commit()}
  rows.forEach(r=>{if(codes.includes(r.code)){r.trial=on;r.trialAtMs=on?Date.now():0}});codes.forEach(c=>sel.delete(c));
  $("msg").textContent=on?`✅ ${codes.length}টি trial করা হয়েছে`:`✅ ${codes.length}টি আবার আসল করা হয়েছে`;render()
 }catch(e){$("msg").textContent="❌ "+(e.code==="permission-denied"?"অনুমতি নেই — Admin হিসেবে Login আছে কি?":e.message)}}
async function setMode(code,mode){
 try{await updateDoc(doc(db,"paymentReceipts",code),{incomeMode:mode});const r=rows.find(x=>x.code===code);r.incomeMode=mode;$("msg").textContent="✅ সেভ হয়েছে";render()}catch(e){$("msg").textContent="❌ "+e.message}}
async function delTrial(){
 const T=[...sel].filter(c=>rows.find(r=>r.code===c)?.trial);
 const skipped=sel.size-T.length;
 if(!T.length){$("msg").textContent="শুধু Trial চিহ্নিত রসিদ মোছা যায় — আগে বাছাইগুলো Trial করুন"+(skipped?` (${skipped}টি trial নয়)`:"");return}
 if(!confirm(`${T.length}টি trial রসিদ স্থায়ীভাবে মুছে ফেলবেন? এটা আর ফেরানো যাবে না।${skipped?`\n(বাছা ${skipped}টি trial নয় বলে মোছা হবে না)`:""}`))return;
 $("msg").textContent="মুছছে…";let n=0;
 try{for(const c of T){await deleteDoc(doc(db,"paymentReceipts",c));n++}
  rows=rows.filter(r=>!T.includes(r.code));T.forEach(c=>sel.delete(c));$("msg").textContent=`✅ ${n}টি মোছা হয়েছে`;render()
 }catch(e){$("msg").textContent=`❌ ${n}টি মুছেছে, তারপর থামল: `+(e.code==="permission-denied"?"firestore.rules-এ trial রসিদ মোছার নিয়ম publish করুন":e.message);render()}}
function localDraw(){
 const L=LS(LOCAL_KEY,[]).filter(l=>!rows.some(r=>r.code===l.code));
 $("localBox").classList.toggle("hide",!L.length);
 $("localList").innerHTML=L.map(l=>`<div class="rw" style="grid-template-columns:1fr auto"><div><b>${esc(l.payer)}</b> <small>${esc(l.phone||"")}</small><br><small>${esc(l.category||"")} • ${money(l.amount)} • ${esc(l.code)}</small></div><div><button class="sm warn" data-l="${esc(l.code)}">🗑️ মুছুন</button></div></div>`).join("");
 $("localList").querySelectorAll("[data-l]").forEach(b=>b.onclick=()=>{if(!confirm("এই রসিদটা এই ফোন থেকে মুছবেন?"))return;try{localStorage.setItem(LOCAL_KEY,JSON.stringify(LS(LOCAL_KEY,[]).filter(x=>x.code!==b.dataset.l)))}catch{}localDraw()})}
async function load(){
 let regs=[];try{regs=(await getDocs(collection(db,"teamRegistrations"))).docs.map(d=>d.data())}catch(e){}
 reg=registryOf(regs);
 try{rows=(await getDocs(collection(db,"paymentReceipts"))).docs.map(d=>({...d.data(),code:d.id})).filter(isDeskReceipt).sort((a,b)=>(b.issuedAtMs||0)-(a.issuedAtMs||0))}
 catch(e){$("list").innerHTML="<p class='muted'>রসিদ লোড হয়নি: "+esc(e.message)+"</p>";return}
 render();localDraw()}
$("flt").onchange=render;$("q").oninput=render;
$("selAll").onclick=()=>{view().forEach(r=>sel.add(r.code));render()};$("selNone").onclick=()=>{sel.clear();render()};
$("mkTrial").onclick=()=>setTrial([...sel],true);$("unTrial").onclick=()=>setTrial([...sel],false);$("delTrial").onclick=delTrial;
$("delLocalAll").onclick=()=>{if(confirm("এই ফোনে সেভ থাকা সব অসেভ রসিদ মুছবেন?")){try{localStorage.removeItem(LOCAL_KEY)}catch{}localDraw()}};
$("lb").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value.trim(),$("pw2").value)}catch{$("lm").textContent="Login হয়নি"}};
onAuthStateChanged(auth,async u=>{const ok=isAdmin(u);$("lg").classList.toggle("hide",ok);$("app").classList.toggle("hide",!ok);if(ok)await load()});
