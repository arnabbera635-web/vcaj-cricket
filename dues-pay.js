/* Reminder message + payment-request link builder for the Dues page (pure functions, testable). */
import {UPI_RE} from "./pay-core.js";
export const fee=m=>parseInt(String(m.fee||"").replace(/[^\d]/g,""),10)||0;
export const money=v=>"₹"+Number(v||0).toLocaleString("en-IN");
export const p91=p=>{let d=String(p||"").replace(/\D/g,"");if(d.startsWith("0"))d=d.slice(1);return d.length===10?"91"+d:(d.length>=11?d:"")};
export const cfgOk=P=>!!P&&UPI_RE.test(String(P.upi||"").trim());
/* link to pay.html carrying exactly the member's ধার্য চাঁদা */
export function payLink(m,P,base){
 const a=fee(m);if(!a||!cfgOk(P))return"";
 const u=new URL("pay.html",base);
 u.searchParams.set("pa",P.upi.trim());u.searchParams.set("pn",(P.payee||"VCAJ").trim());u.searchParams.set("am",String(a));
 u.searchParams.set("n",m.name||"");u.searchParams.set("s",String(m.season||2026));
 const wa=String(P.wa||"").replace(/\D/g,"");if(wa.length>=10)u.searchParams.set("wa",wa.length===10?"91"+wa:wa);
 return u.toString()}
export function buildMsg(m,P,linkOn,base){
 const a=fee(m),part=m.feeStatus==="আংশিক";
 const L=[`🏏 মন্ডল এন্ড মন্ডল ক্রিকেট টুর্নামেন্ট — চাঁদা অনুস্মারক`,``,`প্রিয় ${m.name},`,
  a?`আপনার ${m.season||2026} সালের সদস্য চাঁদা ${money(a)} ${part?"আংশিক বাকি আছে":"ধার্য করা হয়েছে"}।`:`আপনার ${m.season||2026} সালের সদস্য চাঁদা ${part?"আংশিক বাকি আছে":" ধার্য করা হয়েছে"}।`];
 const link=linkOn?payLink(m,P,base):"";
 if(link){L.push(``,`💳 পেমেন্ট রিকোয়েস্ট: ${money(a)}`,`👉 এখানে চেপে UPI অ্যাপ দিয়ে পরিশোধ করুন:`,link,``,`অথবা সরাসরি UPI ID-তে পাঠান: ${P.upi.trim()}`,`পরিশোধের পর ক্লাব থেকে Receipt পাবেন।`)}
 else L.push;
 L.push(``,`ধন্যবাদন্তে 🙏`,`Vivekananda Cricket Association of Jeliakhali`);
 return L.join("\n")}
