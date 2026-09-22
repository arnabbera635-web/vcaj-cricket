import {db,auth,collection,doc,getDocs,writeBatch,serverTimestamp} from "./firebase.js";
const $=id=>document.getElementById(id);let registrations=[];
const esc=s=>String(s??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money=v=>`₹${Number(v||0).toLocaleString("en-IN")}`;
const pick=(o,...keys)=>{for(const k of keys)if(o?.[k]!==undefined&&o?.[k]!==null)return o[k];return "";};
function dateText(v){if(!v)return "";if(v?.seconds)return new Date(v.seconds*1000).toLocaleString("en-IN");try{return new Date(v).toLocaleString("en-IN");}catch{return String(v);}}
async function load(){
 const snap=await getDocs(collection(db,"teamRegistrations"));
 registrations=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>{
  const av=a.submittedAt?.seconds||a.createdAt?.seconds||a.submittedAt||a.createdAt||0;
  const bv=b.submittedAt?.seconds||b.createdAt?.seconds||b.submittedAt||b.createdAt||0;
  return String(bv).localeCompare(String(av));
 });
 render();
}
function render(){
 const filter=$("statusFilter").value;
 const rows=registrations.filter(x=>!filter||String(x.status||"pending").toLowerCase()===filter);
 $("registrationTable").innerHTML=rows.length?`<div class="table-wrap"><table>
 <tr><th>Team</th><th>WhatsApp</th><th>Contact</th><th>Location</th><th>Submitted</th><th>Status</th><th>Action</th></tr>${rows.map(r=>`
 <tr><td>${esc(pick(r,"teamName","name"))}</td><td>${esc(pick(r,"whatsapp","phone","captainPhone"))}</td><td>${esc(pick(r,"contact"))}</td><td>${esc(pick(r,"location"))}</td><td>${esc(dateText(pick(r,"submittedAt","createdAt")))}</td><td>${esc(r.status||"pending")}</td><td><button data-view="${esc(r.id)}">Details</button> ${r.status!=="verified"?`<button data-verify="${esc(r.id)}">Verify</button>`:""} ${r.status!=="rejected"?`<button data-reject="${esc(r.id)}">Reject</button>`:""}</td></tr>`).join("")}</table></div>`:"<p class='muted'>কোনো registration পাওয়া যায়নি।</p>";
 $("registrationTable").querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>showDetails(b.dataset.view));
 $("registrationTable").querySelectorAll("[data-verify]").forEach(b=>b.onclick=()=>changeStatus(b.dataset.verify,"verified"));
 $("registrationTable").querySelectorAll("[data-reject]").forEach(b=>b.onclick=()=>changeStatus(b.dataset.reject,"rejected"));
}
function showDetails(id){
 const r=registrations.find(x=>x.id===id);if(!r)return;
 const paymentHistory=Array.isArray(r.paymentHistory)?r.paymentHistory:[];
 const entries=Object.entries(r).filter(([k])=>!['paymentHistory'].includes(k));
 $("detailsContent").innerHTML=`<div class="table-wrap"><table>${entries.map(([k,v])=>{
  let out=v;
  if(k==="submittedAt"||k==="createdAt"||k==="verifiedAt")out=dateText(v);
  else if(typeof v==="object"&&v!==null)out=JSON.stringify(v);
  return `<tr><th>${esc(k)}</th><td>${esc(out)}</td></tr>`;
 }).join("")}</table></div>`+
 (paymentHistory.length?`<h3>Payment History</h3><div class="table-wrap"><table><tr><th>Date</th><th>Amount</th><th>Note</th></tr>${paymentHistory.map(x=>`<tr><td>${esc(dateText(x.date||x.createdAt))}</td><td>${money(x.amount)}</td><td>${esc(x.note||"")}</td></tr>`).join("")}</table></div>`:"");
 $("detailsModal").classList.remove("hidden");
}
async function changeStatus(id,status){
 const item=registrations.find(x=>x.id===id);if(!item)return;
 const note=prompt(status==="verified"?"Verification note দিন (optional):":"Reject করার কারণ দিন:");
 if(note===null)return;
 try{
  const batch=writeBatch(db);
  batch.update(doc(db,"teamRegistrations",id),{status,verifiedAt:serverTimestamp(),verifiedBy:auth.currentUser?.email||"",adminNote:note});
  if(item.verificationCode){
   batch.update(doc(db,"receiptVerifications",item.verificationCode),{status,verifiedAt:serverTimestamp(),verifiedBy:auth.currentUser?.email||"",adminNote:note});
  }
  await batch.commit();
  $("registrationMsg").textContent=`Registration ${status} হয়েছে।`;
  await load();
 }catch(e){$("registrationMsg").textContent=`Update হয়নি: ${e.message}`;}
}
$("refreshRegistrations").onclick=load;
$("statusFilter").onchange=render;
$("closeDetails").onclick=()=>$("detailsModal").classList.add("hidden");
await load();
