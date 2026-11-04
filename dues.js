import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,collection,getDocs} from "./firebase.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money=v=>"₹"+Number(v||0).toLocaleString("en-IN"),fee=m=>parseInt(String(m.fee||"").replace(/[^\d]/g,""),10)||0;
let M=[];
const p91=p=>{let d=String(p||"").replace(/\D/g,"");if(d.startsWith("0"))d=d.slice(1);return d.length===10?"91"+d:(d.length>=11?d:"")};
const msg=m=>`🏏 VCAJ — চাঁদা অনুস্মারক\n\nপ্রিয় ${m.name},\nআপনার ${m.season||2026} সালের সদস্য চাঁদা ${fee(m)?money(fee(m)):""} ${m.feeStatus==="আংশিক"?"আংশিক বাকি আছে":"বাকি আছে"}।\nঅনুগ্রহ করে সুবিধামতো পরিশোধ করে দিন।\n\nধন্যবাদ 🙏\nVivekananda Cricket Association of Jeliakhali`;
function render(){const f=$("fs").value,q=$("q").value.trim().toLowerCase();
 const all=M,due=M.filter(m=>m.feeStatus!=="পরিশোধিত");
 const list=M.filter(m=>(f==="all"||(f==="due"?m.feeStatus!=="পরিশোধিত":m.feeStatus===f))&&(!q||(m.name||"").toLowerCase().includes(q)));
 const tot=due.reduce((a,m)=>a+fee(m),0);
 $("tiles").innerHTML=`<div class="tile"><b>${all.length}</b><span>মোট সদস্য</span></div><div class="tile"><b>${all.length-due.length}</b><span>পরিশোধিত</span></div><div class="tile"><b>${due.length}</b><span>বাকি/আংশিক</span></div><div class="tile"><b>${money(tot)}</b><span>সর্বোচ্চ বকেয়া</span></div>`;
 $("list").innerHTML=list.length?`<div class="table-wrap"><table><tr><th>নাম</th><th>চাঁদা</th><th>অবস্থা</th><th></th></tr>${list.map(m=>`<tr><td>${esc(m.name)}<br><small class="muted">${esc(m.phone||"নম্বর নেই")}</small></td><td>${fee(m)?money(fee(m)):"—"}</td><td>${esc(m.feeStatus||"বাকি")}</td><td>${m.feeStatus!=="পরিশোধিত"&&p91(m.phone)?`<a href="https://wa.me/${p91(m.phone)}?text=${encodeURIComponent(msg(m))}" target="_blank" rel="noopener"><button class="wa">📲 তাগাদা</button></a> `:""}<a href="receipts.html?member=${encodeURIComponent(m.id)}"><button>🧾 Receipt</button></a></td></tr>`).join("")}</table></div>`:"<p class='muted'>কেউ নেই 🎉</p>";window._L=list}
$("fs").onchange=render;$("q").oninput=render;$("printBtn").onclick=()=>print();
$("csvBtn").onclick=()=>{const c=[["নাম","ফোন","চাঁদা","অবস্থা"],...(window._L||[]).map(m=>[m.name,m.phone,fee(m),m.feeStatus])].map(a=>a.map(x=>`"${String(x??"").replace(/"/g,'""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+c],{type:"text/csv"}));a.download="VCAJ-dues.csv";a.click()};
$("loginBtn").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value,$("pw").value)}catch(e){$("loginMsg").textContent="Login হয়নি: "+e.message}};
onAuthStateChanged(auth,async u=>{const ok=isAdmin(u);$("loginBox").classList.toggle("hide",ok);$("app").classList.toggle("hide",!ok);if(ok){try{const s=await getDocs(collection(db,"members"));M=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));render()}catch{$("list").textContent="লোড হয়নি"}}});
