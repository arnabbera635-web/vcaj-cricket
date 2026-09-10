import { db, collection, addDoc, serverTimestamp } from "./firebase.js";

const form=document.getElementById("registrationForm");
const btn=document.getElementById("submitBtn");
const status=document.getElementById("status");

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const fd=new FormData(form);
  const teamName=String(fd.get("teamName")||"").trim();
  const whatsapp=String(fd.get("whatsapp")||"").trim();
  const location=String(fd.get("location")||"").trim();
  const rulesAccepted=String(fd.get("rulesAccepted")||"");
  if(!teamName || !whatsapp || !location || !rulesAccepted){
    status.className="status error";
    status.textContent="দয়া করে * চিহ্নিত তথ্যগুলি পূরণ করুন।";
    return;
  }
  if(rulesAccepted!=="হ্যাঁ"){
    status.className="status error";
    status.textContent="নিয়ম ও শর্তাবলী মেনে নেওয়ার জন্য 'হ্যাঁ' নির্বাচন করুন।";
    return;
  }
  btn.disabled=true; btn.textContent="Submitting…";
  status.className="status"; status.textContent="Registration সংরক্ষণ হচ্ছে…";
  try{
    const ref=await addDoc(collection(db,"teamRegistrations"),{
      season:"2026",
      teamName,
      whatsapp,
      contact:String(fd.get("contact")||"").trim(),
      email:String(fd.get("email")||"").trim(),
      location,
      rulesAccepted,
      feeAcknowledged:fd.get("feeAcknowledged")==="হ্যাঁ",
      stayRequired:String(fd.get("stayRequired")||""),
      notes:String(fd.get("notes")||"").trim(),
      status:"pending",
      submittedAt:serverTimestamp()
    });
    status.className="status success";
    status.textContent=`Registration সফল হয়েছে। Application ID: ${ref.id}`;
    form.reset();
  }catch(err){
    console.error(err);
    status.className="status error";
    status.textContent="Registration জমা দেওয়া যায়নি। Internet connection বা Firebase permission পরীক্ষা করুন।";
  }finally{
    btn.disabled=false; btn.textContent="Registration Submit করুন";
  }
});
