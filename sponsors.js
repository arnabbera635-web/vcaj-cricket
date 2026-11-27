import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,collection,doc,onSnapshot,setDoc,deleteDoc} from "./firebase.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const order=["Title Sponsor","Gold Sponsor","Silver Sponsor","Supporter"];let list=[],adm=false;
const safeUrl=u=>/^https?:\/\//i.test(u||"")?u:"";
function render(){
 if(!list.length){$("out").innerHTML='<section class="card"><p class="muted">Sponsor-দের নাম শীঘ্রই যোগ হবে। Sponsor হতে চাইলে ক্লাবের সঙ্গে যোগাযোগ করুন।</p></section>';return}
 $("out").innerHTML=order.map(t=>{const x=list.filter(s=>s.tier===t);if(!x.length)return"";
  return`<h2 class="tier">${t==="Title Sponsor"?"🏆":t==="Gold Sponsor"?"🥇":t==="Silver Sponsor"?"🥈":"💛"} ${t}</h2><div class="sp">${x.map(s=>{const l=safeUrl(s.logo),w=safeUrl(s.link);const body=`${l?`<img src="${esc(l)}" alt="${esc(s.name)}" loading="lazy" onerror="this.outerHTML='<div class=ini>${esc((s.name||"?")[0])}</div>'">`:`<div class="ini">${esc((s.name||"?")[0])}</div>`}<h3>${esc(s.name)}</h3>${s.note?`<small>${esc(s.note)}</small>`:""}`;
   return`<div class="sc ${t==="Title Sponsor"?"title":""}">${w?`<a href="${esc(w)}" target="_blank" rel="noopener">${body}</a>`:body}${adm?`<br><button data-d="${esc(s.id)}" style="margin-top:8px">🗑️ মুছুন</button>`:""}</div>`}).join("")}</div>`}).join("");
 $("out").querySelectorAll("[data-d]").forEach(b=>b.onclick=async()=>{if(confirm("এই Sponsor মুছবেন?"))await deleteDoc(doc(db,"sponsors",b.dataset.d))})}
onSnapshot(collection(db,"sponsors"),s=>{list=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.createdAtMs||0)-(b.createdAtMs||0));render()},()=>{$("out").textContent="লোড করা যায়নি।"});
$("lb").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value,$("pw").value)}catch(e){alert("Login হয়নি")}};
$("add").onclick=async()=>{const name=$("n").value.trim();if(!name){$("msg").textContent="⚠️ নাম দিন";return}
 try{const id="SP"+Date.now().toString(36);await setDoc(doc(db,"sponsors",id),{name,tier:$("t").value,logo:$("l").value.trim(),link:$("u").value.trim(),note:$("m").value.trim(),createdAtMs:Date.now()});["n","l","u","m"].forEach(i=>$(i).value="");$("msg").textContent="✅ যোগ হয়েছে"}catch(e){$("msg").textContent="❌ "+(e.code==="permission-denied"?"firestore.rules-এ sponsors-এর নিয়ম publish করুন":e.message)}};
onAuthStateChanged(auth,u=>{adm=isAdmin(u);$("adm").classList.toggle("hide",!adm);$("lg").classList.toggle("hide",adm);render()});
