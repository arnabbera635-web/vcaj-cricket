import { db, doc, getDoc } from "./firebase.js";
const f=document.getElementById("f"), codeEl=document.getElementById("code"), result=document.getElementById("result");
const params=new URLSearchParams(location.search); if(params.get("code")) codeEl.value=params.get("code");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>"₹"+Number(v||0).toLocaleString("en-IN");
async function verify(code){
  code=String(code||"").trim().toUpperCase();
  if(!/^RC-[A-F0-9]{32}$/.test(code)){result.innerHTML='<div class="bad">Invalid Verification Code.</div>';return;}
  result.textContent="যাচাই হচ্ছে…";
  try{
    const s=await getDoc(doc(db,"receiptVerifications",code));
    if(!s.exists()){result.innerHTML='<div class="bad"><strong>Receipt যাচাই করা যায়নি।</strong><br>এই Verification Code-এর কোনো official record নেই।</div>';return;}
    const x=s.data();
    result.innerHTML=`<div class="ok"><strong>✓ OFFICIAL RECEIPT VERIFIED</strong><br>VCAJ database-এ এই receipt-এর record পাওয়া গেছে।</div>
    <div class="row"><span class="label">Registration ID:</span> ${esc(x.uniqueId)}</div>
    <div class="row"><span class="label">Team:</span> ${esc(x.teamName)}</div>
    <div class="row"><span class="label">Entry Fee Paid:</span> ${money(x.entryPaid)}</div>
    <div class="row"><span class="label">Entry Fee Due:</span> ${money(x.entryDue)}</div>
    <div class="row"><span class="label">Kasanmani Paid:</span> ${money(x.kasanPaid)}</div>
    <div class="row"><span class="label">Total Paid:</span> ${money(x.totalPaid)}</div>
    <div class="row"><span class="label">Status:</span> ${esc(x.status)}</div>`;
  }catch(e){console.error(e);result.innerHTML='<div class="bad">Verification service unavailable. পরে আবার চেষ্টা করুন।</div>';}
}
f.addEventListener("submit",e=>{e.preventDefault();verify(codeEl.value)}); if(params.get("code")) verify(params.get("code"));
