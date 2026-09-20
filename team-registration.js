import { db, collection, doc, serverTimestamp, writeBatch } from "./firebase.js";

const form = document.getElementById("registrationForm");
const btn = document.getElementById("submitBtn");
const status = document.getElementById("status");
const resultBox = document.getElementById("resultBox");
const entryPaidEl = document.getElementById("entryPaid");
const entryDueEl = document.getElementById("entryDue");
const kasanPaidEl = document.getElementById("kasanPaid");
const kasanDueEl = document.getElementById("kasanDue");
const totalDueEl = document.getElementById("totalDue");

const ENTRY_TOTAL = 3501;
const KASAN_TOTAL = 1500;
const MIN_ENTRY_PAYMENT = 500;

function money(v){ return Math.max(0, Math.floor(Number(v) || 0)); }
function esc(v){
  return String(v ?? "").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function updateTotals(){
  const ep = Math.min(ENTRY_TOTAL, money(entryPaidEl.value));
  const kp = Math.min(KASAN_TOTAL, money(kasanPaidEl.value));
  entryPaidEl.value = ep;
  kasanPaidEl.value = kp;
  entryDueEl.value = ENTRY_TOTAL - ep;
  kasanDueEl.value = KASAN_TOTAL - kp;
  totalDueEl.value = (ENTRY_TOTAL - ep) + (KASAN_TOTAL - kp);
}
entryPaidEl.addEventListener("input", updateTotals);
kasanPaidEl.addEventListener("input", updateTotals);
updateTotals();

function randomHex(bytesCount=16){
  const bytes = new Uint8Array(bytesCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();
}
function makeUniqueId(){
  return "VCAJ-2026-" + randomHex(8);
}
function makeVerificationCode(){
  return "RC-" + randomHex(16);
}

function printReceivedCopy(data){
  const win = window.open("", "_blank");
  if(!win){ alert("Popup blocked হয়েছে। Browser-এ popup allow করে আবার Received Copy চাপুন।"); return; }
  const moneyIN = v => "₹" + Number(v||0).toLocaleString("en-IN");
  const submitted = new Date().toLocaleString("en-IN", {dateStyle:"medium", timeStyle:"short"});
  const verifyUrl = `${location.origin}/verify-receipt.html?code=${encodeURIComponent(data.verificationCode)}`;
  win.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8">
  <title>${esc(data.uniqueId)} - Registration Received Copy</title>
  <style>
  body{font-family:Arial,'Noto Sans Bengali',sans-serif;margin:0;background:#f5f7fb;color:#111827}
  .sheet{max-width:780px;margin:24px auto;background:#fff;padding:34px;border:1px solid #dbe2ea}
  h1{margin:0;text-align:center;font-size:25px}.sub{text-align:center;color:#475569;margin:5px 0 20px}
  .id{font-size:20px;font-weight:900;text-align:center;padding:10px;background:#eef2ff;border:1px solid #c7d2fe;margin:18px 0}
  table{width:100%;border-collapse:collapse;margin:12px 0 20px}th,td{border:1px solid #cbd5e1;padding:9px;text-align:left}th{background:#f8fafc}
  .note{font-size:13px;color:#475569;margin-top:22px}.print{display:block;margin:18px auto;padding:11px 20px;border:0;background:#111827;color:#fff;border-radius:8px;font-weight:700}
  @media print{body{background:#fff}.sheet{margin:0;border:0}.print{display:none}}
  </style></head><body><div class="sheet">
  <h1>VIVEKANANDA CRICKET ASSOCIATION OF JELIAKHALI</h1>
  <div class="sub">জেলিয়াখালী “মন্ডল এন্ড মন্ডল” ক্রিকেট টুর্নামেন্ট ২০২৬</div>
  <div class="id">OFFICIAL PAYMENT RECEIPT<br>Registration ID: ${esc(data.uniqueId)}<br><small>Receipt Verification Code: ${esc(data.verificationCode)}</small></div>
  <table><tr><th>Team Name</th><td>${esc(data.teamName)}</td></tr><tr><th>WhatsApp</th><td>${esc(data.whatsapp)}</td></tr><tr><th>Contact</th><td>${esc(data.contact)}</td></tr><tr><th>Email</th><td>${esc(data.email)}</td></tr><tr><th>Location</th><td>${esc(data.location)}</td></tr></table>
  <h3>Payment Details</h3>
  <table><tr><th>Particular</th><th>Total</th><th>Paid</th><th>Due</th></tr>
  <tr><td>Entry Fee</td><td>${moneyIN(data.entryFee.total)}</td><td>${moneyIN(data.entryFee.paid)}</td><td>${moneyIN(data.entryFee.due)}</td></tr>
  <tr><td>Kasanmani</td><td>${moneyIN(data.kasanmani.total)}</td><td>${moneyIN(data.kasanmani.paid)}</td><td>${moneyIN(data.kasanmani.due)}</td></tr>
  <tr><th>Total</th><th>${moneyIN(data.entryFee.total + data.kasanmani.total)}</th><th>${moneyIN(data.totalPaid)}</th><th>${moneyIN(data.totalDue)}</th></tr></table>
  <h3>Payment Information</h3>
  <table><tr><th>Entry Fee</th><td>Method: ${esc(data.entryFee.paymentMethod)}<br>Date: ${esc(data.entryFee.paymentDate)}<br>Received by: ${esc(data.entryFee.receivedBy)}</td></tr>
  <tr><th>Kasanmani</th><td>Method: ${esc(data.kasanmani.paymentMethod)}<br>Date: ${esc(data.kasanmani.paymentDate)}<br>Received by: ${esc(data.kasanmani.receivedBy)}</td></tr></table>
  <p><strong>Status:</strong> ${esc(data.status)}</p><p><strong>Rules Accepted:</strong> ${esc(data.rulesAccepted)} &nbsp; <strong>Stay Required:</strong> ${esc(data.stayRequired)}</p>
  <p class="note"><strong>OFFICIAL PAYMENT RECEIPT</strong><br>এই receipt VCAJ tournament registration system দ্বারা ইস্যু করা payment receipt। Registration ID + Verification Code দিয়ে অফিসিয়াল তথ্য যাচাই করা যাবে। Receipt-এর Team/Payment তথ্য পরিবর্তন করলে verification-এর সঙ্গে মিলবে না।<br><strong>Verification:</strong> ${esc(verifyUrl)}<br>Submitted: ${esc(submitted)}</p>
  <button class="print" onclick="window.print()">Print / Save as PDF</button>
  </div></body></html>`);
  win.document.close();
  setTimeout(()=>win.focus(),300);
}

function showCopyButton(data){
  resultBox.style.display="block";
  resultBox.innerHTML=`<strong>Registration ID: ${esc(data.uniqueId)}</strong><br><span>Received Copy তৈরি হয়েছে।</span><br><button type="button" class="submit-btn" id="printCopyBtn">Received Copy / Save as PDF</button>`;
  document.getElementById("printCopyBtn").onclick=()=>printReceivedCopy(data);
  setTimeout(()=>printReceivedCopy(data),400);
}

form.addEventListener("submit", async e=>{
  e.preventDefault();
  updateTotals();
  const fd = new FormData(form);
  const teamName = String(fd.get("teamName")||"").trim();
  const whatsapp = String(fd.get("whatsapp")||"").trim();
  const location = String(fd.get("location")||"").trim();
  const rulesAccepted = String(fd.get("rulesAccepted")||"");
  const entryPaid = money(fd.get("entryPaid"));
  const kasanPaid = money(fd.get("kasanPaid"));

  if(!teamName || !whatsapp || !location || rulesAccepted !== "হ্যাঁ"){
    status.className="status error";
    status.textContent="দয়া করে Team Name, WhatsApp, Location এবং নিয়মে 'হ্যাঁ' নির্বাচন করুন।";
    return;
  }
  if(entryPaid < MIN_ENTRY_PAYMENT){
    status.className="status error";
    status.textContent=`Entry Fee থেকে অন্তত ₹${MIN_ENTRY_PAYMENT.toLocaleString("en-IN")} payment করা বাধ্যতামূলক।`;
    return;
  }
  if(entryPaid>ENTRY_TOTAL || kasanPaid>KASAN_TOTAL){
    status.className="status error";
    status.textContent="Payment amount নির্ধারিত মোট টাকার বেশি হতে পারবে না।";
    return;
  }

  btn.disabled=true; btn.textContent="Submitting…";
  status.className="status"; status.textContent="Registration সংরক্ষণ হচ্ছে…";

  const uniqueId=makeUniqueId();
  const paymentHistory=[];
  if(entryPaid>0) paymentHistory.push({category:"Entry Fee",amount:entryPaid,method:String(fd.get("entryPaymentMethod")||""),date:String(fd.get("entryPaymentDate")||""),receivedBy:String(fd.get("entryReceivedBy")||"").trim()});
  if(kasanPaid>0) paymentHistory.push({category:"Kasanmani",amount:kasanPaid,method:String(fd.get("kasanPaymentMethod")||""),date:String(fd.get("kasanPaymentDate")||""),receivedBy:String(fd.get("kasanReceivedBy")||"").trim()});

  const verificationCode = makeVerificationCode();
  const data={
    season:"2026",uniqueId,verificationCode,teamName,whatsapp,
    contact:String(fd.get("contact")||"").trim(),email:String(fd.get("email")||"").trim(),location,
    entryFee:{total:ENTRY_TOTAL,paid:entryPaid,due:ENTRY_TOTAL-entryPaid,paymentMethod:String(fd.get("entryPaymentMethod")||""),paymentDate:String(fd.get("entryPaymentDate")||""),receivedBy:String(fd.get("entryReceivedBy")||"").trim()},
    kasanmani:{total:KASAN_TOTAL,paid:kasanPaid,due:KASAN_TOTAL-kasanPaid,paymentMethod:String(fd.get("kasanPaymentMethod")||""),paymentDate:String(fd.get("kasanPaymentDate")||""),receivedBy:String(fd.get("kasanReceivedBy")||"").trim()},
    totalPaid:entryPaid+kasanPaid,totalDue:(ENTRY_TOTAL-entryPaid)+(KASAN_TOTAL-kasanPaid),paymentHistory,
    rulesAccepted,feeAcknowledged:fd.get("feeAcknowledged")==="হ্যাঁ",stayRequired:String(fd.get("stayRequired")||""),notes:String(fd.get("notes")||"").trim(),status:"pending",receiptType:"OFFICIAL_PAYMENT_RECEIPT"
  };

  try{
    const batch=writeBatch(db);
    const regRef=doc(collection(db,"teamRegistrations"));
    const verifyRef=doc(db,"receiptVerifications",verificationCode);
    batch.set(regRef,{...data,submittedAt:serverTimestamp()});
    batch.set(verifyRef,{uniqueId,verificationCode,teamName,entryPaid,entryDue:ENTRY_TOTAL-entryPaid,kasanPaid,kasanDue:KASAN_TOTAL-kasanPaid,totalPaid:entryPaid+kasanPaid,totalDue:(ENTRY_TOTAL-entryPaid)+(KASAN_TOTAL-kasanPaid),status:"pending",season:"2026",receiptType:"OFFICIAL_PAYMENT_RECEIPT"});
    await batch.commit();
    status.className="status success"; status.textContent="Registration সফল হয়েছে।";
    showCopyButton(data);
    form.reset(); updateTotals();
  }catch(err){
    console.error(err);
    status.className="status error";
    status.textContent="Registration জমা দেওয়া যায়নি। Firebase permission পরীক্ষা করুন।";
  }finally{
    btn.disabled=false; btn.textContent="Registration Submit করুন";
  }
});
