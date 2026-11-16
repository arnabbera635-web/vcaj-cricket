import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,collection,getDocs,doc,updateDoc,writeBatch} from "./firebase.js";
import {fee,money,p91,cfgOk,payLink,buildMsg} from "./dues-pay.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},SV=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const base=()=>location.origin+location.pathname.replace(/[^/]*$/,"");
const isDue=m=>m.feeStatus!=="পরিশোধিত";
let M=[],sent=LS("vcajDuesSent",{});
const P=()=>({upi:$("upi").value.trim(),payee:$("payee").value.trim()||"VCAJ",wa:$("clubWa").value.trim()});
const linkOn=()=>$("linkOpt").value==="on";
const msg=m=>buildMsg(m,P(),linkOn(),base());
const eligible=L=>L.filter(m=>isDue(m)&&p91(m.phone)&&(!linkOn()||fee(m)>0));
const day=ts=>{try{return new Date(ts).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}catch{return""}};
function saveCfg(){SV("vcajPayCfg",{...P(),link:$("linkOpt").value});render()}
function hint(){
 const el=$("payHint");
 if(!linkOn()){el.innerHTML='<div class="warn">Payment link বন্ধ আছে — মেসেজে শুধু লেখা যাবে।</div>';return}
 if(!cfgOk(P())){el.innerHTML='<div class="warn">⚠️ সঠিক UPI ID দিন (যেমন vcaj@okaxis), নাহলে মেসেজে পেমেন্ট লিংক যাবে না।</div>';return}
 const s=M.find(m=>isDue(m)&&fee(m)>0);
 el.innerHTML=s?`<div class="okb">✅ পেমেন্ট লিংক চালু। যেমন ${esc(s.name)}-এর জন্য ${money(fee(s))}-এর লিংক:<br>${esc(payLink(s,P(),base()))}</div>`:'<div class="warn">লিংক চালু, কিন্তু কারও চাঁদা এখনও ধার্য নেই — নিচের "ধার্য চাঁদা ঠিক করুন" থেকে টাকা দিন।</div>'}
function render(){
 const f=$("fs").value,q=$("q").value.trim().toLowerCase();
 const all=M,due=M.filter(isDue),noFee=due.filter(m=>!fee(m)).length;
 const list=M.filter(m=>(f==="all"||(f==="due"?isDue(m):m.feeStatus===f))&&(!q||(m.name||"").toLowerCase().includes(q)));
 const tot=due.reduce((a,m)=>a+fee(m),0);
 $("tiles").innerHTML=`<div class="tile"><b>${all.length}</b><span>মোট সদস্য</span></div><div class="tile"><b>${all.length-due.length}</b><span>পরিশোধিত</span></div><div class="tile"><b>${due.length}</b><span>বাকি/আংশিক</span></div><div class="tile"><b>${money(tot)}</b><span>মোট বকেয়া (ধার্য)</span></div><div class="tile"><b>${noFee}</b><span>চাঁদা ধার্য নেই</span></div>`;
 $("list").innerHTML=list.length?`<div class="table-wrap"><table><tr><th>নাম</th><th>চাঁদা</th><th>অবস্থা</th><th></th></tr>${list.map(m=>`<tr><td>${esc(m.name)}<br><small class="muted">${esc(m.phone||"নম্বর নেই")}</small></td><td>${fee(m)?money(fee(m)):'<small class="muted">ধার্য নেই</small>'} <button class="fe" data-e="${esc(m.id)}" title="চাঁদা ধার্য / বদলান">✏️</button></td><td>${esc(m.feeStatus||"বাকি")}${sent[m.id]?`<br><span class="sent">✓ ${day(sent[m.id])} পাঠানো</span>`:""}</td><td><div class="acts">${isDue(m)&&p91(m.phone)?`<button class="wa sm" data-w="${esc(m.id)}">📲 তাগাদা</button><button class="sm" data-c="${esc(m.id)}" title="মেসেজ কপি">📋</button>`:""}<a href="receipts.html?member=${encodeURIComponent(m.id)}"><button class="sm">🧾 Receipt</button></a></div></td></tr>`).join("")}</table></div>`:"<p class='muted'>কেউ নেই 🎉</p>";
 window._L=list;
 $("list").querySelectorAll("[data-w]").forEach(b=>b.onclick=()=>send(b.dataset.w));
 $("list").querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>copy(b.dataset.c,b));
 $("list").querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>editFee(b.dataset.e));
 hint();bulk(list)}
function bulk(list){
 const E=eligible(list||window._L||[]),done=E.filter(m=>sent[m.id]).length,skipped=(list||window._L||[]).filter(m=>isDue(m)&&p91(m.phone)&&linkOn()&&!fee(m)).length;
 $("bulkInfo").innerHTML=`<b>${done} / ${E.length}</b> জনকে পাঠানো হয়েছে${skipped?` <small class="muted">• ${skipped} জনের চাঁদা ধার্য নেই বলে বাদ</small>`:""}`;
 $("bulkBar").style.width=(E.length?done*100/E.length:0)+"%"}
