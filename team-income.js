/* Receipt Desk (team) receipts -> income, without counting the same money twice.
   A Receipt Desk receipt has `payer` and no `type`. Rules:
   - trial receipts are never counted
   - a team that also has a registration is NOT counted (its money is already in the registration's totalPaid)
   - Admin can override one receipt with incomeMode = "include" or "exclude" */
const norm=s=>String(s??"").toLowerCase().replace(/\s+/g," ").trim();
const ph=p=>{let d=String(p||"").replace(/\D/g,"");if(d.startsWith("0"))d=d.slice(1);return d.length===10?"91"+d:(d.length===12&&d.startsWith("91")?d:"")};
export const isDeskReceipt=r=>!!(r&&r.payer&&!r.type);
export function registryOf(regs){
 return{names:new Set((regs||[]).map(r=>norm(r.teamName)).filter(Boolean)),phones:new Set((regs||[]).flatMap(r=>[ph(r.whatsapp),ph(r.contact)]).filter(Boolean))}}
export function classify(r,reg){
 if(r.trial)return{counted:false,reason:"trial"};
 const m=r.incomeMode||"auto";
 if(m==="exclude")return{counted:false,reason:"excluded"};
 if(m==="include")return{counted:true,reason:"included"};
 if(reg.names.has(norm(r.payer))||(ph(r.phone)&&reg.phones.has(ph(r.phone))))return{counted:false,reason:"registered"};
 return{counted:true,reason:"unregistered"}}
export function teamReceiptIncome(receipts,regs){
 const reg=registryOf(regs),out={total:0,counted:[],skipped:[]};
 for(const r of receipts||[]){
  if(!isDeskReceipt(r))continue;
  const amt=Number(r.amount||0),c=classify(r,reg);
  if(c.counted){out.counted.push({r,amt,reason:c.reason});out.total+=amt}else out.skipped.push({r,amt,reason:c.reason})}
 return out}
