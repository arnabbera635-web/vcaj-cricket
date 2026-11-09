import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,collection,doc,getDocs,setDoc,deleteDoc,query,orderBy,limit} from "./firebase.js";
import {getCached,clearCached} from "./vcaj-cache.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const safe=u=>/^https:\/\//i.test(u||"")?u:"";let list=[],adm=false,editId="";
function render(){
 $("out").innerHTML=list.length?list.map(p=>`<figure data-u="${esc(safe(p.url))}" data-c="${esc(p.caption||"")}"><img src="${esc(safe(p.url))}" alt="${esc(p.caption||"VCAJ")}" loading="lazy" decoding="async">${p.caption?`<figcaption>${esc(p.caption)}</figcaption>`:""}${adm?`<button data-e="${esc(p.id)}" style="width:100%;border-radius:0">✏️ সম্পাদনা</button><button data-d="${esc(p.id)}" style="width:100%;border-radius:0">🗑️ মুছুন</button>`:""}</figure>`).join(""):'<p class="muted">ছবি শীঘ্রই যোগ হবে।</p>';
 $("out").querySelectorAll("figure").forEach(f=>f.onclick=e=>{if(e.target.closest("[data-d]"))return;$("bigi").src=f.dataset.u;$("bigc").textContent=f.dataset.c;$("lb2").classList.add("show")});
 $("out").querySelectorAll("[data-d]").forEach(b=>b.onclick=async()=>{if(!confirm("ছবিটা মুছবেন?"))return;await deleteDoc(doc(db,"gallery",b.dataset.d));load(true)});
 $("out").querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>{const x=list.find(y=>y.id===b.dataset.e);if(!x)return;editId=x.id;$("u").value=x.url||"";$("c").value=x.caption||"";document.querySelector("#adm h2").textContent="✏️ ছবি সম্পাদনা";$("add").textContent="💾 পরিবর্তন সেভ করুন";$("adm").scrollIntoView({behavior:"smooth"})})}
$("lb2").onclick=()=>{$("lb2").classList.remove("show");$("bigi").src=""};
async function load(fresh){try{if(fresh)clearCached("vc_gallery");list=await getCached("vc_gallery",()=>getDocs(query(collection(db,"gallery"),orderBy("createdAtMs","desc"),limit(60))).then(s=>s.docs.map(d=>({id:d.id,...d.data()}))),300000);render()}catch(e){$("out").textContent="লোড করা যায়নি।"}}
$("lb").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value,$("pw").value)}catch{alert("Login হয়নি")}};
$("add").onclick=async()=>{const url=$("u").value.trim();if(!safe(url)){$("msg").textContent="⚠️ https:// দিয়ে শুরু হওয়া সরাসরি ছবির লিংক দিন";return}
 try{const id=editId||"PH"+Date.now().toString(36),old=editId?list.find(y=>y.id===editId):null;await setDoc(doc(db,"gallery",id),{url,caption:$("c").value.trim(),createdAtMs:old?.createdAtMs||Date.now(),...(old?{editedAtMs:Date.now()}:{})});const was=!!editId;editId="";$("u").value="";$("c").value="";document.querySelector("#adm h2").textContent="⚙️ ছবি যোগ করুন (Admin)";$("add").textContent="➕ যোগ করুন";$("msg").textContent=was?"✅ পরিবর্তন সেভ হয়েছে":"✅ যোগ হয়েছে";load(true)}catch(e){$("msg").textContent="❌ "+(e.code==="permission-denied"?"firestore.rules-এ gallery-র নিয়ম publish করুন":e.message)}};
onAuthStateChanged(auth,u=>{adm=isAdmin(u);$("adm").classList.toggle("hide",!adm);$("lg").classList.toggle("hide",adm);render()});
load();
