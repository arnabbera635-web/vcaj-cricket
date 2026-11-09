import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,collection,doc,getDocs,setDoc,deleteDoc,query,orderBy,limit} from "./firebase.js";
import {getCached,clearCached} from "./vcaj-cache.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let list=[],adm=false;
const when=ms=>{try{return new Date(ms).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}catch{return""}};
function render(){
 const L=[...list].sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||(b.createdAtMs||0)-(a.createdAtMs||0));
 $("out").innerHTML=L.length?L.map(n=>`<div class="nt ${n.pinned?"pin":""}"><h3>${n.pinned?"📌 ":""}${esc(n.title)}</h3><small>${esc(when(n.createdAtMs))}</small>${n.body?`<p>${esc(n.body)}</p>`:""}${adm?`<p><button data-d="${esc(n.id)}">🗑️ মুছুন</button></p>`:""}</div>`).join(""):'<section class="card"><p class="muted">এখনও কোনো নোটিশ নেই।</p></section>';
 $("out").querySelectorAll("[data-d]").forEach(b=>b.onclick=async()=>{if(!confirm("নোটিশটা মুছবেন?"))return;await deleteDoc(doc(db,"notices",b.dataset.d));clearCached("vc_notices");clearCached("vc_notices_top");load(true)})}
async function load(fresh){try{if(fresh)clearCached("vc_notices");list=await getCached("vc_notices",()=>getDocs(query(collection(db,"notices"),orderBy("createdAtMs","desc"),limit(30))).then(s=>s.docs.map(d=>({id:d.id,...d.data()}))),180000);render()}catch(e){$("out").textContent="লোড করা যায়নি।"}}
$("lb").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value,$("pw").value)}catch{alert("Login হয়নি")}};
$("add").onclick=async()=>{const title=$("t").value.trim();if(!title){$("msg").textContent="⚠️ শিরোনাম দিন";return}
 try{const id="NT"+Date.now().toString(36);await setDoc(doc(db,"notices",id),{title,body:$("b").value.trim(),pinned:$("p").checked,createdAtMs:Date.now()});$("t").value="";$("b").value="";$("p").checked=false;$("msg").textContent="✅ প্রকাশ হয়েছে";clearCached("vc_notices_top");load(true)}catch(e){$("msg").textContent="❌ "+(e.code==="permission-denied"?"firestore.rules-এ notices-এর নিয়ম publish করুন":e.message)}};
onAuthStateChanged(auth,u=>{adm=isAdmin(u);$("adm").classList.toggle("hide",!adm);$("lg").classList.toggle("hide",adm);render()});
load();
