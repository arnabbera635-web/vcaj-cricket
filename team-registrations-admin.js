import {
  db, collection, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, arrayUnion
} from "./firebase.js";
import {
  getStorage, ref, getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
import { getApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
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

function esc(v){
  return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function money(v){return "₹"+Number(v||0).toLocaleString("en-IN");}
function paymentClass(d){return Number(d?.totalDue||0)>0 ? "due" : "paid";}

async function load(){
  const snap=await getDocs(query(collection(db,"teamRegistrations"),orderBy("submittedAt","desc")));
  all=snap.docs.map(x=>({id:x.id,...x.data()}));
  render();
}
function render(){
  const q=search.value.trim().toLowerCase();
  const sf=statusFilter.value;
  const pf=paidFilter.value;
  const data=all.filter(x=>{
    const hay=[x.uniqueId,x.teamName,x.whatsapp,x.contact,x.email].join(" ").toLowerCase();
    if(q && !hay.includes(q)) return false;
    if(sf && x.status!==sf) return false;
    if(pf==="due" && Number(x.totalDue||0)<=0) return false;
    if(pf==="paid" && Number(x.totalDue||0)>0) return false;
    return true;
  });
  rows.innerHTML=data.map(x=>`
    <tr>
      <td><strong>${esc(x.uniqueId)}</strong><br><small>${esc(x.id)}</small></td>
      <td>${esc(x.teamName)}<br><small>${esc(x.location)}</small></td>
      <td>${esc(x.whatsapp)}<br>${esc(x.contact)}</td>
      <td>${money(x.entryFee?.paid)} / ${money(x.entryFee?.total)}<br>Due ${money(x.entryFee?.due)}</td>
      <td>${money(x.kasanmani?.paid)} / ${money(x.kasanmani?.total)}<br>Due ${money(x.kasanmani?.due)}</td>
      <td><strong>${money(x.totalDue)}</strong></td>
      <td><span class="badge">${esc(x.status)}</span></td>
      <td><button class="btn btn-primary" data-view="${esc(x.id)}">Details</button></td>
    </tr>`).join("") || `<tr><td colspan="8">কোনো registration পাওয়া যায়নি।</td></tr>`;
  rows.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>openDetail(b.dataset.view)));
}

async function openDetail(id){
  const x=all.find(v=>v.id===id); if(!x)return;
  modalTitle.textContent=`${x.uniqueId} — ${x.teamName}`;
  const receipts=(x.receiptFiles||[]).map((f,i)=>`<div class="receipt"><strong>Receipt ${i+1}:</strong> ${esc(f.name)} (${esc(f.type)}) <button class="btn btn-light" data-receipt="${i}">Open</button></div>`).join("") || "<div>Receipt upload করা হয়নি।</div>";
  detail.innerHTML=`
    <div class="detail-grid">
      <div class="detail"><strong>Team</strong>${esc(x.teamName)}</div>
      <div class="detail"><strong>WhatsApp</strong>${esc(x.whatsapp)}</div>
      <div class="detail"><strong>Contact</strong>${esc(x.contact)}</div>
      <div class="detail"><strong>Email</strong>${esc(x.email)}</div>
      <div class="detail"><strong>Location</strong>${esc(x.location)}</div>
      <div class="detail"><strong>Status</strong>
        <select id="editStatus">
          ${["pending","approved","payment-pending","rejected"].map(s=>`<option ${x.status===s?"selected":""} value="${s}">${s}</option>`).join("")}
        </select>
      </div>
      <div class="detail"><strong>Entry Fee</strong>Total ${money(x.entryFee?.total)} | Paid ${money(x.entryFee?.paid)} | Due ${money(x.entryFee?.due)}<br>Method: ${esc(x.entryFee?.paymentMethod)}<br>Date: ${esc(x.entryFee?.paymentDate)}<br>Received by: ${esc(x.entryFee?.receivedBy)}</div>
      <div class="detail"><strong>Kasanmani</strong>Total ${money(x.kasanmani?.total)} | Paid ${money(x.kasanmani?.paid)} | Due ${money(x.kasanmani?.due)}<br>Method: ${esc(x.kasanmani?.paymentMethod)}<br>Date: ${esc(x.kasanmani?.paymentDate)}<br>Received by: ${esc(x.kasanmani?.receivedBy)}</div>
      <div class="detail"><strong>Total</strong>Paid ${money(x.totalPaid)} | Due ${money(x.totalDue)}</div>
      <div class="detail"><strong>Rules / Stay</strong>${esc(x.rulesAccepted)} / Stay: ${esc(x.stayRequired)}</div>
    </div>
    <h3>Receipts</h3>${receipts}
    <h3>Payment History</h3>
    <div id="historyList">${(x.paymentHistory||[]).map((p,i)=>`<div class="receipt"><strong>${esc(p.category)}</strong> — ${money(p.amount)}<br>Date: ${esc(p.date)} | Method: ${esc(p.method)} | Received by: ${esc(p.receivedBy)}</div>`).join("") || "<div>কোনো payment history নেই।</div>"}</div>
    <div class="detail" style="margin-top:10px">
      <strong>নতুন Payment Entry যোগ করুন (Admin)</strong>
      <div class="detail-grid">
        <select id="payCategory"><option>Entry Fee</option><option>Kasanmani</option></select>
        <input id="payAmount" type="number" min="1" placeholder="Amount">
        <select id="payMethod"><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Other</option></select>
        <input id="payDate" type="date">
        <input id="payReceivedBy" placeholder="কার হাতে টাকা এসেছে">
      </div>
      <button class="btn btn-primary" id="addPayment" style="margin-top:8px">Payment Save</button>
    </div>
    <div class="detail"><strong>Notes</strong>${esc(x.notes)}</div>
    <div style="display:flex;gap:8px;margin-top:15px"><button class="btn btn-primary" id="saveStatus">Status Save</button><button class="btn btn-danger" id="deleteReg">Delete</button></div>`;
  modal.classList.add("open");

  document.getElementById("addPayment").onclick=async()=>{
    const category=document.getElementById("payCategory").value;
    const amount=Math.max(0, Math.floor(Number(document.getElementById("payAmount").value)||0));
    const method=document.getElementById("payMethod").value;
    const date=document.getElementById("payDate").value;
    const receivedBy=document.getElementById("payReceivedBy").value.trim();
    if(!amount || !date || !receivedBy){ alert("Amount, Date এবং Received by পূরণ করুন।"); return; }

    const current = category==="Entry Fee" ? (x.entryFee||{}) : (x.kasanmani||{});
    const total = Number(current.total||0);
    const newPaid = Number(current.paid||0) + amount;
    if(newPaid > total){ alert(`${category}-এর মোট নির্ধারিত টাকার বেশি নেওয়া যাবে না।`); return; }

    const updated = {
      paid:newPaid,
      due:total-newPaid
    };
    const changes = category==="Entry Fee"
      ? {entryFee:{...x.entryFee,...updated}}
      : {kasanmani:{...x.kasanmani,...updated}};
    changes.totalPaid = Number((category==="Entry Fee"?newPaid:x.entryFee?.paid)||0)
      + Number((category==="Kasanmani"?newPaid:x.kasanmani?.paid)||0);
    changes.totalDue = Number(changes.entryFee?.due ?? x.entryFee?.due ?? 0)
      + Number(changes.kasanmani?.due ?? x.kasanmani?.due ?? 0);
    changes.paymentHistory=arrayUnion({category,amount,method,date,receivedBy,addedAt:new Date()});
    changes.updatedAt=serverTimestamp();

    await updateDoc(doc(db,"teamRegistrations",id),changes);
    Object.assign(x,changes);
    if(changes.paymentHistory) x.paymentHistory=[...(x.paymentHistory||[]), {category,amount,method,date,receivedBy}];
    if(category==="Entry Fee") x.entryFee=changes.entryFee;
    else x.kasanmani=changes.kasanmani;
    x.totalPaid=changes.totalPaid; x.totalDue=changes.totalDue;
    render(); openDetail(id);
  };

  document.getElementById("saveStatus").onclick=async()=>{
    const s=document.getElementById("editStatus").value;
    await updateDoc(doc(db,"teamRegistrations",id),{status:s,updatedAt:serverTimestamp()});
    x.status=s; render(); modal.classList.remove("open");
  };
  document.getElementById("deleteReg").onclick=async()=>{
    if(!confirm("এই registration delete করবেন?")) return;
    await deleteDoc(doc(db,"teamRegistrations",id));
    all=all.filter(v=>v.id!==id); render(); modal.classList.remove("open");
  };
  detail.querySelectorAll("[data-receipt]").forEach(b=>b.onclick=async()=>{
    const f=x.receiptFiles[Number(b.dataset.receipt)];
    try{
      const storage=getStorage(getApp());
      const url=await getDownloadURL(ref(storage,f.path));
      window.open(url,"_blank","noopener");
    }catch(err){alert("Receipt খোলা যায়নি। Storage Rules/Authentication পরীক্ষা করুন।");}
  });
}

[search,statusFilter,paidFilter].forEach(el=>el.addEventListener("input",render));
closeModal.onclick=()=>modal.classList.remove("open");
modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove("open");});

const auth=getAuth();
onAuthStateChanged(auth,async(user)=>{
  if(!user){authStatus.textContent="Admin login প্রয়োজন।"; return;}
  if((user.email||"").toLowerCase()!=="vcajofficial@gmail.com"){
    authStatus.textContent="এই page শুধু Admin-এর জন্য।";
    return;
  }
  authStatus.textContent=`Logged in: ${user.email}`;
  try{await load();}catch(err){console.error(err);authStatus.textContent="Registration data load করা যায়নি।"; }
});
