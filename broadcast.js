import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,collection,doc,getDocs,setDoc,query,orderBy,limit} from "./firebase.js";
import {esc,p91,scheduleText,buildMessage,hashMsg,mergeTeams,normName,DEFAULTS,STAGES,TEMPLATES} from "./broadcast-core.js";
import {siteRoot,liveLinks} from "./site-link.js";
const $=id=>document.getElementById(id);
const LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},SV=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
let T=[],sel=new Set(),hist=[],rows=[{stage:STAGES[0],a:"",b:"",date:"",time:"",venue:""}],cur=null;
let sent=LS("vcajBcSent",{});
const cfg=()=>({title:$("c_title").value.trim()||DEFAULTS.title,organizer:$("c_organizer").value.trim()||DEFAULTS.organizer,sign:$("c_sign").value.trim()||DEFAULTS.sign,venue:$("c_venue").value.trim()});
const live=()=>$("addLive").checked?liveLinks(siteRoot()):"";
const msgFor=t=>buildMessage({teamName:t?t.name:"",body:$("body").value,liveLine:live(),addressTeam:$("addrTeam").checked},cfg());
const key=()=>hashMsg(msgFor(null));
const eligible=()=>T.filter(t=>sel.has(t.id)&&t.wa);
const doneN=()=>eligible().filter(t=>(sent[key()]||{})[t.id]).length;
function saveCfg(){SV("vcajBcCfg",cfg());preview()}
function preview(){
 const first=eligible()[0]||T.find(t=>t.wa)||null;
 $("pv").textContent=msgFor(first);$("pvWho").textContent=first?`(যেমন: ${first.name}-এর জন্য)`:"";
 const n=eligible().length;$("selCnt").textContent=`${n} দল বাছা হয়েছে`;
 const d=doneN();$("prog").innerHTML=`<b>${d} / ${n}</b> দলকে পাঠানো হয়েছে`;$("bar").style.width=(n?d*100/n:0)+"%"}
const SRC={reg:"",receipt:'<span class="b r">🧾 রসিদ</span>',device:'<span class="b r">💾 এই ফোনের রসিদ</span>',manual:'<span class="b r">✍️ হাতে যোগ</span>'};
const badges=t=>(t.src.includes("reg")?`<span class="b ${t.status==="verified"?"v":"p"}">${esc(t.status||"pending")}</span>`:'<span class="b p">নিবন্ধন নেই</span>')+t.src.filter(s=>s!=="reg").map(s=>SRC[s]).join("");
function drawTeams(){
 $("teams").innerHTML=T.length?T.map(t=>`<div class="tr"><input type="checkbox" data-s="${esc(t.id)}" ${sel.has(t.id)?"checked":""} ${t.wa?"":"disabled"}><div><b>${esc(t.name)}</b>${badges(t)}${(sent[key()]||{})[t.id]?'<span class="b s">✓ পাঠানো</span>':""}<br><small>${t.wa?"+"+esc(t.wa):"WhatsApp নম্বর নেই বা ঠিক নয়"}${t.loc?" • "+esc(t.loc):""}</small></div><div>${t.wa?`<button class="sm wa" data-w="${esc(t.id)}">📲 পাঠান</button>`:""}</div></div>`).join(""):"<p class='muted'>এখনও কোনো দল নিবন্ধন করেনি।</p>";
 $("teams").querySelectorAll("[data-s]").forEach(c=>c.onchange=()=>{c.checked?sel.add(c.dataset.s):sel.delete(c.dataset.s);preview()});
 $("teams").querySelectorAll("[data-w]").forEach(b=>b.onclick=()=>send(b.dataset.w));preview()}
function schRows(){
 const dl=T.map(t=>`<option value="${esc(t.name)}">`).join("");
 $("sch").innerHTML=`<datalist id="tl">${dl}</datalist>`+rows.map((r,i)=>`<div class="sr"><select data-f="stage" data-i="${i}">${STAGES.concat(["অন্যান্য"]).map(s=>`<option${r.stage===s?" selected":""}>${s}</option>`).join("")}</select><input data-f="a" data-i="${i}" list="tl" placeholder="প্রথম দল" value="${esc(r.a)}"><input data-f="b" data-i="${i}" list="tl" placeholder="দ্বিতীয় দল" value="${esc(r.b)}"><input type="date" data-f="date" data-i="${i}" value="${esc(r.date)}"><input type="time" data-f="time" data-i="${i}" value="${esc(r.time)}"><button class="sm del" data-d="${i}">✕</button></div>`).join("");
 $("sch").querySelectorAll("[data-f]").forEach(e=>e.oninput=()=>{rows[+e.dataset.i][e.dataset.f]=e.value});
 $("sch").querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>{if(rows.length>1){rows.splice(+b.dataset.d,1);schRows()}})}
