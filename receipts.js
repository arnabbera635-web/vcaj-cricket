import {auth,db,isAdmin,updateDoc,onAuthStateChanged,signInWithEmailAndPassword,collection,doc,getDoc,getDocs,setDoc,query,orderBy} from "./firebase.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money=v=>"₹"+Number(v||0).toLocaleString("en-IN");
const T={member:{bn:"Member চাঁদা",c:"M",p:"মাসিক চাঁদা"},donation:{bn:"অতিথি অনুদান",c:"D",p:"অনুদান"},sponsor:{bn:"Sponsor Payment",c:"S",p:"Sponsorship"}};
let type="member",rows=[],members=[],cur=null,selMember=null;
const base=location.origin+location.pathname;
const today=()=>new Date().toISOString().slice(0,10);
const fmtDate=d=>{try{return new Date(d+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}catch{return d}};
function msg(r){return `🏏 VCAJ — Payment Received ✅\n\nপ্রিয় ${r.name},\nআপনার ${money(r.amount)} (${T[r.type].bn}${r.purpose?" — "+r.purpose:""}) সফলভাবে গ্রহণ করা হয়েছে।\nRecept No: ${r.receiptNo}\nতারিখ: ${fmtDate(r.date)}\nমাধ্যম: ${r.method}\n\nযাচাই করুন: ${base}?v=${r.code}\n\nধন্যবাদ 🙏\nVivekananda Cricket Association of Jeliakhali`.replace("Recept","Receipt")}
function phone91(p){let d=String(p||"").replace(/\D/g,"");if(d.startsWith("0"))d=d.slice(1);if(d.length===10)d="91"+d;return d.length>=11?d:""}
function showReceipt(r){cur=r;$("rcCard").classList.remove("hide");
 $("receipt").innerHTML=`<h2>VIVEKANANDA CRICKET ASSOCIATION OF JELIAKHALI</h2><div class="sub">PAYMENT RECEIPT — ${esc(T[r.type].bn)}</div>
 <div class="r"><span>Receipt No</span><b>${esc(r.receiptNo)}</b></div><div class="r"><span>তারিখ</span><b>${esc(fmtDate(r.date))}</b></div>
 <div class="r"><span>প্রাপ্ত হয়েছে</span><b>${esc(r.name)}</b></div>${r.phone?`<div class="r"><span>মোবাইল</span><b>${esc(r.phone)}</b></div>`:""}
 ${r.purpose?`<div class="r"><span>বিবরণ</span><b>${esc(r.purpose)}</b></div>`:""}<div class="r"><span>মাধ্যম</span><b>${esc(r.method)}${r.ref?" • "+esc(r.ref):""}</b></div>
 <div class="amt">${money(r.amount)}</div><div class="r"><span>Verification Code</span><b style="font-size:11px">${esc(r.code)}</b></div>
 <div class="sig"><span>গ্রহীতার স্বাক্ষর</span><span>কোষাধ্যক্ষ / VCAJ</span></div>`;
 $("rcCard").scrollIntoView({behavior:"smooth"})}
async function load(){
 const s=await getDocs(query(collection(db,"paymentReceipts"),orderBy("createdAtMs","desc")));rows=s.docs.map(d=>d.data());render()}
function render(){
 const f=$("fType").value,q=$("fSearch").value.trim().toLowerCase();
 const list=rows.filter(r=>(!f||r.type===f)&&(!q||[r.name,r.phone,r.receiptNo].join(" ").toLowerCase().includes(q)));
 const sum=t=>rows.filter(r=>r.type===t).reduce((a,r)=>a+Number(r.amount||0),0);
 $("tiles").innerHTML=[["মোট",sum("member")+sum("donation")+sum("sponsor")],["Member চাঁদা",sum("member")],["অনুদান",sum("donation")],["Sponsor",sum("sponsor")]].map(x=>`<div class="tile"><b>${money(x[1])}</b><span>${x[0]}</span></div>`).join("");
 $("list").innerHTML=list.length?`<div class="table-wrap"><table><tr><th>Receipt</th><th>তারিখ</th><th>নাম</th><th>ধরন</th><th>টাকা</th><th></th></tr>${list.map(r=>`<tr><td>${esc(r.receiptNo)}</td><td>${esc(fmtDate(r.date))}</td><td>${esc(r.name)}</td><td>${esc(T[r.type]?.bn)}</td><td><b>${money(r.amount)}</b></td><td><button data-c="${esc(r.code)}">দেখুন / পাঠান</button></td></tr>`).join("")}</table></div>`:"<p class='muted'>কোনো receipt নেই।</p>";
 $("list").querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>showReceipt(rows.find(r=>r.code===b.dataset.c)))}
