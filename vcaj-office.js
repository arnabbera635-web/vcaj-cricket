/* Per-person permissions. Everything below is controlled by Admin only: memberAccounts/{uid}.accessOn / .office / .perm* (members cannot write them). */
import {auth,db,isAdmin,doc,getDoc,writeBatch,serverTimestamp,signInWithEmailAndPassword,signOut} from "./firebase.js";
export const OFFICES={president:"সভাপতি",vicePresident:"সহ-সভাপতি",secretary:"সম্পাদক",jointSecretary:"সহ-সম্পাদক",treasurer:"কোষাধ্যক্ষ",assistantTreasurer:"সহ-কোষাধ্যক্ষ",accountant:"হিসাবরক্ষক"};
export const PERMS=[["permView","👁️ হিসাব দেখা (রসিদ, ভাউচার, মোট হিসাব)","view"],["permReceiptNew","🧾 রসিদ বানানো","receiptNew"],["permReceiptEdit","✏️ রসিদ Edit","receiptEdit"],["permVoucherNew","📑 ভাউচার বানানো","voucherNew"],["permVoucherEdit","✏️ ভাউচার Edit (অনুমোদনের আগে)","voucherEdit"],["permVoucherApprove","✅ ভাউচার অনুমোদন / ফেরত","voucherApprove"]];
export const phoneEmail=p=>"m"+String(p||"").replace(/\D/g,"")+"@member.vcajcricket.com";
export function loginAny(idOrEmail,password){const v=String(idOrEmail||"").trim();return signInWithEmailAndPassword(auth,v.includes("@")?v:phoneEmail(v),password)}
export function preset(office){
 const T=["permView","permReceiptNew","permReceiptEdit","permVoucherNew","permVoucherEdit"],E=["permView","permVoucherApprove"];
 const keys=["treasurer","assistantTreasurer","accountant"].includes(office)?T:["president","vicePresident","secretary","jointSecretary"].includes(office)?E:[];
 const o={};keys.forEach(k=>o[k]=true);return o}
export async function resolveRole(user){
 if(!user)return null;
 if(isAdmin(user)){const perms={};PERMS.forEach(p=>perms[p[2]]=true);return{kind:"admin",office:"admin",label:"Admin",name:"Admin",uid:user.uid,perms}}
 try{
  const a=await getDoc(doc(db,"memberAccounts",user.uid));
  if(!a.exists())return{kind:"none",reason:"noaccount"};
  const d=a.data();
  if(d.mustChangePassword!==false)return{kind:"none",reason:"mustchange"};
  if(d.accessOn===false)return{kind:"none",reason:"suspended"};
  if(d.accessOn!==true)return{kind:"none",reason:"noaccess"};
  const perms={};PERMS.forEach(p=>perms[p[2]]=d[p[0]]===true);
  if(!perms.view)return{kind:"none",reason:"noperm"};
  let name=d.phone||"";
  try{const m=await getDoc(doc(db,"members",d.memberId));if(m.exists()&&m.data().name)name=m.data().name}catch(e){}
  return{kind:"staff",office:d.office||"",label:OFFICES[d.office]||"",name,uid:user.uid,perms}
 }catch(e){return{kind:"none",reason:"error"}}}
export const roleMsg=r=>({noaccount:"এই নম্বরে কোনো সদস্য-অ্যাকাউন্ট নেই।",mustchange:"প্রথমে Member Panel-এ গিয়ে আপনার password বদলান, তারপর আবার ঢুকুন।",suspended:"আপনার Accounts-এর অ্যাক্সেস Admin সাময়িক বন্ধ রেখেছেন।",noaccess:"আপনাকে এখনও Accounts-এর অনুমতি দেওয়া হয়নি। Admin-এর সঙ্গে যোগাযোগ করুন।",noperm:"আপনাকে কোনো কাজের অনুমতি দেওয়া হয়নি। Admin-এর সঙ্গে যোগাযোগ করুন।",error:"যাচাই করা যায়নি, একটু পরে চেষ্টা করুন।"}[r&&r.reason]||"প্রবেশের অনুমতি নেই।");
export const can=(r,p)=>!!r&&(r.kind==="admin"||(r.perms&&r.perms[p]===true));
export const newLogId=()=>"L"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
export function addLog(batch,role,user,e){
 batch.set(doc(db,"activityLog",e.id),{uid:user.uid,name:role.name||"",office:role.office||"",officeLabel:role.label,action:e.action,col:e.col,docId:e.docId||"",summary:e.summary||"",before:e.before||null,at:serverTimestamp()})}
/* one "login" entry per browser session for every non-admin person */
export async function logLogin(role,user){
 try{if(!role||role.kind!=="staff")return;const k="vcLogin:"+user.uid;if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,"1");
  const b=writeBatch(db);addLog(b,role,user,{id:newLogId(),action:"session.login",col:"memberAccounts",docId:user.uid,summary:"লগইন করেছেন • "+(location.pathname.split("/").pop()||"index")});await b.commit()}catch(e){}}
export function showRole(role,el){
 if(!el)return;
 const have=[["view","দেখা"],["receiptNew","রসিদ বানানো"],["receiptEdit","রসিদ Edit"],["voucherNew","ভাউচার বানানো"],["voucherEdit","ভাউচার Edit"],["voucherApprove","অনুমোদন"]].filter(x=>role.perms[x[0]]).map(x=>x[1]).join(" • ");
 el.innerHTML='<div style="padding:10px 14px;border-radius:14px;background:linear-gradient(135deg,#0d2344,#17365f);color:#fff;margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span>👤 <b></b> — <span style="color:#fbbf24;font-weight:800"></span></span><button type="button" style="background:#fff;color:#0d2344;border:0;border-radius:10px;padding:6px 12px">Logout</button></div>'+(role.kind==="admin"?"":'<small style="opacity:.85">আপনার অনুমতি: <span></span></small>')+'</div>';
 el.querySelector("b").textContent=role.name;el.querySelector("div span span").textContent=role.label;
 const sp=el.querySelector("small span");if(sp)sp.textContent=have;
 el.querySelector("button").onclick=()=>signOut(auth).then(()=>location.reload())}


/* extra tracking: page open / export / share / print (one small write each, never blocks the user) */
export function logEvent(role,user,action,col,summary){
 if(!role||!user||role.kind!=="staff")return;
 try{const b=writeBatch(db);addLog(b,role,user,{id:newLogId(),action,col:col||"",docId:"",summary:summary||""});b.commit().catch(()=>{})}catch(e){}}
export function logOnce(role,user,action,col,summary){
 if(!role||!user||role.kind!=="staff")return;const k="vcLog:"+user.uid+":"+action+":"+col;
 try{if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,"1")}catch(e){}
 logEvent(role,user,action,col,summary)}
