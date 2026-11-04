import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,collection,getDocs} from "./firebase.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const q=new URLSearchParams(location.search),one=q.get("id"),all=q.get("all");
const no=m=>"VCAJ-"+String(m.id||"").replace(/\D/g,"").slice(-5).padStart(5,"0");
const card=m=>`<div class="idc"><div class="h"><b>VCAJ</b> • VIVEKANANDA CRICKET ASSOCIATION OF JELIAKHALI</div><div class="b"><div class="n">${esc(m.name)}</div><div class="r">${esc(m.role||"সদস্য")}</div><div class="m">${m.teamName?"দল: "+esc(m.teamName)+"<br>":""}${m.phone?"📞 "+esc(m.phone):""}</div></div><div class="f"><span>ID: ${no(m)}</span><span>Season ${esc(m.season||2026)}</span></div></div>`;
$("printBtn").onclick=()=>print();
$("loginBtn").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value,$("pw").value)}catch(e){$("loginMsg").textContent="Login হয়নি: "+e.message}};
onAuthStateChanged(auth,async u=>{const ok=isAdmin(u);$("loginBox").classList.toggle("hide",ok);$("app").classList.toggle("hide",!ok);if(!ok)return;
 try{const s=await getDocs(collection(db,"members"));let M=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));if(one&&!all)M=M.filter(m=>m.id===one);$("cards").innerHTML=M.length?M.map(card).join(""):"কোনো সদস্য পাওয়া যায়নি"}catch{$("cards").textContent="লোড হয়নি"}});
