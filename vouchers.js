import {STAMP} from "./vcaj-stamp.js";
import {makePad,safeSig} from "./vcaj-sign.js";
import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,collection,doc,getDocs,setDoc,query,orderBy} from "./firebase.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money=v=>"₹"+Number(v||0).toLocaleString("en-IN");
const today=()=>new Date().toISOString().slice(0,10);
const fmtDate=d=>{try{return new Date(d+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}catch{return d}};
const padE=makePad($("padPayee")),padA=makePad($("padAppr"));let editing=null;
const sigImg=v=>safeSig(v)?`<img alt="signature" src="${safeSig(v)}">`:`<span class="sp"></span>`;
document.querySelectorAll("[data-clr]").forEach(b=>b.onclick=()=>(b.dataset.clr==="padPayee"?padE:padA).clear());
try{padA.load(localStorage.getItem("vcApprSig")||"");if(localStorage.getItem("vcApprBy"))$("approver").value=localStorage.getItem("vcApprBy")}catch{}
let rows=[],inc={reg:0,member:0,donation:0,sponsor:0},cur=null;
function words(n){n=Math.round(n);if(!n)return"Zero";const a=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"],b=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
 const two=x=>x<20?a[x]:b[Math.floor(x/10)]+(x%10?" "+a[x%10]:"");const three=x=>(x>=100?a[Math.floor(x/100)]+" Hundred"+(x%100?" ":""):"")+(x%100?two(x%100):"");
 const p=[];const cr=Math.floor(n/1e7);n%=1e7;const lk=Math.floor(n/1e5);n%=1e5;const th=Math.floor(n/1e3);n%=1e3;
 if(cr)p.push(two(cr)+" Crore");if(lk)p.push(two(lk)+" Lakh");if(th)p.push(two(th)+" Thousand");if(n)p.push(three(n));return p.join(" ")}
function phone91(p){let d=String(p||"").replace(/\D/g,"");if(d.startsWith("0"))d=d.slice(1);if(d.length===10)d="91"+d;return d.length>=11?d:""}
function msg(v){return `🏏 VCAJ — Payment Voucher\n\nপ্রিয় ${v.payee},\nVCAJ থেকে আপনাকে ${money(v.total)} (${v.cat}) প্রদান করা হয়েছে।\nVoucher No: ${v.voucherNo}\nতারিখ: ${fmtDate(v.date)}\nমাধ্যম: ${v.method}\n\nধন্যবাদ 🙏\nVivekananda Cricket Association of Jeliakhali`}
function addItem(d="",q=1,r=""){const w=document.createElement("div");w.className="item";w.innerHTML=`<input class="d" placeholder="বিবরণ" value="${esc(d)}"><input class="q" type="number" min="1" value="${q}" inputmode="numeric"><input class="r" type="number" min="0" placeholder="দর ₹" value="${r}" inputmode="numeric"><span class="t">₹0</span><button type="button" title="বাদ দিন">✕</button>`;
 w.querySelectorAll("input").forEach(i=>i.oninput=calc);w.querySelector("button").onclick=()=>{if(document.querySelectorAll(".item").length>1){w.remove();calc()}};$("items").appendChild(w);calc()}
function items(){return[...document.querySelectorAll(".item")].map(w=>{const q=Number(w.querySelector(".q").value)||0,r=Number(w.querySelector(".r").value)||0;return{desc:w.querySelector(".d").value.trim(),qty:q,rate:r,amount:q*r}}).filter(x=>x.desc||x.amount)}
function calc(){let g=0;document.querySelectorAll(".item").forEach(w=>{const t=(Number(w.querySelector(".q").value)||0)*(Number(w.querySelector(".r").value)||0);w.querySelector(".t").textContent=money(t);g+=t});$("grand").textContent=money(g);return g}
function show(v){cur=v;$("vCard").classList.remove("hide");
 $("voucher").innerHTML=`<h2>VIVEKANANDA CRICKET ASSOCIATION OF JELIAKHALI</h2><div class="sub">PAYMENT VOUCHER / RECEIPT</div>
 <div class="r"><span>Voucher No</span><b>${esc(v.voucherNo)}</b></div><div class="r"><span>তারিখ</span><b>${esc(fmtDate(v.date))}</b></div>
 <div class="r"><span>প্রাপক</span><b>${esc(v.payee)}${v.phone?" • "+esc(v.phone):""}</b></div><div class="r"><span>খরচের ধরন</span><b>${esc(v.cat)}</b></div>
 <table><tr><th>#</th><th>বিবরণ</th><th>পরিমাণ</th><th>দর</th><th>টাকা</th></tr>${v.items.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.desc)}</td><td>${x.qty}</td><td>${money(x.rate)}</td><td>${money(x.amount)}</td></tr>`).join("")}</table>
 <div class="tot">মোট: ${money(v.total)}</div><div class="words">In words: Rupees ${words(v.total)} Only</div>
 <div class="r" style="margin-top:8px"><span>মাধ্যম</span><b>${esc(v.method)}${v.ref?" • Ref: "+esc(v.ref):""}</b></div>
 <p style="font-size:12px;color:#444;margin:10px 0 0">আমি উপরোক্ত টাকা ${esc(v.payee)} হিসেবে বুঝিয়া পাইলাম।</p>
 <div class="sigs"><div class="sg">${sigImg(v.sigPayee)}<div class="ln">প্রাপকের স্বাক্ষর</div></div><div class="sg">${sigImg(v.sigApprover)}<div class="ln">${esc(v.approver||"অনুমোদনকারী")} — কোষাধ্যক্ষ / VCAJ</div></div></div>${v.editedAtMs?`<div style="text-align:center;font-size:10px;color:#888;margin-top:6px">সংশোধিত: ${esc(new Date(v.editedAtMs).toLocaleString("en-IN"))}</div>`:""}<img class="stamp" src="${STAMP}" alt="VCAJ Stamp">`;
 $("vCard").scrollIntoView({behavior:"smooth"})}
function render(){
 const f=$("fCat").value,q=$("fSearch").value.trim().toLowerCase();
 const list=rows.filter(v=>(!f||v.cat===f)&&(!q||[v.payee,v.voucherNo,v.phone].join(" ").toLowerCase().includes(q)));
 const exp=rows.reduce((a,v)=>a+Number(v.total||0),0);
 const income=inc.reg+inc.member+inc.donation+inc.sponsor,by={};rows.forEach(v=>by[v.cat]=(by[v.cat]||0)+Number(v.total||0));
 $("tiles").innerHTML=`<div class="tile g"><b>${money(income)}</b><span>মোট আয়</span></div><div class="tile r"><b>${money(exp)}</b><span>মোট খরচ</span></div><div class="tile"><b>${money(income-exp)}</b><span>বর্তমান জমা</span></div>`;
 $("summary").innerHTML=`<div class="rc-grid"><div><h3>📥 আয়ের হিসাব</h3>${[["Team Registration",inc.reg],["Member চাঁদা",inc.member],["অতিথি অনুদান",inc.donation],["Sponsor",inc.sponsor]].map(x=>`<div class="sr"><span>${x[0]}</span><b>${money(x[1])}</b></div>`).join("")}<div class="sr tt"><span>মোট আয়</span><b>${money(income)}</b></div></div><div><h3>📤 খরচের হিসাব</h3>${Object.entries(by).sort((a,b)=>b[1]-a[1]).map(x=>`<div class="sr"><span>${esc(x[0])}</span><b>${money(x[1])}</b></div>`).join("")||"<p class='muted'>কোনো খরচ নেই</p>"}<div class="sr tt"><span>মোট খরচ</span><b>${money(exp)}</b></div></div></div><button id="printSum" style="margin-top:12px">🖨️ হিসাব Print / PDF</button>`;
 $("printSum").onclick=()=>{document.body.classList.add("pr-sum");print();setTimeout(()=>document.body.classList.remove("pr-sum"),500)};
 $("list").innerHTML=list.length?`<div class="table-wrap"><table><tr><th>Voucher</th><th>তারিখ</th><th>প্রাপক</th><th>ধরন</th><th>টাকা</th><th></th></tr>${list.map(v=>`<tr><td>${esc(v.voucherNo)}</td><td>${esc(fmtDate(v.date))}</td><td>${esc(v.payee)}</td><td>${esc(v.cat)}</td><td><b>${money(v.total)}</b></td><td><button data-c="${esc(v.id)}">দেখুন</button> <button data-e="${esc(v.id)}">✏️ সম্পাদনা</button></td></tr>`).join("")}</table></div>`:"<p class='muted'>কোনো voucher নেই।</p>";
 $("list").querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>show(rows.find(v=>v.id===b.dataset.c)));
 $("list").querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>startEdit(b.dataset.e))}
async function load(){
 const s=await getDocs(query(collection(db,"paymentVouchers"),orderBy("createdAtMs","desc")));rows=s.docs.map(d=>d.data());
 inc={reg:0,member:0,donation:0,sponsor:0};
 try{const r=await getDocs(collection(db,"paymentReceipts"));r.docs.forEach(d=>{const x=d.data();if(inc[x.type]!==undefined)inc[x.type]+=Number(x.amount||0)})}catch{}
 try{const t=await getDocs(collection(db,"teamRegistrations"));inc.reg=t.docs.reduce((a,d)=>a+Number(d.data().totalPaid||0),0)}catch{}
 render()}
$("addItem").onclick=()=>addItem();
$("fCat").innerHTML+=[...$("cat").options].map(o=>`<option>${esc(o.text)}</option>`).join("");
$("fCat").onchange=render;$("fSearch").oninput=render;
function resetForm(){editing=null;["payee","phone","ref"].forEach(i=>$(i).value="");$("cat").selectedIndex=0;$("method").selectedIndex=0;$("date").value=today();$("items").innerHTML="";addItem();padE.clear();$("formTitle").textContent="➕ নতুন Voucher";$("saveBtn").textContent="💾 Voucher তৈরি করুন";$("cancelEdit").classList.add("hide")}
function startEdit(id){const v=rows.find(x=>x.id===id);if(!v)return;editing=id;
 const c=$("cat");if(![...c.options].some(o=>o.text===v.cat))c.add(new Option(v.cat,v.cat));c.value=v.cat;
 const m=$("method");if(![...m.options].some(o=>o.text===v.method))m.add(new Option(v.method,v.method));m.value=v.method;
 $("payee").value=v.payee||"";$("phone").value=v.phone||"";$("date").value=v.date||today();$("ref").value=v.ref||"";$("approver").value=v.approver||$("approver").value;
 $("items").innerHTML="";(v.items&&v.items.length?v.items:[{desc:"",qty:1,rate:""}]).forEach(x=>addItem(x.desc,x.qty,x.rate));
 padE.load(v.sigPayee||"");if(v.sigApprover)padA.load(v.sigApprover);
 $("formTitle").textContent="✏️ Voucher সম্পাদনা — "+v.voucherNo;$("saveBtn").textContent="💾 পরিবর্তন সেভ করুন";$("cancelEdit").classList.remove("hide");$("formCard").scrollIntoView({behavior:"smooth"})}
$("cancelEdit").onclick=()=>{resetForm();$("saveMsg").textContent=""};
$("saveBtn").onclick=async()=>{
 const payee=$("payee").value.trim(),it=items(),total=it.reduce((a,x)=>a+x.amount,0);
 if(!payee||!(total>0)){$("saveMsg").textContent="⚠️ প্রাপকের নাম ও কমপক্ষে একটা item-এর দর দিন";return}
 const b=$("saveBtn");b.disabled=true;$("saveMsg").textContent="সেভ হচ্ছে…";
 try{
  const f={cat:$("cat").value,payee,phone:$("phone").value.trim(),method:$("method").value,date:$("date").value||today(),ref:$("ref").value.trim(),approver:$("approver").value.trim(),items:it,total,sigPayee:padE.data(),sigApprover:padA.data()};
  let v;const wasEdit=!!editing;
  if(wasEdit){const old=rows.find(x=>x.id===editing);v={...old,...f,editedAtMs:Date.now(),editedBy:auth.currentUser?.email||"",editCount:(old.editCount||0)+1};await setDoc(doc(db,"paymentVouchers",editing),v);rows=rows.map(x=>x.id===editing?v:x)}
  else{const now=Date.now(),yy=String(new Date().getFullYear()).slice(2),id="PV"+now.toString(36).toUpperCase()+Math.floor(Math.random()*1e3);
   v={id,voucherNo:`VCAJ/PV/${yy}/${String(rows.length+1).padStart(4,"0")}`,...f,createdAtMs:now,createdBy:auth.currentUser?.email||""};await setDoc(doc(db,"paymentVouchers",id),v);rows.unshift(v)}
  render();show(v);
  try{if(!padA.isEmpty()){localStorage.setItem("vcApprSig",padA.data());localStorage.setItem("vcApprBy",f.approver)}}catch{}
  resetForm();$("approver").value=f.approver;$("saveMsg").textContent=wasEdit?"✅ পরিবর্তন সেভ হয়েছে":"✅ Voucher তৈরি হয়েছে";
 }catch(e){$("saveMsg").textContent="❌ সেভ হয়নি: "+(e.code==="permission-denied"?"firestore.rules-এ paymentVouchers-এর নিয়ম publish করুন":e.message)}
 b.disabled=false};
$("printBtn").onclick=()=>print();
$("waBtn").onclick=()=>{if(cur)window.open(`https://wa.me/${phone91(cur.phone)}?text=${encodeURIComponent(msg(cur))}`,"_blank")};
$("copyBtn").onclick=()=>{if(cur)navigator.clipboard?.writeText(msg(cur)).then(()=>window.vcToast?.("📋 কপি হয়েছে"))};
$("csvBtn").onclick=()=>{const c=[["Voucher No","Date","Payee","Phone","Category","Items","Total","Method","Ref"],...rows.map(v=>[v.voucherNo,v.date,v.payee,v.phone,v.cat,v.items.map(x=>`${x.desc} x${x.qty}`).join("; "),v.total,v.method,v.ref])].map(a=>a.map(x=>`"${String(x??"").replace(/"/g,'""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+c],{type:"text/csv"}));a.download="VCAJ-vouchers.csv";a.click()};
$("loginBtn").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value,$("pw").value)}catch(e){$("loginMsg").textContent="Login হয়নি: "+e.message}};
$("date").value=today();addItem();
onAuthStateChanged(auth,async u=>{const ok=isAdmin(u);$("loginBox").classList.toggle("hide",ok);$("app").classList.toggle("hide",!ok);if(ok){try{await load()}catch(e){$("list").innerHTML="<p class='muted'>Voucher লোড হয়নি — firestore.rules-এ নতুন নিয়ম যোগ করুন।</p>"}}});
