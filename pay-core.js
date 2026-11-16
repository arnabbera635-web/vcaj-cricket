/* Pure helpers shared by pay.html and the Dues page. No DOM, no Firebase. */
export const UPI_RE=/^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9]{2,64}$/;
export function parsePay(search){
 const q=new URLSearchParams(search);
 const pa=(q.get("pa")||"").trim(),am=Number(q.get("am")),pn=(q.get("pn")||"VCAJ").trim().slice(0,60)||"VCAJ";
 const n=(q.get("n")||"").trim().slice(0,80),s=(q.get("s")||"").trim().slice(0,8),wa=(q.get("wa")||"").replace(/\D/g,"");
 const errs=[];
 if(!UPI_RE.test(pa))errs.push("UPI ID ঠিক নেই");
 if(!(am>0&&am<=200000))errs.push("টাকার অঙ্ক ঠিক নেই");
 return{ok:!errs.length,errs,pa,am:Math.round(am*100)/100,pn,n,s,wa:wa.length>=10?wa:"",note:`VCAJ membership ${s}${n.replace(/[^\x20-\x7E]/g,"").trim()?" - "+n.replace(/[^\x20-\x7E]/g,"").trim():""}`.trim().slice(0,80)}}
export function upiUri(p){
 return"upi://pay?"+new URLSearchParams({pa:p.pa,pn:p.pn,am:String(p.am),cu:"INR",tn:p.note}).toString().replace(/\+/g,"%20")}