async function logBc(extra){
 try{
  const k=key();
  if(!cur||cur.key!==k){const now=Date.now();cur={key:k,id:"BC"+now.toString(36),createdAtMs:now,msg:msgFor(null),recipients:eligible().map(t=>({id:t.id,name:t.name})),opened:[]}}
  if(extra)cur.opened=[...new Set([...cur.opened,extra])];
  await setDoc(doc(db,"broadcasts",cur.id),{...cur,by:auth.currentUser?.email||""});
 }catch(e){}}
function send(id){
 const t=T.find(x=>x.id===id);if(!t||!t.wa)return;
 if(!$("body").value.trim()&&!confirm("বার্তার লেখা ফাঁকা। তবুও পাঠাবেন?"))return;
 window.open(`https://wa.me/${t.wa}?text=${encodeURIComponent(msgFor(t))}`,"_blank");
 const k=key();(sent[k]||(sent[k]={}))[t.id]=Date.now();SV("vcajBcSent",sent);logBc(t.id);drawTeams()}
function histDraw(){
 $("hist").innerHTML=hist.length?hist.map(h=>`<div class="tr" style="grid-template-columns:1fr auto"><div><b>${esc((h.msg||"").split("\n").find((l,i)=>i>=4&&l.trim())||"বার্তা")}</b><br><small>${esc(new Date(h.createdAtMs).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}))} • ${(h.recipients||[]).length} দল • ${(h.opened||[]).length} জনকে খোলা হয়েছে</small></div><div><button class="sm" data-u="${esc(h.id)}">📄 আবার ব্যবহার</button></div></div>`).join(""):"<p class='muted'>এখনও কোনো বার্তা পাঠানো হয়নি।</p>";
 $("hist").querySelectorAll("[data-u]").forEach(b=>b.onclick=()=>{const h=hist.find(x=>x.id===b.dataset.u);const L=(h.msg||"").split("\n");const i=L.findIndex(l=>/^(প্রিয় .* দল,|সকল দলের প্রতি,)$/.test(l));const j=L.lastIndexOf("ধন্যবাদ 🙏");const body=L.slice(i>=0?i+1:3,j>0?j:undefined).join("\n").replace(/\n+🔴[\s\S]*$/,"").trim();$("body").value=body;preview();window.scrollTo({top:0,behavior:"smooth"})})}
function applyDraft(){
 const d=LS("vcajBcDraft",null);if(!d)return;
 try{localStorage.removeItem("vcajBcDraft")}catch{}
 $("body").value=d.body||"";
 let note="✅ ফিকশ্চার থেকে বার্তা বসানো হয়েছে — দেখে নিয়ে পাঠান।";
 if(Array.isArray(d.teams)&&d.teams.length){
  const want=new Set(d.teams.map(normName));
  sel=new Set(T.filter(t=>want.has(normName(t.name))&&t.wa).map(t=>t.id));
  const miss=d.teams.filter(n=>!T.some(t=>normName(t.name)===normName(n)&&t.wa));
  note+=` ${sel.size}টি দল বাছা হয়েছে।`+(miss.length?` ⚠️ এই দলগুলোর WhatsApp নম্বর নেই বা তালিকায় নেই (নিজে খুঁজে টিক দিন): ${miss.join(", ")}`:"")}
 $("sMsg").textContent=note;preview();drawTeams();window.scrollTo({top:0,behavior:"smooth"})}
