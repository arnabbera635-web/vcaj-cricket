import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,collection,doc,getDocs,writeBatch,query,orderBy,limit} from "./firebase.js";
import {OFFICES,PERMS,preset,newLogId,addLog} from "./vcaj-office.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let rows=[],lastLogin={};
const opts=cur=>'<option value="">— কোনো পদ নেই —</option>'+Object.entries(OFFICES).map(([k,v])=>`<option value="${k}"${k===cur?" selected":""}>${v}</option>`).join("");
const hasAny=r=>r.accessOn===true&&PERMS.some(p=>r[p[0]]===true);
const when=ms=>{try{return new Date(ms).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}catch{return""}};
function render(){
 const q=$("q").value.trim().toLowerCase(),f=$("fl").value;
 const live=rows.filter(hasAny);
 $("sum").innerHTML=live.length?live.map(r=>`<span class="pill g">${esc(r.name)}${r.office?" — "+esc(OFFICES[r.office]):""}</span>`).join(""):'<span class="muted">এখনও কাউকে অ্যাক্সেস দেওয়া হয়নি।</span>';
 const L=rows.filter(r=>(!q||[r.name,r.phone,r.memberId].join(" ").toLowerCase().includes(q))&&(!f||(f==="on"?hasAny(r):!hasAny(r))));
 $("list").innerHTML=L.length?L.map(r=>`<div class="pc ${hasAny(r)?"on":r.accessOn===false&&PERMS.some(p=>r[p[0]]===true)?"sus":""}" data-u="${esc(r.uid)}">
  <h3>${esc(r.name||"(নাম নেই)")}</h3><small class="muted">${esc(r.phone||"")} • ${esc(r.memberId||"")}</small>
  <div style="margin:6px 0">${r.mustChangePassword!==false?'<span class="pill w">password বদলায়নি — এখনও ঢুকতে পারবে না</span>':'<span class="pill g">অ্যাকাউন্ট সক্রিয়</span>'} ${r.accessOn===true?'<span class="pill g">Accounts অ্যাক্সেস চালু</span>':r.accessOn===false?'<span class="pill r">অ্যাক্সেস বন্ধ</span>':'<span class="pill">অ্যাক্সেস দেওয়া হয়নি</span>'} ${lastLogin[r.uid]?`<span class="pill">শেষ লগইন: ${esc(when(lastLogin[r.uid]))}</span>`:""}</div>
  <div class="g"><div><small>পদ (পরিচয়)</small><select class="of">${opts(r.office||"")}</select></div><div style="display:flex;align-items:end"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" class="ao"${r.accessOn===true?" checked":""} style="width:auto"> <b>Accounts অ্যাক্সেস চালু</b></label></div></div>
  <div class="pm">${PERMS.map(p=>`<label><input type="checkbox" data-p="${p[0]}"${r[p[0]]===true?" checked":""}> ${p[1]}</label>`).join("")}</div>
  <div class="pa"><button class="ps">📋 পদ অনুযায়ী প্রস্তাবিত অনুমতি</button><button class="sv">💾 সেভ</button>${r.accessOn===true?'<button class="st">⛔ সাময়িক বন্ধ করুন</button>':""}</div></div>`).join(""):'<p class="muted">কোনো সদস্য পাওয়া যায়নি। আগে member-setup.html থেকে সদস্যদের অ্যাকাউন্ট তৈরি করুন।</p>';
 $("list").querySelectorAll(".pc").forEach(c=>{
  const uid=c.dataset.u;
  c.querySelector(".of").onchange=e=>{if(e.target.value&&confirm("এই পদের প্রস্তাবিত অনুমতি টিক দেওয়া হবে (সেভ না করা পর্যন্ত কিছু বদলাবে না)। দেবেন?"))fillPreset(c,e.target.value)};
  c.querySelector(".ps").onclick=()=>{const o=c.querySelector(".of").value;if(!o){window.vcToast?.("আগে পদ বাছুন");return}fillPreset(c,o)};
  c.querySelector(".sv").onclick=()=>save(uid,c,{});
  const st=c.querySelector(".st");if(st)st.onclick=()=>save(uid,c,{stop:true})})}
