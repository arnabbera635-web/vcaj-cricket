import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,collection,getDocs,query,orderBy,limit} from "./firebase.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const AC={"receipt.create":["রসিদ তৈরি","c"],"receipt.edit":["রসিদ Edit","e"],"voucher.create":["ভাউচার তৈরি","c"],"voucher.edit":["ভাউচার Edit","e"],"voucher.approve":["ভাউচার অনুমোদন","c"],"voucher.reject":["ভাউচার ফেরত","r"],"office.assign":["পদ নির্ধারণ","e"],"perm.update":["অনুমতি বদল","e"],"receipt.print":["রসিদ প্রিন্ট",""],"receipt.share":["রসিদ শেয়ার",""],"voucher.print":["ভাউচার প্রিন্ট",""],"voucher.share":["ভাউচার শেয়ার",""],"csv.export":["CSV নামানো","r"],"session.login":["লগইন",""]};
let rows=[];
const when=r=>{try{return r.at.toDate().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}catch{return""}};
function render(){
 const p=$("fp").value,a=$("fa").value,q=$("fs").value.trim().toLowerCase();
 const L=rows.filter(r=>(!p||r.uid===p)&&(!a||String(r.action).startsWith(a))&&(!q||[r.name,r.officeLabel,r.summary,r.docId].join(" ").toLowerCase().includes(q)));
 $("cnt").textContent=`${L.length} টি এন্ট্রি (সর্বশেষ ${rows.length}টি লোড হয়েছে)`;
 $("list").innerHTML=L.length?L.map(r=>{const ac=AC[r.action]||[r.action,""];return`<div class="lg"><span class="tag ${ac[1]}">${esc(ac[0])}</span><b>${esc(r.name)}</b> <small>(${esc(r.officeLabel)})</small> <small>• ${esc(when(r))}</small><div>${esc(r.summary)}</div>${r.before?`<pre>আগে: ${esc(JSON.stringify(r.before))}</pre>`:""}</div>`}).join(""):'<p class="muted">কোনো এন্ট্রি নেই।</p>'}
function who(){
 const P={};rows.forEach(r=>{const p=P[r.uid]||(P[r.uid]={name:r.name,label:r.officeLabel,n:0,last:0,login:0,w:0});p.n++;const t=r.at&&r.at.toMillis?r.at.toMillis():0;if(t>p.last)p.last=t;if(r.action==="session.login"&&t>p.login)p.login=t;if(/\.(create|edit|approve|reject)$/.test(r.action))p.w++});
 const f=t=>{try{return t?new Date(t).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"—"}catch{return"—"}};
 const L=Object.entries(P).sort((a,b)=>b[1].last-a[1].last);
 $("who").innerHTML=L.length?`<h3 style="margin:0 0 8px">👤 ব্যক্তি-ভিত্তিক সারাংশ</h3>${L.map(([u,p])=>`<div class="lg"><b>${esc(p.name)}</b> <small>(${esc(p.label||"পদ নেই")})</small><br><small>মোট কাজ: ${p.n} • লেখা/বদল: ${p.w} • শেষ লগইন: ${f(p.login)} • শেষ সক্রিয়: ${f(p.last)}</small> <button data-w="${esc(u)}" style="margin-left:6px">দেখুন</button></div>`).join("")}`:"";
 $("who").querySelectorAll("[data-w]").forEach(b=>b.onclick=()=>{$("fp").value=b.dataset.w;render();$("list").scrollIntoView({behavior:"smooth"})})}
async function load(){
 $("list").textContent="লোড হচ্ছে…";
 try{const s=await getDocs(query(collection(db,"activityLog"),orderBy("at","desc"),limit(300)));rows=s.docs.map(d=>({id:d.id,...d.data()}));
  const seen={};rows.forEach(r=>seen[r.uid]=`${r.name} (${r.officeLabel})`);const keep=$("fp").value;
  $("fp").innerHTML='<option value="">সব ব্যক্তি</option>'+Object.entries(seen).map(([u,n])=>`<option value="${esc(u)}">${esc(n)}</option>`).join("");$("fp").value=keep;who();render()}
 catch(e){$("list").textContent="লোড হয়নি: "+(e.code==="permission-denied"?"firestore.rules-এ activityLog-এর নিয়ম publish করুন":e.message)}}
["fp","fa"].forEach(i=>$(i).onchange=render);$("fs").oninput=render;$("rf").onclick=load;
$("csv").onclick=()=>{const c=[["Time","Name","Office","Action","Summary","DocId"],...rows.map(r=>[when(r),r.name,r.officeLabel,(AC[r.action]||[r.action])[0],r.summary,r.docId])].map(a=>a.map(x=>`"${String(x??"").replace(/"/g,'""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+c],{type:"text/csv"}));a.download="VCAJ-activity-log.csv";a.click()};
$("lb").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value.trim(),$("pw").value)}catch{$("lm").textContent="Login হয়নি"}};
onAuthStateChanged(auth,u=>{const ok=isAdmin(u);$("lg").classList.toggle("hide",ok);$("app").classList.toggle("hide",!ok);if(ok)load()});