function setType(t){type=t;document.querySelectorAll("#types button").forEach(b=>b.classList.toggle("on",b.dataset.t===t));
 $("memberPick").classList.toggle("hide",t!=="member");$("nameLbl").textContent=t==="sponsor"?"Sponsor / সংস্থার নাম *":"নাম *";$("purpose").placeholder=T[t].p}
document.querySelectorAll("#types button").forEach(b=>b.onclick=()=>setType(b.dataset.t));
function pick(m){if(!m)return;selMember=m;setType("member");$("memberSel").value=m.label;$("name").value=m.name;$("phone").value=m.phone||"";const f=parseInt(String(m.fee||"").replace(/[^\d]/g,""),10);if(f>0)$("amount").value=f;$("purpose").value=`সদস্য চাঁদা${m.season?" — "+m.season:""}`}
const onSel=()=>{const m=members.find(x=>x.label===$("memberSel").value);if(m)pick(m)};$("memberSel").onchange=onSel;$("memberSel").oninput=onSel;
$("fType").onchange=render;$("fSearch").oninput=render;
$("saveBtn").onclick=async()=>{
 const name=$("name").value.trim(),amount=Number($("amount").value);
 if(!name||!(amount>0)){$("saveMsg").textContent="⚠️ নাম ও টাকার পরিমাণ দিন";return}
 const b=$("saveBtn");b.disabled=true;$("saveMsg").textContent="সেভ হচ্ছে…";
 try{
  const now=Date.now(),yy=String(new Date().getFullYear()).slice(2),n=rows.filter(r=>r.type===type).length+1;
  const code="RC"+[...crypto.getRandomValues(new Uint8Array(12))].map(x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();
  const r={code,type,name,phone:$("phone").value.trim(),amount,method:$("method").value,date:$("date").value||today(),purpose:$("purpose").value.trim(),ref:$("ref").value.trim(),receiptNo:`VCAJ/${T[type].c}/${yy}/${String(n).padStart(4,"0")}`,memberId:(type==="member"&&selMember&&selMember.name===name)?selMember.id:"",createdAtMs:now,createdBy:auth.currentUser?.email||""};
  await setDoc(doc(db,"paymentReceipts",code),r);
  await setDoc(doc(db,"receiptChecks",code),{receiptNo:r.receiptNo,type,name,amount,date:r.date,method:r.method,purpose:r.purpose});
  rows.unshift(r);render();showReceipt(r);
  if(r.memberId){try{const fee=parseInt(String(selMember.fee||"").replace(/[^\d]/g,""),10)||0,st=fee&&amount>=fee?"পরিশোধিত":"আংশিক";await updateDoc(doc(db,"members",r.memberId),{feeStatus:st});await setDoc(doc(db,"memberDirectory",r.memberId),{paymentStatus:st},{merge:true})}catch(e){}}
  selMember=null;
  ["name","phone","amount","purpose","ref","memberSel"].forEach(i=>$(i).value="");$("saveMsg").textContent="✅ Receipt তৈরি হয়েছে";
 }catch(e){$("saveMsg").textContent="❌ সেভ হয়নি: "+(e.code==="permission-denied"?"firestore.rules-এ নতুন নিয়ম publish করুন (নিচে নির্দেশনা দেখুন)":e.message)}
 b.disabled=false};
$("waBtn").onclick=()=>{if(!cur)return;const p=phone91(cur.phone);window.open(`https://wa.me/${p}?text=${encodeURIComponent(msg(cur))}`,"_blank")};
$("smsBtn").onclick=()=>{if(!cur)return;const p=phone91(cur.phone);location.href=`sms:${p?"+"+p:""}?body=${encodeURIComponent(msg(cur))}`};
$("printBtn").onclick=()=>print();
$("copyBtn").onclick=()=>{if(cur)navigator.clipboard?.writeText(msg(cur)).then(()=>window.vcToast?.("📋 কপি হয়েছে"))};
$("csvBtn").onclick=()=>{const h=["Receipt No","Date","Type","Name","Phone","Amount","Method","Purpose","Ref"],c=[h,...rows.map(r=>[r.receiptNo,r.date,T[r.type]?.bn,r.name,r.phone,r.amount,r.method,r.purpose,r.ref])].map(a=>a.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+c],{type:"text/csv"}));a.download="VCAJ-receipts.csv";a.click()};
$("loginBtn").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value,$("pw").value)}catch(e){$("loginMsg").textContent="Login হয়নি: "+e.message}};
$("date").value=today();
// public verification
const v=new URLSearchParams(location.search).get("v");
if(v){$("verifyBox").classList.remove("hide");$("loginBox").classList.add("hide");
 getDoc(doc(db,"receiptChecks",v.trim())).then(s=>{$("verifyOut").innerHTML=s.exists()?(x=>`<p style="color:#16a34a;font-weight:800">✓ এটি VCAJ-এর অফিসিয়াল Receipt</p><p><b>${esc(x.receiptNo)}</b><br>${esc(x.name)} — <b>${money(x.amount)}</b><br>${esc(T[x.type]?.bn)} • ${esc(fmtDate(x.date))} • ${esc(x.method)}</p>`)(s.data()):'<p style="color:#d64545;font-weight:800">✗ এই কোডের কোনো Receipt পাওয়া যায়নি।</p>'}).catch(()=>{$("verifyOut").textContent="যাচাই করা যায়নি, পরে চেষ্টা করুন।"})}
