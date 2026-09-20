import { db, collection, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, arrayUnion } from "./firebase.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const rows=document.getElementById("rows");
const search=document.getElementById("search");
const statusFilter=document.getElementById("statusFilter");
const paidFilter=document.getElementById("paidFilter");
const authStatus=document.getElementById("authStatus");
const modal=document.getElementById("modal");
const detail=document.getElementById("detail");
const modalTitle=document.getElementById("modalTitle");
const closeModal=document.getElementById("closeModal");
let all=[];

function esc(v){return String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function money(v){return "₹"+Number(v||0).toLocaleString("en-IN");}

function printReceivedCopy(x){
  const win=window.open("","_blank");
  if(!win){alert("Popup blocked হয়েছে। Popup allow করুন।");return;}
  const e=esc, m=money;
  win.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${e(x.uniqueId)} - Received Copy</title>
  <style>body{font-family:Arial,'Noto Sans Bengali',sans-serif;margin:0;background:#f5f7fb;color:#111827}.sheet{max-width:780px;margin:24px auto;background:#fff;padding:34px;border:1px solid #dbe2ea}h1{text-align:center;font-size:25px;margin:0}.sub{text-align:center;color:#475569;margin:5px 0 20px}.id{text-align:center;font-weight:900;font-size:20px;padding:10px;background:#eef2ff;margin:18px 0}table{width:100%;border-collapse:collapse;margin:12px 0 20px}th,td{border:1px solid #cbd5e1;padding:9px;text-align:left}th{background:#f8fafc}.print{display:block;margin:18px auto;padding:11px 20px;border:0;background:#111827;color:#fff;border-radius:8px;font-weight:700}@media print{body{background:#fff}.sheet{margin:0;border:0}.print{display:none}}</style></head>
  <body><div class="sheet"><h1>VIVEKANANDA CRICKET ASSOCIATION OF JELIAKHALI</h1><div class="sub">জেলিয়াখালী “মন্ডল এন্ড মন্ডল” ক্রিকেট টুর্নামেন্ট ২০২৬</div><div class="id">Registration ID: ${e(x.uniqueId)}</div>
  <table><tr><th>Team Name</th><td>${e(x.teamName)}</td></tr><tr><th>WhatsApp</th><td>${e(x.whatsapp)}</td></tr><tr><th>Contact</th><td>${e(x.contact)}</td></tr><tr><th>Email</th><td>${e(x.email)}</td></tr><tr><th>Location</th><td>${e(x.location)}</td></tr></table>
  <h3>Payment Details</h3><table><tr><th>Particular</th><th>Total</th><th>Paid</th><th>Due</th></tr><tr><td>Entry Fee</td><td>${m(x.entryFee?.total)}</td><td>${m(x.entryFee?.paid)}</td><td>${m(x.entryFee?.due)}</td></tr><tr><td>Kasanmani</td><td>${m(x.kasanmani?.total)}</td><td>${m(x.kasanmani?.paid)}</td><td>${m(x.kasanmani?.due)}</td></tr><tr><th>Total</th><th>${m(Number(x.entryFee?.total||0)+Number(x.kasanmani?.total||0))}</th><th>${m(x.totalPaid)}</th><th>${m(x.totalDue)}</th></tr></table>
  <p><strong>Status:</strong> ${e(x.status)}</p><p><strong>Rules Accepted:</strong> ${e(x.rulesAccepted)} &nbsp; <strong>Stay Required:</strong> ${e(x.stayRequired)}</p><p><strong>Entry Fee:</strong> ${e(x.entryFee?.paymentMethod)} | ${e(x.entryFee?.paymentDate)} | Received by: ${e(x.entryFee?.receivedBy)}</p><p><strong>Kasanmani:</strong> ${e(x.kasanmani?.paymentMethod)} | ${e(x.kasanmani?.paymentDate)} | Received by: ${e(x.kasanmani?.receivedBy)}</p><p style="color:#475569;font-size:13px">এটি Team Registration acknowledgement/received copy। এটি payment-এর মূল receipt নয়।</p><button class="print" onclick="window.print()">Print / Save as PDF</button></div></body></html>`);
  win.document.close();setTimeout(()=>win.focus(),300);
}

async function load(){
  const snap=await getDocs(query(collection(db,"teamRegistrations"),orderBy("submittedAt","desc")));
  all=snap.docs.map(x=>({id:x.id,...x.data()}));render();
}
function render(){
  const q=search.value.trim().toLowerCase(), sf=statusFilter.value, pf=paidFilter.value;
  const data=all.filter(x=>{
    const hay=[x.uniqueId,x.teamName,x.whatsapp,x.contact,x.email].join(" ").toLowerCase();
    if(q&&!hay.includes(q))return false;if(sf&&x.status!==sf)return false;
    if(pf==="due"&&Number(x.totalDue||0)<=0)return false;if(pf==="paid"&&Number(x.totalDue||0)>0)return false;return true;
  });
  rows.innerHTML=data.map(x=>`<tr><td><strong>${esc(x.uniqueId)}</strong><br><small>${esc(x.id)}</small></td><td>${esc(x.teamName)}<br><small>${esc(x.location)}</small></td><td>${esc(x.whatsapp)}<br>${esc(x.contact)}</td><td>${money(x.entryFee?.paid)} / ${money(x.entryFee?.total)}<br>Due ${money(x.entryFee?.due)}</td><td>${money(x.kasanmani?.paid)} / ${money(x.kasanmani?.total)}<br>Due ${money(x.kasanmani?.due)}</td><td><strong>${money(x.totalDue)}</strong></td><td><span class="badge">${esc(x.status)}</span></td><td><button class="btn btn-primary" data-view="${esc(x.id)}">Details</button></td></tr>`).join("")||`<tr><td colspan="8">কোনো registration পাওয়া যায়নি।</td></tr>`;
  rows.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>openDetail(b.dataset.view));
}

function openDetail(id){
  const x=all.find(v=>v.id===id);if(!x)return;
  modalTitle.textContent=`${x.uniqueId} — ${x.teamName}`;
  detail.innerHTML=`<div class="detail-grid">
    <div class="detail"><strong>Team</strong>${esc(x.teamName)}</div><div class="detail"><strong>WhatsApp</strong>${esc(x.whatsapp)}</div>
    <div class="detail"><strong>Contact</strong>${esc(x.contact)}</div><div class="detail"><strong>Email</strong>${esc(x.email)}</div>
    <div class="detail"><strong>Location</strong>${esc(x.location)}</div><div class="detail"><strong>Status</strong><select id="editStatus">${["pending","approved","payment-pending","rejected"].map(s=>`<option ${x.status===s?"selected":""} value="${s}">${s}</option>`).join("")}</select></div>
    <div class="detail"><strong>Entry Fee</strong>Total ${money(x.entryFee?.total)} | Paid ${money(x.entryFee?.paid)} | Due ${money(x.entryFee?.due)}<br>Method: ${esc(x.entryFee?.paymentMethod)}<br>Date: ${esc(x.entryFee?.paymentDate)}<br>Received by: ${esc(x.entryFee?.receivedBy)}</div>
    <div class="detail"><strong>Kasanmani</strong>Total ${money(x.kasanmani?.total)} | Paid ${money(x.kasanmani?.paid)} | Due ${money(x.kasanmani?.due)}<br>Method: ${esc(x.kasanmani?.paymentMethod)}<br>Date: ${esc(x.kasanmani?.paymentDate)}<br>Received by: ${esc(x.kasanmani?.receivedBy)}</div>
    <div class="detail"><strong>Total</strong>Paid ${money(x.totalPaid)} | Due ${money(x.totalDue)}</div><div class="detail"><strong>Rules / Stay</strong>${esc(x.rulesAccepted)} / Stay: ${esc(x.stayRequired)}</div>
  </div>
  <h3>Received Copy</h3><div class="receipt">Website-এ কোনো receipt file upload হয় না।</div><button class="btn btn-light" id="printCopyAdmin">Print / Save as PDF</button>
  <h3>Payment History</h3><div id="historyList">${(x.paymentHistory||[]).map(p=>`<div class="receipt"><strong>${esc(p.category)}</strong> — ${money(p.amount)}<br>Date: ${esc(p.date)} | Method: ${esc(p.method)} | Received by: ${esc(p.receivedBy)}</div>`).join("")||"<div>কোনো payment history নেই।</div>"}</div>
  <div class="detail" style="margin-top:10px"><strong>নতুন Payment Entry যোগ করুন (Admin)</strong><div class="detail-grid"><select id="payCategory"><option>Entry Fee</option><option>Kasanmani</option></select><input id="payAmount" type="number" min="1" placeholder="Amount"><select id="payMethod"><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Other</option></select><input id="payDate" type="date"><input id="payReceivedBy" placeholder="কার হাতে টাকা এসেছে"></div><button class="btn btn-primary" id="addPayment" style="margin-top:8px">Payment Save</button></div>
  <div class="detail"><strong>Notes</strong>${esc(x.notes)}</div><div style="display:flex;gap:8px;margin-top:15px"><button class="btn btn-primary" id="saveStatus">Status Save</button><button class="btn btn-danger" id="deleteReg">Delete</button></div>`;
  modal.classList.add("open");

  document.getElementById("printCopyAdmin").onclick=()=>printReceivedCopy(x);
  document.getElementById("addPayment").onclick=async()=>{
    const category=document.getElementById("payCategory").value, amount=Math.max(0,Math.floor(Number(document.getElementById("payAmount").value)||0)), method=document.getElementById("payMethod").value, date=document.getElementById("payDate").value, receivedBy=document.getElementById("payReceivedBy").value.trim();
    if(!amount||!date||!receivedBy){alert("Amount, Date এবং Received by পূরণ করুন।");return;}
    const current=category==="Entry Fee"?(x.entryFee||{}):(x.kasanmani||{}), total=Number(current.total||0), newPaid=Number(current.paid||0)+amount;
    if(newPaid>total){alert(`${category}-এর মোট নির্ধারিত টাকার বেশি নেওয়া যাবে না।`);return;}
    const changes=category==="Entry Fee"?{entryFee:{...x.entryFee,paid:newPaid,due:total-newPaid}}:{kasanmani:{...x.kasanmani,paid:newPaid,due:total-newPaid}};
    const entryPaid=category==="Entry Fee"?newPaid:Number(x.entryFee?.paid||0), kasanPaid=category==="Kasanmani"?newPaid:Number(x.kasanmani?.paid||0);
    changes.totalPaid=entryPaid+kasanPaid;changes.totalDue=Number(x.entryFee?.total||3501)-entryPaid+Number(x.kasanmani?.total||1500)-kasanPaid;
    changes.paymentHistory=arrayUnion({category,amount,method,date,receivedBy});changes.updatedAt=serverTimestamp();
    await updateDoc(doc(db,"teamRegistrations",id),changes);Object.assign(x,changes);x.paymentHistory=[...(x.paymentHistory||[]),{category,amount,method,date,receivedBy}];if(changes.entryFee)x.entryFee=changes.entryFee;if(changes.kasanmani)x.kasanmani=changes.kasanmani;render();openDetail(id);
  };
  document.getElementById("saveStatus").onclick=async()=>{const s=document.getElementById("editStatus").value;await updateDoc(doc(db,"teamRegistrations",id),{status:s,updatedAt:serverTimestamp()});x.status=s;render();modal.classList.remove("open");};
  document.getElementById("deleteReg").onclick=async()=>{if(!confirm("এই registration delete করবেন?"))return;await deleteDoc(doc(db,"teamRegistrations",id));all=all.filter(v=>v.id!==id);render();modal.classList.remove("open");};
}

[search,statusFilter,paidFilter].forEach(el=>el.addEventListener("input",render));
closeModal.onclick=()=>modal.classList.remove("open");modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove("open")});

const auth=getAuth();
onAuthStateChanged(auth,async user=>{
  if(!user){authStatus.textContent="Admin login প্রয়োজন।";return;}
  if((user.email||"").toLowerCase()!=="vcajofficial@gmail.com"){authStatus.textContent="এই page শুধু Admin-এর জন্য।";return;}
  authStatus.textContent=`Logged in: ${user.email}`;
  try{await load()}catch(err){console.error(err);authStatus.textContent="Registration data load করা যায়নি।";}
});
