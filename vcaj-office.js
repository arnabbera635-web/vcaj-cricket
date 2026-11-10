/* Office-bearer access (president … accountant). The role lives in memberAccounts/{uid}.office, which only Admin can write. */
import {auth,db,isAdmin,doc,getDoc,collection,serverTimestamp,signInWithEmailAndPassword,signOut} from "./firebase.js";
export const OFFICES={president:"সভাপতি",vicePresident:"সহ-সভাপতি",secretary:"সম্পাদক",jointSecretary:"সহ-সম্পাদক",treasurer:"কোষাধ্যক্ষ",assistantTreasurer:"সহ-কোষাধ্যক্ষ",accountant:"হিসাবরক্ষক"};
export const TREASURY=["treasurer","assistantTreasurer","accountant"];
export const EXEC=["president","vicePresident","secretary","jointSecretary"];
export const phoneEmail=p=>"m"+String(p||"").replace(/\D/g,"")+"@member.vcajcricket.com";
export function loginAny(idOrEmail,password){const v=String(idOrEmail||"").trim();return signInWithEmailAndPassword(auth,v.includes("@")?v:phoneEmail(v),password)}
export async function resolveRole(user){
 if(!user)return null;
 if(isAdmin(user))return{kind:"admin",office:"admin",label:"Admin",name:"Admin",uid:user.uid};
 try{
  const a=await getDoc(doc(db,"memberAccounts",user.uid));
  if(!a.exists())return{kind:"none",reason:"noaccount"};
  const d=a.data();
  if(d.mustChangePassword!==false)return{kind:"none",reason:"mustchange"};
  const off=d.office||"";
  const kind=TREASURY.includes(off)?"treasury":EXEC.includes(off)?"exec":"";
  if(!kind)return{kind:"none",reason:"nooffice"};
  let name=d.phone||"";
  try{const m=await getDoc(doc(db,"members",d.memberId));if(m.exists()&&m.data().name)name=m.data().name}catch(e){}
  return{kind,office:off,label:OFFICES[off],name,uid:user.uid}
 }catch(e){return{kind:"none",reason:"error"}}}
export const roleMsg=r=>({noaccount:"এই নম্বরে কোনো সদস্য-অ্যাকাউন্ট নেই।",mustchange:"প্রথমে Member Panel-এ গিয়ে আপনার password বদলান, তারপর আবার ঢুকুন।",nooffice:"আপনাকে এখনও কোনো পদ দেওয়া হয়নি। Admin-এর সঙ্গে যোগাযোগ করুন।",error:"যাচাই করা যায়নি, একটু পরে চেষ্টা করুন।"}[r&&r.reason]||"প্রবেশের অনুমতি নেই।");
export const canWrite=r=>!!r&&(r.kind==="admin"||r.kind==="treasury");
export const canReview=r=>!!r&&(r.kind==="admin"||r.kind==="exec");
export const newLogId=()=>"L"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
export function addLog(batch,role,user,e){
 batch.set(doc(db,"activityLog",e.id),{uid:user.uid,name:role.name||"",office:role.office,officeLabel:role.label,action:e.action,col:e.col,docId:e.docId||"",summary:e.summary||"",before:e.before||null,at:serverTimestamp()})}
export function showRole(role,el){
 if(!el)return;
 el.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border-radius:14px;background:linear-gradient(135deg,#0d2344,#17365f);color:#fff;margin-bottom:14px"><span>👤 <b></b> — <span style="color:#fbbf24;font-weight:800"></span>'+(role.kind==="exec"?' <small>(দেখা ও অনুমোদন)</small>':role.kind==="treasury"?' <small>(রসিদ/ভাউচার তৈরি)</small>':'')+'</span><button type="button" style="background:#fff;color:#0d2344;border:0;border-radius:10px;padding:6px 12px">Logout</button></div>';
 el.querySelector("b").textContent=role.name;el.querySelector("span span").textContent=role.label;
 el.querySelector("button").onclick=()=>signOut(auth).then(()=>location.reload())}