else onAuthStateChanged(auth,async u=>{const ok=isAdmin(u);$("loginBox").classList.toggle("hide",ok);$("app").classList.toggle("hide",!ok);
 if(ok){try{const s=await getDocs(collection(db,"members"));members=s.docs.map(d=>{const x=d.data();return{id:d.id,fee:x.fee||"",season:x.season||"",name:x.name||"",phone:x.phone||"",label:`${x.name||""}${x.phone?" • "+x.phone:""}`}}).filter(m=>m.name);$("memberList").innerHTML=members.map(m=>`<option value="${esc(m.label)}">`).join("");const mid=new URLSearchParams(location.search).get("member");if(mid)pick(members.find(m=>m.id===mid))}catch{}
  try{await load()}catch(e){$("list").innerHTML="<p class='muted'>Receipt লোড হয়নি — firestore.rules আপডেট করুন।</p>"}}});

try{$("upiId").value=localStorage.getItem("vcUpi")||""}catch{}
$("upiBtn").onclick=()=>{const id=$("upiId").value.trim();if(!/^[\w.\-]{2,}@[\w]{2,}$/.test(id)){window.vcToast?.("⚠️ সঠিক UPI ID দিন");return}
 try{localStorage.setItem("vcUpi",id)}catch{}const a=Number($("upiAmt").value)||0,u=`upi://pay?pa=${encodeURIComponent(id)}&pn=${encodeURIComponent("VCAJ Cricket")}&cu=INR${a?"&am="+a:""}&tn=${encodeURIComponent("VCAJ")}`;
 const box=$("upiQr");box.innerHTML="";if(!window.QRCode){box.textContent="QR লাইব্রেরি লোড হয়নি — ইন্টারনেট চেক করুন";return}
 new QRCode(box,{text:u,width:220,height:220});const c=document.createElement("div");c.innerHTML=`<b>VCAJ — ${esc(id)}</b>${a?`<br>${money(a)}`:""}<br><small>যেকোনো UPI অ্যাপ দিয়ে স্ক্যান করুন</small>`;box.appendChild(c);$("upiPrint").classList.remove("hide")};
$("upiPrint").onclick=()=>{document.body.classList.add("pr-qr");print();setTimeout(()=>document.body.classList.remove("pr-qr"),600)};

try{$("upiId").value=localStorage.getItem("vcajUpi")||""}catch{}
$("qrBtn").onclick=()=>{const id=$("upiId").value.trim();if(!/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(id)){$("qrNote").textContent="⚠️ সঠিক UPI ID দিন (যেমন name@bank)";return}
 try{localStorage.setItem("vcajUpi",id)}catch{}const amt=Number($("upiAmt").value)||0,url=`upi://pay?pa=${encodeURIComponent(id)}&pn=${encodeURIComponent("VCAJ Cricket")}&cu=INR${amt?"&am="+amt:""}`;
 $("qrOut").innerHTML="";if(window.QRCode){new QRCode($("qrOut"),{text:url,width:220,height:220});$("qrNote").textContent="এই QR স্ক্যান করে PhonePe/GPay/Paytm দিয়ে টাকা পাঠানো যাবে।"}else{$("qrNote").innerHTML=`QR লাইব্রেরি লোড হয়নি (ইন্টারনেট দেখুন)। <a href="${url}">UPI লিংকে চাপুন</a>`}};