function fillPreset(c,office){const p=preset(office);PERMS.forEach(x=>{const el=c.querySelector(`[data-p="${x[0]}"]`);if(el)el.checked=!!p[x[0]]});c.querySelector(".ao").checked=true}
async function save(uid,c,o){
 const r=rows.find(x=>x.uid===uid);if(!r)return;
 const nw={office:c.querySelector(".of").value,accessOn:c.querySelector(".ao").checked};
 PERMS.forEach(p=>nw[p[0]]=c.querySelector(`[data-p="${p[0]}"]`).checked);
 if(o.stop)nw.accessOn=false;
 let note="";if(PERMS.some(p=>p[0]!=="permView"&&nw[p[0]])&&!nw.permView){nw.permView=true;note=" (কোনো কাজের অনুমতি থাকলে 'হিসাব দেখা' নিজে থেকে যোগ হয়)"}
 const label=k=>k==="office"?"পদ":k==="accessOn"?"অ্যাক্সেস":(PERMS.find(p=>p[0]===k)||[])[1]||k;
 const val=(k,v)=>k==="office"?(OFFICES[v]||"নেই"):(v?"হ্যাঁ":"না");
 const keys=["office","accessOn",...PERMS.map(p=>p[0])],ch=keys.filter(k=>(k==="office"?(r.office||""):r[k]===true)!==(k==="office"?nw.office:nw[k]));
 if(!ch.length){window.vcToast?.("কোনো বদল নেই");return}
 const diff=ch.map(k=>`${label(k).replace(/^[^\wঀ-৿]+\s*/,"")}: ${val(k,k==="office"?(r.office||""):r[k]===true)} → ${val(k,nw[k])}`).join("; ");
 if(!confirm(`${r.name}\n\n${diff}${note}\n\nসেভ করবেন?`))return;
 const lid=newLogId(),wb=writeBatch(db),role={name:"Admin",office:"admin",label:"Admin"},before={};keys.forEach(k=>before[k]=k==="office"?(r.office||""):r[k]===true);
 wb.update(doc(db,"memberAccounts",uid),{...nw,permUpdatedAtMs:Date.now(),permUpdatedBy:auth.currentUser.email});
 addLog(wb,role,auth.currentUser,{id:lid,action:"perm.update",col:"memberAccounts",docId:uid,summary:`${r.name}: ${diff}`,before});
 try{await wb.commit();Object.assign(r,nw);render();window.vcToast?.("✅ সেভ হয়েছে")}catch(e){alert("সেভ হয়নি: "+(e.code==="permission-denied"?"firestore.rules-এ নতুন নিয়ম publish করুন":e.message))}}
async function load(){
 try{
  const [a,m]=await Promise.all([getDocs(collection(db,"memberAccounts")),getDocs(collection(db,"members"))]);
  const mm={};m.docs.forEach(d=>mm[d.id]=d.data());
  rows=a.docs.map(d=>{const x=d.data(),p=mm[x.memberId]||{};const o={uid:d.id,memberId:x.memberId,phone:x.phone||p.phone||"",name:p.name||"",office:x.office||"",mustChangePassword:x.mustChangePassword,accessOn:x.accessOn};PERMS.forEach(q=>o[q[0]]=x[q[0]]);return o}).sort((x,y)=>(x.name||"").localeCompare(y.name||""));
  render()}catch(e){$("list").textContent="লোড হয়নি: "+e.message;return}
 try{const s=await getDocs(query(collection(db,"activityLog"),orderBy("at","desc"),limit(300)));lastLogin={};s.docs.forEach(d=>{const x=d.data();if(x.action==="session.login"&&!lastLogin[x.uid]&&x.at)lastLogin[x.uid]=x.at.toMillis()});render()}catch(e){}}
$("q").oninput=render;$("fl").onchange=render;
$("lb").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value.trim(),$("pw").value)}catch{$("lm").textContent="Login হয়নি"}};
onAuthStateChanged(auth,u=>{const ok=isAdmin(u);$("lg").classList.toggle("hide",ok);$("app").classList.toggle("hide",!ok);if(ok)load()});
