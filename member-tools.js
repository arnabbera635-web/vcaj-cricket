import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,collection,getDocs} from "./firebase.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money=v=>"₹"+Number(v||0).toLocaleString("en-IN"),num=v=>parseInt(String(v||"").replace(/[^\d]/g,""),10)||0;
let M=[];
const p91=p=>{let d=String(p||"").replace(/\D/g,"");if(d.startsWith("0"))d=d.slice(1);if(d.length===10)d="91"+d;return d.length>=11?d:""};
function qr(el,text,size){el.innerHTML="";if(window.QRCode&&text)new QRCode(el,{text,width:size,height:size,correctLevel:QRCode.CorrectLevel.M});else el.textContent=text?"QR লোড হয়নি":""}
function upiLink(am){const u=$("upi").value.trim();return u?`upi://pay?pa=${encodeURIComponent(u)}&pn=${encodeURIComponent("VCAJ")}${am?`&am=${am}&cu=INR`:""}`:""}
function drawUpi(){try{localStorage.setItem("vcajUpi",$("upi").value.trim())}catch{}qr($("qr"),upiLink(),110)}
function dues(){const L=M.filter(m=>m.feeStatus!=="পরিশোধিত"&&num(m.fee)>0);const tot=L.reduce((a,m)=>a+num(m.fee),0);
 $("dt").innerHTML=`<b>${L.length} জনের বকেয়া • সম্ভাব্য মোট ${money(tot)}</b>`;
 $("dl").innerHTML=L.map(m=>`<div class="row"><span><b>${esc(m.name)}</b> <span class="st ${m.feeStatus==="আংশিক"?"p":""}">${esc(m.feeStatus||"বাকি")}</span><br><small class="muted">${esc(m.phone||"নম্বর নেই")} • ${money(num(m.fee))}</small></span><span><button data-w="${esc(m.id)}">📲 তাগাদা</button> <a href="receipts.html?member=${encodeURIComponent(m.id)}"><button type="button">🧾 Receipt</button></a></span></div>`).join("")||"<p class='muted'>🎉 কারও বকেয়া নেই।</p>";
 $("dl").querySelectorAll("[data-w]").forEach(b=>b.onclick=()=>{const m=M.find(x=>x.id===b.dataset.w),u=$("upi").value.trim();
  const t=`🏏 VCAJ — চাঁদার অনুরোধ\n\nপ্রিয় ${m.name},\nআপনার ${money(num(m.fee))} চাঁদা এখনও বাকি আছে।${u?`\nUPI করুন: ${u}`:""}\nটাকা দেওয়ার পর Receipt পাবেন।\n\nধন্যবাদ 🙏\nVivekananda Cricket Association of Jeliakhali`;
  window.open(`https://wa.me/${p91(m.phone)}?text=${encodeURIComponent(t)}`,"_blank")})}
function cards(){const q=$("cs").value.trim().toLowerCase();
 $("cl").innerHTML=M.filter(m=>!q||(m.name||"").toLowerCase().includes(q)).map(m=>`<div class="idc"><h4>VIVEKANANDA CRICKET ASSOCIATION OF JELIAKHALI</h4><h2>${esc(m.name)}</h2><p>${esc(m.role||m.type||"Member")}${m.season?" • "+esc(m.season):""}</p><p>📞 ${esc(m.phone||"—")}</p><div class="no">ID: ${esc((m.memberId||m.id).toString().slice(0,12).toUpperCase())}</div><div class="q" data-q="${esc(m.id)}"></div></div>`).join("")||"<p class='muted'>কোনো সদস্য নেই।</p>";
 $("cl").querySelectorAll("[data-q]").forEach(e=>qr(e,`VCAJ-MEMBER:${e.dataset.q}`,54))}
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("on",x===b));$("due").classList.toggle("hide",b.dataset.t!=="due");$("card").classList.toggle("hide",b.dataset.t!=="card");if(b.dataset.t==="card")cards()});
$("upi").oninput=drawUpi;$("cs").oninput=cards;$("pc").onclick=()=>print();
$("lb").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value,$("pw").value)}catch{alert("Login হয়নি")}};
try{$("upi").value=localStorage.getItem("vcajUpi")||""}catch{}
onAuthStateChanged(auth,async u=>{const ok=isAdmin(u);$("lg").classList.toggle("hide",ok);$("app").classList.toggle("hide",!ok);if(!ok)return;
 try{const s=await getDocs(collection(db,"members"));M=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""))}catch{$("dl").textContent="সদস্যদের তালিকা লোড হয়নি।";return}
 drawUpi();dues();cards()});
