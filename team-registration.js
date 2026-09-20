import {
  db, collection, addDoc, updateDoc, doc, serverTimestamp
} from "./firebase.js";
import {
  getStorage, ref, uploadBytes
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
import { getApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

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
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg","image/png","image/webp","application/pdf"]);

function money(v){ return Math.max(0, Math.floor(Number(v) || 0)); }
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

function makeUniqueId(){
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return "VCAJ-2026-" + Array.from(bytes, b => b.toString(16).padStart(2,"0")).join("").toUpperCase();
}
function cleanFileName(name){
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  updateTotals();
  const fd = new FormData(form);
  const teamName = String(fd.get("teamName") || "").trim();
  const whatsapp = String(fd.get("whatsapp") || "").trim();
  const location = String(fd.get("location") || "").trim();
  const rulesAccepted = String(fd.get("rulesAccepted") || "");
  const entryPaid = money(fd.get("entryPaid"));
  const kasanPaid = money(fd.get("kasanPaid"));
  const files = Array.from(form.querySelectorAll('input[name="receipts"]')).map(x=>x.files[0]).filter(Boolean);

  if(!teamName || !whatsapp || !location || rulesAccepted !== "হ্যাঁ"){
    status.className="status error";
    status.textContent="দয়া করে Team Name, WhatsApp, Location এবং নিয়মে 'হ্যাঁ' নির্বাচন করুন।";
    return;
  }
  if(entryPaid > ENTRY_TOTAL || kasanPaid > KASAN_TOTAL){
    status.className="status error";
    status.textContent="Payment amount নির্ধারিত মোট টাকার বেশি হতে পারবে না।";
    return;
  }
  if(files.length > 3){
    status.className="status error";
    status.textContent="সর্বোচ্চ 3টি receipt upload করা যাবে।";
    return;
  }
  for(const file of files){
    if(!ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE){
      status.className="status error";
      status.textContent="Receipt শুধু JPG/PNG/WebP/PDF এবং সর্বোচ্চ 5 MB হতে হবে।";
      return;
    }
  }

  btn.disabled=true;
  btn.textContent="Submitting…";
  status.className="status";
  status.textContent="Registration সংরক্ষণ হচ্ছে…";

  const uniqueId = makeUniqueId();
  const submissionToken = Array.from(crypto.getRandomValues(new Uint8Array(24)), b=>b.toString(16).padStart(2,"0")).join("");
  const paymentHistory = [];
  if(entryPaid > 0) paymentHistory.push({
    category:"Entry Fee", amount:entryPaid,
    method:String(fd.get("entryPaymentMethod")||""),
    date:String(fd.get("entryPaymentDate")||""),
    receivedBy:String(fd.get("entryReceivedBy")||"").trim()
  });
  if(kasanPaid > 0) paymentHistory.push({
    category:"Kasanmani", amount:kasanPaid,
    method:String(fd.get("kasanPaymentMethod")||""),
    date:String(fd.get("kasanPaymentDate")||""),
    receivedBy:String(fd.get("kasanReceivedBy")||"").trim()
  });

  try{
    const registration = await addDoc(collection(db,"teamRegistrations"),{
      season:"2026",
      uniqueId,
      submissionToken,
      teamName,
      whatsapp,
      contact:String(fd.get("contact")||"").trim(),
      email:String(fd.get("email")||"").trim(),
      location,
      entryFee:{ total:ENTRY_TOTAL, paid:entryPaid, due:ENTRY_TOTAL-entryPaid,
        paymentMethod:String(fd.get("entryPaymentMethod")||""),
        paymentDate:String(fd.get("entryPaymentDate")||""),
        receivedBy:String(fd.get("entryReceivedBy")||"").trim()
      },
      kasanmani:{ total:KASAN_TOTAL, paid:kasanPaid, due:KASAN_TOTAL-kasanPaid,
        paymentMethod:String(fd.get("kasanPaymentMethod")||""),
        paymentDate:String(fd.get("kasanPaymentDate")||""),
        receivedBy:String(fd.get("kasanReceivedBy")||"").trim()
      },
      totalAmount:ENTRY_TOTAL+KASAN_TOTAL,
      totalPaid:entryPaid+kasanPaid,
      totalDue:(ENTRY_TOTAL-entryPaid)+(KASAN_TOTAL-kasanPaid),
      receiptFiles:[],
      paymentHistory,
      rulesAccepted,
      feeAcknowledged:fd.get("feeAcknowledged")==="হ্যাঁ",
      stayRequired:String(fd.get("stayRequired")||""),
      notes:String(fd.get("notes")||"").trim(),
      status:"pending",
      submittedAt:serverTimestamp()
    });

    // Uses the already-initialized Firebase app. If firebase.js uses a different
    // Firebase SDK major version, align the CDN version above with that version.
    const storage = getStorage(getApp());
    const uploaded = [];
    for(let i=0;i<files.length;i++){
      const file = files[i];
      const path = `teamReceipts/2026/${uniqueId}/${Date.now()}_${i}_${cleanFileName(file.name)}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, {contentType:file.type, customMetadata:{uniqueId, originalName:file.name}});
      uploaded.push({path, name:file.name, type:file.type, size:file.size});
    }

    // Public users may update only their own submission's receiptFiles using the
    // one-time random submissionToken; Firestore rules enforce this.
    if(uploaded.length){
      await updateDoc(doc(db,"teamRegistrations",registration.id),{
        receiptFiles:uploaded,
        updatedAt:serverTimestamp()
      });
    }

    status.className="status success";
    status.textContent="Registration সফল হয়েছে।";
    resultBox.style.display="block";
    resultBox.innerHTML = `<strong>Registration ID:</strong> ${uniqueId}<br>
      <span>এই ID-টি screenshot/নোট করে রাখুন। Admin এই ID দিয়ে আপনার registration খুঁজে পাবে।</span>`;
    form.reset();
    updateTotals();
  }catch(err){
    console.error(err);
    status.className="status error";
    status.textContent="Registration জমা দেওয়া যায়নি। Firebase permission/Storage setup পরীক্ষা করুন।";
  }finally{
    btn.disabled=false;
    btn.textContent="Registration Submit করুন";
  }
});
