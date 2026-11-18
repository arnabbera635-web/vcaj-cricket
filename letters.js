import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,collection,doc,getDoc,getDocs,setDoc,query,orderBy,limit} from "./firebase.js";
import {makePad} from "./vcaj-sign.js";
import {STAMP} from "./vcaj-stamp.js";
import {esc,paperHtml,PAPER_CSS,nextRef,fmtDate,DEFAULT_SETTINGS} from "./letters-core.js";
const $=id=>document.getElementById(id);
const SETF=["orgBn","orgEn","tagline","shortName","address","phone","email","regNo","presidentName","secretaryName"];
let S={...DEFAULT_SETTINGS},rows=[],editing=null,old=null;
const today=()=>new Date().toISOString().slice(0,10);
let padSec=null,padPre=null;
function fillSettings(){SETF.forEach(k=>$("s_"+k).value=S[k]||"")}
function readSettings(){const o={};SETF.forEach(k=>o[k]=$("s_"+k).value.trim());return o}
function collect(){
 const dig=$("digSign").checked;
 return{refNo:$("refNo").value.trim(),date:$("ldate").value,to:$("lto").value.trim(),subject:$("lsubject").value.trim(),salutation:$("lsal").value.trim(),body:$("lbody").value,closing:$("lclose").value.trim(),cc:$("lcc").value.trim(),
  signSecretary:$("signSec").checked,signPresident:$("signPre").checked,secretaryName:$("secName").value.trim()||S.secretaryName||"",presidentName:$("preName").value.trim()||S.presidentName||"",
  sigSecretary:dig&&padSec&&!padSec.isEmpty()?padSec.data():"",sigPresident:dig&&padPre&&!padPre.isEmpty()?padPre.data():"",stampDigital:$("stampMode").value==="digital",watermark:$("wmark").checked}}
function preview(){
 $("paper").innerHTML=paperHtml(collect(),S,STAMP);
 const w=$("pw").clientWidth-24,z=Math.min(1,w/794);$("paper").style.zoom=z>0?z:1}
function resetForm(){
 editing=null;old=null;$("ft").textContent="📝 নতুন চিঠি";
 $("refNo").value=nextRef(rows.length);$("ldate").value=today();["lto","lsubject","lbody","lcc"].forEach(i=>$(i).value="");$("lsal").value="মহাশয়/মহাশয়া,";$("lclose").value="ধন্যবাদান্তে,";
 $("signSec").checked=true;$("signPre").checked=true;$("stampMode").value="blank";$("wmark").checked=false;$("digSign").checked=false;$("padBox").classList.add("hide");
 $("secName").value=S.secretaryName||"";$("preName").value=S.presidentName||"";padSec&&padSec.clear();padPre&&padPre.clear();$("lMsg").textContent="";preview()}
function loadLetter(r,asCopy){
 resetForm();if(!asCopy){editing=r.id;old=r;$("ft").textContent="✏️ চিঠি সম্পাদনা — "+r.refNo}
 $("refNo").value=asCopy?nextRef(rows.length):r.refNo||"";$("ldate").value=asCopy?today():r.date||today();
 $("lto").value=r.to||"";$("lsubject").value=r.subject||"";$("lsal").value=r.salutation||"";$("lbody").value=r.body||"";$("lclose").value=r.closing||"";$("lcc").value=r.cc||"";
 $("signSec").checked=!!r.signSecretary;$("signPre").checked=!!r.signPresident;$("secName").value=r.secretaryName||"";$("preName").value=r.presidentName||"";
 $("stampMode").value=r.stampDigital?"digital":"blank";$("wmark").checked=!!r.watermark;
 const dig=!!(r.sigSecretary||r.sigPresident);$("digSign").checked=dig;$("padBox").classList.toggle("hide",!dig);
 if(dig){padSec.load(r.sigSecretary||"");padPre.load(r.sigPresident||"")}
 preview();window.scrollTo({top:0,behavior:"smooth"})}
