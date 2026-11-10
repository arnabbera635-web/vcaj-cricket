import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,collection,doc,getDocs,writeBatch} from "./firebase.js";
import {OFFICES,newLogId,addLog} from "./vcaj-office.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let rows=[];
const opts=cur=>'<option value="">— কোনো পদ নেই —</option>'+Object.entries(OFFICES).map(([k,v])=>`<option value="${k}"${k===cur?" selected":""}>${v}</option>`).join("");
function render(){
 const q=$("q").value.trim().toLowerCase();
 const have=rows.filter(r=>r.office);
 $("sum").innerHTML=have.length?have.map(r=>`<span class="pill g">${esc(OFFICES[r.office]||r.office)}: ${esc(r.name)}</span>`).join(""):'<span class="muted">এখনও কাউকে পদ দেওয়া হয়নি।</span>';
 const L=rows.filter(r=>!q||[r.name,r.phone,r.memberId].join(" ").toLowerCase().includes(q));
 $("list").innerHTML=L.length?L.map(r=>`<div class="row"><div><b>${esc(r.name||"(নাম নেই)")}</b><br><small class="muted">${esc(r.phone||"")} • ${esc(r.memberId||"")}</small></div><div>${r.mustChangePassword!==false?'<span class="pill w">password বদলায়নি</span>':'<span class="pill g">সক্রিয়</span>'}</div><select data-u="${esc(r.uid)}">${opts(r.office||"")}</select><button data-s="${esc(r.uid)}">💾 সেভ</button></div>`).join(""):'<p class="muted">কোনো সদস্য-অ্যাকাউন্ট পাওয়া যায়নি। আগে member-setup.html থেকে অ্যাকাউন্ট তৈরি করুন।</p>';
 $("list").querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>save(b.dataset.s))}
async function save(uid){
 const r=rows.find(x=>x.uid===uid);if(!r)return;
 const sel=$("list").querySelector(`select[data-u="${CSS.escape(uid)}"]`),off=sel.value;
 if((r.office||"")===off){window.vcToast?.("কোনো বদল নেই");return}
 const lbl=OFFICES[off]||"কোনো পদ নেই";
 if(!confirm(`${r.name} — ${lbl} করবেন?`))return;
 const lid=newLogId(),wb=writeBatch(db),role={name:"Admin",office:"admin",label:"Admin"};
 wb.update(doc(db,"memberAccounts",uid),{office:off,officeUpdatedAtMs:Date.now(),officeUpdatedBy:auth.currentUser.email});
 addLog(wb,role,auth.currentUser,{id:lid,action:"office.assign",col:"memberAccounts",docId:uid,summary:`${r.name}: ${OFFICES[r.office]||"কোনো পদ নেই"} → ${lbl}`,before:{office:r.office||""}});
 try{await wb.commit();r.office=off;render();window.vcToast?.("✅ সেভ হয়েছে")}catch(e){alert("সেভ হয়নি: "+(e.code==="permission-denied"?"firestore.rules-এ নতুন নিয়ম publish করুন":e.message))}}
async function load(){
 try{
  const [a,m]=await Promise.all([getDocs(collection(db,"memberAccounts")),getDocs(collection(db,"members"))]);
  const mm={};m.docs.forEach(d=>mm[d.id]=d.data());
  rows=a.docs.map(d=>{const x=d.data(),p=mm[x.memberId]||{};return{uid:d.id,memberId:x.memberId,phone:x.phone||p.phone||"",name:p.name||"",office:x.office||"",mustChangePassword:x.mustChangePassword}}).sort((x,y)=>(x.name||"").localeCompare(y.name||""));
  render()}catch(e){$("list").textContent="লোড হয়নি: "+e.message}}
$("q").oninput=render;
$("lb").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value.trim(),$("pw").value)}catch{$("lm").textContent="Login হয়নি"}};
onAuthStateChanged(auth,u=>{const ok=isAdmin(u);$("lg").classList.toggle("hide",ok);$("app").classList.toggle("hide",!ok);if(ok)load()});
