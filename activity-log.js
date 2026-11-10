import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,collection,getDocs,query,orderBy,limit} from "./firebase.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const AC={"receipt.create":["রসিদ তৈরি","c"],"receipt.edit":["রসিদ Edit","e"],"voucher.create":["ভাউচার তৈরি","c"],"voucher.edit":["ভাউচার Edit","e"],"voucher.approve":["ভাউচার অনুমোদন","c"],"voucher.reject":["ভাউচার ফেরত","r"],"office.assign":["পদ নির্ধারণ","e"]};
let rows=[];
const when=r=>{try{return r.at.toDate().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}catch{return""}};
function render(){
 const p=$("fp").value,a=$("fa").value,q=$("fs").value.trim().toLowerCase();
 const L=rows.filter(r=>(!p||r.uid===p)&&(!a||String(r.action).startsWith(a))&&(!q||[r.name,r.officeLabel,r.summary,r.docId].join(" ").toLowerCase().includes(q)));
 $("cnt").textContent=`${L.length} টি এন্ট্রি (সর্বশেষ ${rows.length}টি লোড হয়েছে)`;
 $("list").innerHTML=L.length?L.map(r=>{const ac=AC[r.action]||[r.action,""];return`<div class="lg"><span class="tag ${ac[1]}">${esc(ac[0])}</span><b>${esc(r.name)}</b> <small>(${esc(r.officeLabel)})</small> <small>• ${esc(when(r))}</small><div>${esc(r.summary)}</div>${r.before?`<pre>আগে: ${esc(JSON.stringify(r.before))}</pre>`:""}</div>`}).join(""):'<p class="muted">কোনো এন্ট্রি নেই।</p>'}
async function load(){
 $("list").textContent="লোড হচ্ছে…";
 try{const s=await getDocs(query(collection(db,"activityLog"),orderBy("at","desc"),limit(300)));rows=s.docs.map(d=>({id:d.id,...d.data()}));
  const seen={};rows.forEach(r=>seen[r.uid]=`${r.name} (${r.officeLabel})`);const keep=$("fp").value;
  $("fp").innerHTML='<option value="">সব ব্যক্তি</option>'+Object.entries(seen).map(([u,n])=>`<option value="${esc(u)}">${esc(n)}</option>`).join("");$("fp").value=keep;render()}
 catch(e){$("list").textContent="লোড হয়নি: "+(e.code==="permission-denied"?"firestore.rules-এ activityLog-এর নিয়ম publish করুন":e.message)}}
["fp","fa"].forEach(i=>$(i).onchange=render);$("fs").oninput=render;$("rf").onclick=load;
$("csv").onclick=()=>{const c=[["Time","Name","Office","Action","Summary","DocId"],...rows.map(r=>[when(r),r.name,r.officeLabel,(AC[r.action]||[r.action])[0],r.summary,r.docId])].map(a=>a.map(x=>`"${String(x??"").replace(/"/g,'""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+c],{type:"text/csv"}));a.download="VCAJ-activity-log.csv";a.click()};
$("lb").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value.trim(),$("pw").value)}catch{$("lm").textContent="Login হয়নি"}};
onAuthStateChanged(auth,u=>{const ok=isAdmin(u);$("lg").classList.toggle("hide",ok);$("app").classList.toggle("hide",!ok);if(ok)load()});