async function load(){
 const c=LS("vcajBcCfg",{});$("c_title").value=c.title||DEFAULTS.title;$("c_organizer").value=c.organizer||DEFAULTS.organizer;$("c_sign").value=c.sign||DEFAULTS.sign;$("c_venue").value=c.venue||"";
 let regs=[],receipts=[],note="";
 try{regs=(await getDocs(collection(db,"teamRegistrations"))).docs.map(d=>({...d.data(),id:d.id}))}catch(e){note+="নিবন্ধনের তালিকা লোড হয়নি। "}
 try{receipts=(await getDocs(collection(db,"paymentReceipts"))).docs.map(d=>({...d.data(),code:d.id}))}catch(e){note+="রসিদের তালিকা লোড হয়নি। "}
 T=mergeTeams({regs,receipts,locals:LS("vcajIssuedReceipts",[]),extras:LS("vcajBcExtra",[])});
 sel=new Set(T.filter(t=>t.wa).map(t=>t.id));
 const n=k=>T.filter(t=>t.src.includes(k)).length;
 $("tsum").textContent=`মোট ${T.length} দল • নিবন্ধিত ${n("reg")} • রসিদ থেকে ${n("receipt")+n("device")} • হাতে যোগ ${n("manual")} • WhatsApp নম্বর আছে ${T.filter(t=>t.wa).length}${note?" • ⚠️ "+note:""}`
 try{const h=await getDocs(query(collection(db,"broadcasts"),orderBy("createdAtMs","desc"),limit(30)));hist=h.docs.map(d=>({...d.data(),id:d.id}))}catch(e){$("hist").innerHTML="<p class='muted'>ইতিহাস লোড হয়নি — firestore.rules-এ broadcasts-এর নিয়ম publish করুন।</p>"}
 if(hist.length||!$("hist").textContent.includes("লোড হয়নি"))histDraw();schRows();drawTeams();applyDraft()}
$("tpl").onchange=()=>{const v=$("tpl").value;if(!v)return;if($("body").value.trim()&&!confirm("এখনকার লেখা বদলে নমুনা বসবে। ঠিক আছে?")){$("tpl").value="";return}$("body").value=TEMPLATES[v];preview()};
$("addRow").onclick=()=>{rows.push({stage:STAGES[0],a:"",b:"",date:"",time:"",venue:""});schRows()};
$("insSch").onclick=()=>{const t=scheduleText(rows,cfg().venue);if(!t){alert("কমপক্ষে একটা ম্যাচের দুই দলের নাম দিন");return}const b=$("body");b.value=(b.value.replace(/\n*\(নিচের "সময়সূচি বানান"[^)]*\)\s*$/,"").trimEnd()+"\n\n"+t).trim();preview()};
$("body").oninput=()=>{preview();drawTeams()};["addrTeam","addLive"].forEach(i=>$(i).onchange=()=>{preview();drawTeams()});
["c_title","c_organizer","c_sign","c_venue"].forEach(i=>$(i).oninput=saveCfg);
$("xAdd").onclick=()=>{const name=$("xName").value.trim(),ph=$("xPhone").value.trim();if(!name){alert("দলের নাম দিন");return}if(ph&&!p91(ph)){alert("নম্বর ঠিক নেই — ১০ অঙ্কের মোবাইল নম্বর দিন");return}const x=LS("vcajBcExtra",[]);x.push({name,phone:ph});SV("vcajBcExtra",x);$("xName").value="";$("xPhone").value="";return load()};
$("reload").onclick=()=>load();
$("selAll").onclick=()=>{sel=new Set(T.filter(t=>t.wa).map(t=>t.id));drawTeams()};
$("selVer").onclick=()=>{sel=new Set(T.filter(t=>t.wa&&t.status==="verified").map(t=>t.id));drawTeams()};
$("selNone").onclick=()=>{sel=new Set();drawTeams()};
$("next").onclick=()=>{const n=eligible().find(t=>!(sent[key()]||{})[t.id]);if(!n){alert(eligible().length?"বাছা সব দলকে পাঠানো হয়ে গেছে 🎉":"কোনো দল বাছা হয়নি");return}send(n.id)};
$("grp").onclick=()=>{window.open("https://wa.me/?text="+encodeURIComponent(msgFor(null)),"_blank");logBc("group")};
$("copy").onclick=()=>{const m=msgFor(null);(navigator.clipboard?navigator.clipboard.writeText(m):Promise.reject()).then(()=>{$("sMsg").textContent="✅ কপি হয়েছে — WhatsApp গ্রুপে পেস্ট করুন"}).catch(()=>prompt("বার্তা কপি করুন:",m));logBc("copy")};
$("sms").onclick=()=>{const nums=eligible().map(t=>"+"+t.wa);if(!nums.length){alert("কোনো দল বাছা হয়নি");return}location.href=`sms:${nums.join(",")}?body=${encodeURIComponent(msgFor(null))}`;logBc("sms")};
$("reset").onclick=()=>{if(confirm("এই বার্তার পাঠানোর হিসাব মুছে নতুন করে শুরু করবেন?")){delete sent[key()];SV("vcajBcSent",sent);drawTeams()}};
$("lb").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value.trim(),$("pw2").value)}catch{$("lm").textContent="Login হয়নি"}};
onAuthStateChanged(auth,async u=>{const ok=isAdmin(u);$("lg").classList.toggle("hide",ok);$("app").classList.toggle("hide",!ok);if(ok)await load()});