function renderList(){
 const q=$("lq").value.trim().toLowerCase();
 const L=rows.filter(r=>!q||[r.subject,r.to,r.refNo].join(" ").toLowerCase().includes(q));
 $("list").innerHTML=L.length?L.map(r=>`<div class="row"><div><b>${esc(r.subject||"(বিষয় নেই)")}</b>${r.editCount?` <small>(সম্পাদিত)</small>`:""}<br><small>${esc(r.refNo)} • ${esc(fmtDate(r.date))} • ${esc((r.to||"").split("\n")[0])}</small></div><div class="acts"><button data-e="${esc(r.id)}">✏️ Edit</button><button data-p="${esc(r.id)}">🖨️</button><button data-c="${esc(r.id)}" title="এই চিঠির নকলে নতুন চিঠি">📄 নকল</button></div></div>`).join(""):"<p class='muted'>এখনও কোনো চিঠি সেভ করা হয়নি।</p>";
 const by=id=>rows.find(r=>r.id===id);
 $("list").querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>loadLetter(by(b.dataset.e),false));
 $("list").querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>loadLetter(by(b.dataset.c),true));
 $("list").querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{loadLetter(by(b.dataset.p),false);setTimeout(()=>print(),400)})}
async function loadAll(){
 try{const s=await getDoc(doc(db,"letterSettings","main"));if(s.exists())S={...DEFAULT_SETTINGS,...s.data()}}catch(e){}
 fillSettings();
 try{const q=await getDocs(query(collection(db,"letters"),orderBy("createdAtMs","desc"),limit(100)));rows=q.docs.map(d=>({...d.data(),id:d.id}))}
 catch(e){$("list").innerHTML="<p class='muted'>চিঠির তালিকা লোড হয়নি — firestore.rules-এ letters-এর নিয়ম publish করুন।</p>"}
 renderList();resetForm()}
async function save(){
 const d=collect();
 if(!d.subject&&!d.body.trim()){$("lMsg").textContent="⚠️ বিষয় বা চিঠির লেখা দিন";return false}
 $("saveL").disabled=true;$("lMsg").textContent="সেভ হচ্ছে…";
 try{
  const now=Date.now();let rec;
  if(editing){rec={...old,...d,id:editing,editedAtMs:now,editedBy:auth.currentUser?.email||"",editCount:(old.editCount||0)+1}}
  else{rec={...d,id:"LT"+now.toString(36),createdAtMs:now,createdBy:auth.currentUser?.email||"",editCount:0}}
  await setDoc(doc(db,"letters",rec.id),rec);
  rows=editing?rows.map(r=>r.id===rec.id?rec:r):[rec,...rows];editing=rec.id;old=rec;$("ft").textContent="✏️ চিঠি সম্পাদনা — "+rec.refNo;
  renderList();$("lMsg").textContent="✅ সেভ হয়েছে";return true
 }catch(e){$("lMsg").textContent="❌ "+(e.code==="permission-denied"?"firestore.rules-এ letters-এর নিয়ম publish করুন":e.message);return false}
 finally{$("saveL").disabled=false}}
$("saveL").onclick=save;
$("printL").onclick=async()=>{const ok=await save();if(!ok&&!confirm("চিঠি সেভ হয়নি। তবুও Print করবেন?"))return;preview();setTimeout(()=>print(),250)};
$("newL").onclick=resetForm;
$("saveS").onclick=async()=>{S={...DEFAULT_SETTINGS,...readSettings()};try{await setDoc(doc(db,"letterSettings","main"),S);$("sMsg").textContent="✅ সেটিং সেভ হয়েছে"}catch(e){$("sMsg").textContent="❌ "+(e.code==="permission-denied"?"firestore.rules-এ letterSettings-এর নিয়ম publish করুন":e.message)}
 if(!$("secName").value)$("secName").value=S.secretaryName||"";if(!$("preName").value)$("preName").value=S.presidentName||"";preview()};
$("digSign").onchange=()=>{$("padBox").classList.toggle("hide",!$("digSign").checked);preview()};
$("clrSec").onclick=()=>{padSec.clear();preview()};$("clrPre").onclick=()=>{padPre.clear();preview()};
["refNo","ldate","lto","lsubject","lsal","lbody","lclose","lcc","signSec","signPre","stampMode","wmark","secName","preName"].forEach(i=>{$(i).oninput=preview;$(i).onchange=preview});
["cvSec","cvPre"].forEach(i=>$(i).addEventListener("pointerup",()=>setTimeout(preview,0)));
$("lq").oninput=renderList;
addEventListener("resize",()=>{if(!$("app").classList.contains("hide"))preview()});
$("pcss").textContent=PAPER_CSS;
padSec=makePad($("cvSec"));padPre=makePad($("cvPre"));
$("lb").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value.trim(),$("pw2").value)}catch{$("lm").textContent="Login হয়নি"}};
onAuthStateChanged(auth,async u=>{const ok=isAdmin(u);$("lg").classList.toggle("hide",ok);$("app").classList.toggle("hide",!ok);if(ok)await loadAll()});