function send(id){
 const m=M.find(x=>x.id===id);if(!m)return;
 if(linkOn()&&!fee(m)&&!confirm(`${m.name}-এর চাঁদা ধার্য নেই, তাই মেসেজে পেমেন্ট লিংক যাবে না। তবুও পাঠাবেন?`))return;
 window.open(`https://wa.me/${p91(m.phone)}?text=${encodeURIComponent(msg(m))}`,"_blank");
 sent[id]=Date.now();SV("vcajDuesSent",sent);render()}
function copy(id,btn){const m=M.find(x=>x.id===id);if(!m)return;(navigator.clipboard?navigator.clipboard.writeText(msg(m)):Promise.reject()).then(()=>{btn.textContent="✅";setTimeout(()=>btn.textContent="📋",1500)}).catch(()=>prompt("মেসেজ কপি করুন:",msg(m)))}
async function editFee(id){
 const m=M.find(x=>x.id===id);if(!m)return;
 const v=prompt(`${m.name} — ধার্য চাঁদা (₹) লিখুন`,fee(m)||"");if(v===null)return;
 const n=parseInt(String(v).replace(/[^\d]/g,""),10);
 if(!(n>0&&n<=1000000)){alert("সঠিক টাকার অঙ্ক দিন");return}
 try{await updateDoc(doc(db,"members",id),{fee:n,feeAssignedAtMs:Date.now()});m.fee=n;render()}catch(e){alert("সেভ হয়নি: "+e.message)}}
async function assignFee(){
 const n=parseInt(String($("feeAmt").value).replace(/[^\d]/g,""),10),sc=$("feeScope").value;
 if(!(n>0&&n<=1000000)){$("feeMsg").textContent="⚠️ সঠিক টাকার অঙ্ক দিন";return}
 const T=sc==="all"?M:sc==="filter"?(window._L||[]):M.filter(m=>!fee(m));
 if(!T.length){$("feeMsg").textContent="কোনো সদস্য মেলেনি";return}
 if(!confirm(`${T.length} জন সদস্যের ধার্য চাঁদা ${money(n)} করবেন?${sc==="all"||sc==="filter"?"\n(আগে ধার্য করা টাকা বদলে যাবে)":""}`))return;
 $("feeGo").disabled=true;$("feeMsg").textContent="সেভ হচ্ছে…";
 try{
  for(let i=0;i<T.length;i+=400){const b=writeBatch(db);T.slice(i,i+400).forEach(m=>b.update(doc(db,"members",m.id),{fee:n,feeAssignedAtMs:Date.now()}));await b.commit()}
  T.forEach(m=>m.fee=n);$("feeMsg").textContent=`✅ ${T.length} জনের চাঁদা ${money(n)} ধার্য হয়েছে`;render()
 }catch(e){$("feeMsg").textContent="❌ "+(e.code==="permission-denied"?"অনুমতি নেই — Admin হিসেবে Login আছে কি?":e.message)}
 $("feeGo").disabled=false}
$("feeGo").onclick=assignFee;
$("bulkNext").onclick=()=>{const E=eligible(window._L||[]),n=E.find(m=>!sent[m.id]);if(!n){alert("এই তালিকার সবাইকে পাঠানো হয়ে গেছে 🎉");return}send(n.id)};
$("bulkReset").onclick=()=>{if(confirm("পাঠানোর হিসাব মুছে নতুন করে শুরু করবেন?")){const ids=new Set((window._L||[]).map(m=>m.id));Object.keys(sent).forEach(k=>{if(ids.has(k))delete sent[k]});SV("vcajDuesSent",sent);render()}};
$("testPay").onclick=()=>{
 if(!cfgOk(P())){alert("আগে সঠিক UPI ID দিন");return}
 const s=M.find(m=>fee(m)>0)||{name:"Test",fee:1,season:2026};
 window.open(payLink({...s,fee:fee(s)||1},P(),base()),"_blank")};
["upi","payee","clubWa"].forEach(i=>$(i).oninput=saveCfg);$("linkOpt").onchange=saveCfg;
$("fs").onchange=render;$("q").oninput=render;$("printBtn").onclick=()=>print();
$("csvBtn").onclick=()=>{const c=[["নাম","ফোন","ধার্য চাঁদা","অবস্থা"],...(window._L||[]).map(m=>[m.name,m.phone,fee(m),m.feeStatus])].map(a=>a.map(x=>`"${String(x??"").replace(/"/g,'""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+c],{type:"text/csv"}));a.download="VCAJ-dues.csv";a.click()};
$("loginBtn").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value,$("pw").value)}catch(e){$("loginMsg").textContent="Login হয়নি: "+e.message}};
{const c=LS("vcajPayCfg",{});$("upi").value=c.upi||"";$("payee").value=c.payee||"";$("clubWa").value=c.wa||"";$("linkOpt").value=c.link==="off"?"off":"on"}
onAuthStateChanged(auth,async u=>{const ok=isAdmin(u);$("loginBox").classList.toggle("hide",ok);$("app").classList.toggle("hide",!ok);
 if(ok){try{const s=await getDocs(collection(db,"members"));M=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));render()}catch{$("list").textContent="সদস্যদের তালিকা লোড হয়নি"}}});
