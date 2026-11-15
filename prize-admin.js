import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,doc,setDoc,deleteDoc} from "./firebase.js";
import {clearCached} from "./vcaj-cache.js";
import {CATS,loadOverrides,merge} from "./prizes-merge.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const bn=s=>String(s).replace(/\d/g,d=>"০১২৩৪৫৬৭৮৯"[d]);
let M={main:[],all:[]},cur=null;
const MAINF=[["label","শিরোনাম"],["amount","টাকার অঙ্ক (সংখ্যা)","number"],["words","কথায় টাকা"],["memorial","স্মৃতি পুরস্কার"],["by","দাতা / সৌজন্যে"],["trophy","ট্রফির নাম"],["trophyBy","ট্রফির দাতা"]];
const SPF=[["no","নম্বর","number"],["title","পুরস্কারের নাম"],["memorial","কার স্মৃতিতে"],["by","সৌজন্যে (দাতা)"],["icon","আইকন (emoji)"],["cat","ধরন","select"]];
function show(kind,item){
 cur={kind,item};$("form").classList.remove("hide");$("ft").textContent=kind==="main"?`${item.label} সম্পাদনা`:item.id?`পুরস্কার নং ${bn(item.no)} সম্পাদনা`:"নতুন পুরস্কার";
 const F=kind==="main"?MAINF:SPF.filter(f=>!(f[0]==="no"&&item.id&&!item.custom));
 $("fields").innerHTML=F.map(([k,l,t])=>t==="select"?`<label>${l}<select data-k="${k}">${Object.entries(CATS).filter(([c])=>c!=="all").map(([c,[n,e]])=>`<option value="${c}"${item.cat===c?" selected":""}>${e} ${esc(n)}</option>`).join("")}</select></label>`:`<label>${l}<input data-k="${k}" type="${t||"text"}" value="${esc(item[k]??"")}"></label>`).join("");
 $("msg").textContent="";window.scrollTo({top:0,behavior:"smooth"})}
function render(){
 $("mainList").innerHTML=M.main.map(m=>`<div class="row"><b>${m.rank===1?"🥇":"🥈"}</b><div><b>${esc(m.label)}</b> — ₹${bn(Number(m.amount).toLocaleString("en-IN"))}${m.edited?'<span class="b e">সম্পাদিত</span>':""}<br><small>${esc(m.memorial)} • সৌজন্যে: ${esc(m.by)}<br>ট্রফি: ${esc(m.trophy)} (${esc(m.trophyBy)})</small></div><div class="acts"><button data-em="${m.rank}">✏️ Edit</button>${m.edited?`<button data-rm="${m.id}">↩️ ছাপা লেখা</button>`:""}</div></div>`).join("");
 $("list").innerHTML=M.all.map(p=>`<div class="row"><b>${bn(p.no)}</b><div>${p.icon||""} <b>${esc(p.title)}</b>${p.edited&&!p.custom?'<span class="b e">সম্পাদিত</span>':""}${p.custom?'<span class="b c">নতুন</span>':""}${p.hidden?'<span class="b h">লুকানো</span>':""}<br><small>${p.memorial?esc(p.memorial)+" • ":""}সৌজন্যে: ${esc(p.by)}</small></div><div class="acts"><button data-e="${esc(p.id)}">✏️ Edit</button><button data-h="${esc(p.id)}">${p.hidden?"👁️ দেখান":"🚫 লুকান"}</button>${p.edited&&!p.custom?`<button data-r="${esc(p.id)}">↩️ ছাপা লেখা</button>`:""}${p.custom?`<button data-d="${esc(p.id)}">🗑️ মুছুন</button>`:""}</div></div>`).join("");
 const on=(sel,fn)=>document.querySelectorAll(sel).forEach(b=>b.onclick=()=>fn(b));
 on("[data-em]",b=>show("main",M.main.find(m=>String(m.rank)===b.dataset.em)));
 on("[data-e]",b=>show("sp",M.all.find(p=>p.id===b.dataset.e)));
 on("[data-h]",b=>toggle(M.all.find(p=>p.id===b.dataset.h)));
 on("[data-rm]",b=>reset(b.dataset.rm));on("[data-r]",b=>reset(b.dataset.r));
 on("[data-d]",b=>{if(confirm("এই নতুন পুরস্কারটা মুছবেন?"))reset(b.dataset.d)})}
async function reload(){clearCached("vc_prizeList");M=merge(await loadOverrides(true));render()}
async function reset(id){try{await deleteDoc(doc(db,"prizeList",id));await reload()}catch(e){alert("হয়নি: "+e.message)}}
async function toggle(p){try{await setDoc(doc(db,"prizeList",p.id),{hidden:!p.hidden,updatedAtMs:Date.now()},{merge:true});await reload()}catch(e){alert("হয়নি: "+e.message)}}
$("add").onclick=()=>show("sp",{no:String(Math.max(0,...M.all.map(p=>Number(p.no)))+1),title:"",memorial:"",by:"",icon:"🏅",cat:"honor",custom:true});
$("cancel").onclick=()=>{$("form").classList.add("hide");cur=null};
$("save").onclick=async()=>{
 if(!cur)return;const d={};document.querySelectorAll("#fields [data-k]").forEach(i=>d[i.dataset.k]=i.type==="number"?Number(i.value):i.value.trim());
 try{
  if(cur.kind==="main"){if(!d.label||!(d.amount>0)){$("msg").textContent="⚠️ শিরোনাম ও টাকা দিন";return}
   await setDoc(doc(db,"prizeList","m"+cur.item.rank),{...d,updatedAtMs:Date.now()},{merge:true})}
  else{if(!d.title){$("msg").textContent="⚠️ পুরস্কারের নাম দিন";return}
   if(cur.item.custom&&!cur.item.id){const id="c"+Date.now().toString(36);await setDoc(doc(db,"prizeList",id),{...d,no:String(d.no),custom:true,updatedAtMs:Date.now()})}
   else{if(d.no!==undefined)d.no=String(d.no);await setDoc(doc(db,"prizeList",cur.item.id),{...d,updatedAtMs:Date.now()},{merge:true})}}
  $("msg").textContent="✅ সেভ হয়েছে";$("form").classList.add("hide");cur=null;await reload()
 }catch(e){$("msg").textContent="❌ "+(e.code==="permission-denied"?"firestore.rules-এ prizeList-এর নিয়ম publish করুন":e.message)}};
$("lb").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value.trim(),$("pw").value)}catch{$("lm").textContent="Login হয়নি"}};
onAuthStateChanged(auth,async u=>{const ok=isAdmin(u);$("lg").classList.toggle("hide",ok);$("app").classList.toggle("hide",!ok);if(ok)await reload()});
