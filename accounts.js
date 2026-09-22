import {db,collection,getDocs} from "./firebase.js";
const $=id=>document.getElementById(id);let rows=[];
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money=v=>`₹${Number(v||0).toLocaleString("en-IN")}`;
const val=(o,...keys)=>{for(const k of keys)if(o?.[k]!=null)return Number(o[k])||0;return 0;};
async function load(){
 const snap=await getDocs(collection(db,"teamRegistrations"));
 rows=snap.docs.map(d=>({id:d.id,...d.data()}));
 let expected=0,paid=0,due=0;
 rows.forEach(r=>{
  const e=val(r,"entryFee"),k=val(r,"kasanmani","securityDeposit"),p=val(r,"totalPaid");
  expected+=e+k;paid+=p;due+=val(r,"totalDue")||Math.max(0,e+k-p);
 });
 $("regCount").textContent=rows.length;$("expected").textContent=money(expected);$("paid").textContent=money(paid);$("due").textContent=money(due);
 $("accountsTable").innerHTML=rows.length?`<div class="table-wrap"><table><tr><th>Team</th><th>Status</th><th>Entry Fee</th><th>Kasanmani</th><th>Total Expected</th><th>Paid</th><th>Due</th><th>Verification Code</th></tr>${
 rows.map(r=>{const e=val(r,"entryFee"),k=val(r,"kasanmani","securityDeposit"),p=val(r,"totalPaid"),d=val(r,"totalDue")||Math.max(0,e+k-p);return `<tr><td>${esc(r.teamName||r.name||"")}</td><td>${esc(r.status||"pending")}</td><td>${money(e)}</td><td>${money(k)}</td><td>${money(e+k)}</td><td>${money(p)}</td><td>${money(d)}</td><td>${esc(r.verificationCode||"")}</td></tr>`}).join("")
 }</table></div>`:"<p class='muted'>কোনো registration নেই।</p>";
}
$("refreshAccounts").onclick=load;
$("exportAccounts").onclick=()=>{
 const head=["Team","Status","Entry Fee","Kasanmani","Expected","Paid","Due","Verification Code"];
 const data=rows.map(r=>{const e=val(r,"entryFee"),k=val(r,"kasanmani","securityDeposit"),p=val(r,"totalPaid"),d=val(r,"totalDue")||Math.max(0,e+k-p);return [r.teamName||r.name||"",r.status||"pending",e,k,e+k,p,d,r.verificationCode||""];});
 const csv=[head,...data].map(a=>a.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
 const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");
 a.href=URL.createObjectURL(blob);a.download="VCAJ-accounts.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};
await load();
