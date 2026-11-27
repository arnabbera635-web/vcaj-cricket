import {auth,db,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,collection,doc,getDocs,setDoc,deleteDoc} from "./firebase.js";
import {getCached,clearCached} from "./vcaj-cache.js";
import {CATS,SPONSORS,PRIZES,tel10,fmtPhone,mergeSponsors,vcard} from "./sponsors-data.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const safe=u=>/^https:\/\//i.test(u||"")?u:"";
const STATIC=new Set(SPONSORS.map(s=>s.id));
let docs=[],list=[],adm=false,editId="",cat="all",q="",favOnly=false,favs=new Set();
try{favs=new Set(JSON.parse(localStorage.getItem("vcajFavSp")||"[]"))}catch(e){}
const saveFavs=()=>{try{localStorage.setItem("vcajFavSp",JSON.stringify([...favs]))}catch(e){}};
const cinfo=s=>CATS[s.cat]||CATS.other;
const toast=m=>window.vcToast?window.vcToast(m):alert(m);
const greet="নমস্কার, VCAJ ক্রিকেট টুর্নামেন্ট-এর Sponsor তালিকা থেকে আপনার নম্বর পেয়ে যোগাযোগ করছি।";
const shareText=s=>`🤝 ${s.name}${s.owner?"\n👤 "+s.owner:""}${(s.phones||[]).length?"\n📞 "+s.phones.map(fmtPhone).join(" / "):""}${s.place?"\n📍 "+s.place:""}${s.desc?"\n"+s.desc:""}\n\n— VCAJ ক্রিকেট টুর্নামেন্টের Sponsor\n${location.origin}${location.pathname}`;
function visible(){
 const k=q.trim().toLowerCase();
 return list.filter(s=>(cat==="all"||s.cat===cat)&&(!favOnly||favs.has(s.id))&&(!k||[s.name,s.owner,s.place,s.desc,(s.phones||[]).join(" "),cinfo(s).n].join(" ").toLowerCase().includes(k)))}
function card(s,i){
 const c=cinfo(s),ph=(s.phones||[]).filter(p=>tel10(p)),logo=safe(s.logo),web=safe(s.link),map=s.place?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.place)}`:"";
 return `<article class="sc" id="sp-${esc(s.id)}" style="animation-delay:${Math.min(i,12)*40}ms">
 <div class="hd" style="background:linear-gradient(135deg,${c.c[0]},${c.c[1]})"><div class="em">${c.e}</div><span class="cn">${esc(c.n)}</span>${logo?`<img src="${esc(logo)}" alt="" loading="lazy" onerror="this.remove()">`:""}</div>
 <div class="bd">${s.tier?`<span class="ti">⭐ ${esc(s.tier)}</span>`:""}${s.tag?`<span class="tg">${esc(s.tag)}</span>`:""}<h3>${esc(s.name)}</h3>${s.owner?`<div class="own">👤 প্রোঃ ${esc(s.owner)}</div>`:""}${(s.desc||s.note)?`<div class="ds">${esc(s.desc||s.note)}</div>`:""}${s.place?`<div class="pl">📍 ${esc(s.place)}</div>`:""}
 <div class="acts">${ph.map(p=>`<a class="b call" href="tel:+91${tel10(p)}">📞 ${esc(fmtPhone(p))}</a>`).join("")}${ph[0]?`<a class="b wa" href="https://wa.me/91${tel10(ph[0])}?text=${encodeURIComponent(greet)}" target="_blank" rel="noopener">💬 WhatsApp</a>`:""}${map?`<a class="b" href="${map}" target="_blank" rel="noopener">🗺️ ম্যাপ</a>`:""}${web?`<a class="b" href="${esc(web)}" target="_blank" rel="noopener">🌐 লিংক</a>`:""}<button class="b" data-a="copy" data-id="${esc(s.id)}">📋</button><button class="b" data-a="share" data-id="${esc(s.id)}">📤</button><button class="b fav ${favs.has(s.id)?"on":""}" data-a="fav" data-id="${esc(s.id)}">${favs.has(s.id)?"❤️":"🤍"}</button></div>
 ${adm?`<div class="adm"><button class="b" data-a="edit" data-id="${esc(s.id)}">✏️ Edit</button>${s._over?`<button class="b" data-a="reset" data-id="${esc(s.id)}">↩ আসল তালিকায় ফিরুন</button>`:""}<button class="b" data-a="del" data-id="${esc(s.id)}">${STATIC.has(s.id)?"🙈 লুকান":"🗑️ মুছুন"}</button></div>`:""}</div></article>`}
function chips(){
 const counts={all:list.length};list.forEach(s=>counts[s.cat]=(counts[s.cat]||0)+1);
 $("chips").innerHTML=[["all","সব","✨"],...Object.entries(CATS).filter(([k])=>counts[k]).map(([k,v])=>[k,v.n,v.e])].map(([k,n,e])=>`<button class="chip ${cat===k?"on":""}" data-c="${k}">${e} ${esc(n)} (${counts[k]||0})</button>`).join("")}
function stats(){
 const phones=list.reduce((a,s)=>a+(s.phones||[]).filter(p=>tel10(p)).length,0),cats=new Set(list.map(s=>s.cat)).size;
 const items=[[list.length,"সহযোগী প্রতিষ্ঠান"],[PRIZES.length,"বিশেষ পুরস্কার"],[cats,"ক্ষেত্র"],[phones,"যোগাযোগ নম্বর"]];
 $("stats").innerHTML=items.map(([n,l],i)=>`<div class="stat"><b data-n="${n}">0</b><span>${l}</span></div>`).join("");
 const reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;
 $("stats").querySelectorAll("b").forEach(b=>{const n=+b.dataset.n;if(reduce||!n){b.textContent=n;return}let t0;const step=t=>{t0=t0||t;const p=Math.min(1,(t-t0)/900);b.textContent=Math.round(n*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step)})}
function spotlight(){
 if(!list.length){$("spot").innerHTML="";return}
 const day=Math.floor(Date.now()/864e5),s=list[day%list.length],c=cinfo(s);
 $("spot").innerHTML=`<div class="spot"><span class="lb">✨ আজকের Spotlight</span><div class="ic" style="background:linear-gradient(135deg,${c.c[0]},${c.c[1]})">${c.e}</div><div><h2>${esc(s.name)}</h2>${s.owner?`<div class="own">👤 ${esc(s.owner)}</div>`:""}<div class="ds">${esc(s.desc||s.note||"")}</div><div class="acts"><button class="b" data-goto="${esc(s.id)}">👇 বিস্তারিত দেখুন</button></div></div></div>`}
function awards(){
 const k=q.trim().toLowerCase(),L=PRIZES.filter(p=>!k||[p.title,p.memorial,p.by,p.no].join(" ").toLowerCase().includes(k));
 $("aw").innerHTML=L.length?L.map(p=>{const sp=p.sponsorId&&list.find(s=>s.id===p.sponsorId);return`<div class="pz"><span class="no">পুরস্কার নং ${p.no}</span><div class="ic">${p.icon}</div><h4>${esc(p.title)}</h4>${p.memorial?`<div class="mm">🕯️ ${esc(p.memorial)}</div>`:""}<div class="by">সৌজন্যে: ${sp?`<a data-goto="${esc(sp.id)}">${esc(p.by)}</a>`:esc(p.by)}</div></div>`}).join(""):'<div class="empty">কোনো পুরস্কার মেলেনি</div>'}
function render(){
 list=mergeSponsors(SPONSORS,docs);
 stats();spotlight();chips();
 const v=visible();$("grid").innerHTML=v.length?v.map(card).join(""):`<div class="empty" style="grid-column:1/-1">${favOnly?"কোনো পছন্দের Sponsor নেই — কার্ডের 🤍 চাপুন":"কিছু মেলেনি"}</div>`;
 awards();
 $("tickT").textContent=(list.map(s=>s.name).join("  •  ")+"  •  ").repeat(2);
 hidden()}
function hidden(){
 const h=docs.filter(d=>d.hidden&&STATIC.has(d.id));$("hidBox").classList.toggle("hide",!adm||!h.length);
 $("hid").innerHTML=h.map(d=>{const s=SPONSORS.find(x=>x.id===d.id);return`<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc(s.name)}</span><button class="b" data-a="unhide" data-id="${esc(d.id)}">↩ ফিরিয়ে আনুন</button></div>`}).join("")}
async function load(fresh){
 try{if(fresh)clearCached("vc_sponsors");docs=await getCached("vc_sponsors",()=>getDocs(collection(db,"sponsors")).then(s=>s.docs.map(d=>({id:d.id,...d.data()}))),300000)}catch(e){docs=[]}
 render()}
const byId=id=>list.find(s=>s.id===id);
function fillForm(s){editId=s?s.id:"";$("n").value=s?.name||"";$("cat").value=s?.cat||"other";$("own").value=s?.owner||"";$("p1").value=(s?.phones||[])[0]||"";$("p2").value=(s?.phones||[])[1]||"";$("pl").value=s?.place||"";$("ds").value=s?.desc||s?.note||"";$("t").value=s?.tier||"";$("l").value=s?.logo||"";$("u").value=s?.link||"";
 $("admT").textContent=s?"✏️ Sponsor Edit করুন":"⚙️ Sponsor যোগ করুন (Admin)";$("add").textContent=s?"💾 পরিবর্তন সেভ করুন":"➕ যোগ করুন";$("cancel").classList.toggle("hide",!s)}
document.addEventListener("click",async e=>{
 const ch=e.target.closest("[data-c]");if(ch){cat=ch.dataset.c;render();return}
 const g=e.target.closest("[data-goto]");if(g){cat="all";q="";$("q").value="";favOnly=false;$("favF").textContent="🤍 পছন্দের";render();const el=$("sp-"+g.dataset.goto);if(el){el.scrollIntoView({behavior:"smooth",block:"center"});el.style.outline="3px solid var(--orange)";setTimeout(()=>el.style.outline="",2200)}return}
 const b=e.target.closest("[data-a]");if(!b)return;const id=b.dataset.id,a=b.dataset.a,s=byId(id);
 if(a==="copy"&&s){try{await navigator.clipboard.writeText(shareText(s));toast("📋 কপি হয়েছে")}catch(x){prompt("কপি করুন:",shareText(s))}}
 else if(a==="share"&&s){if(navigator.share)navigator.share({title:s.name,text:shareText(s)}).catch(()=>{});else window.open("https://wa.me/?text="+encodeURIComponent(shareText(s)),"_blank")}
 else if(a==="fav"){favs.has(id)?favs.delete(id):favs.add(id);saveFavs();render()}
 else if(a==="edit"&&s){fillForm(s);$("adm").scrollIntoView({behavior:"smooth"})}
 else if(a==="reset"){if(confirm("এই Sponsor-কে ছাপানো আসল তথ্যে ফেরাবেন?")){await deleteDoc(doc(db,"sponsors",id));load(true)}}
 else if(a==="unhide"){await deleteDoc(doc(db,"sponsors",id));load(true)}
 else if(a==="del"&&s){
  if(STATIC.has(id)){if(confirm(`"${s.name}" পেজ থেকে লুকাবেন? (পরে ফিরিয়ে আনা যাবে)`)){try{await setDoc(doc(db,"sponsors",id),{hidden:true,hiddenAtMs:Date.now()});load(true)}catch(x){toast("❌ "+(x.code==="permission-denied"?"অনুমতি নেই":x.message))}}}
  else if(confirm(`"${s.name}" মুছবেন?`)){try{await deleteDoc(doc(db,"sponsors",id));load(true)}catch(x){toast("❌ "+(x.code==="permission-denied"?"অনুমতি নেই":x.message))}}}
});
$("q").oninput=e=>{q=e.target.value;render()};
$("favF").onclick=()=>{favOnly=!favOnly;$("favF").textContent=favOnly?"❤️ শুধু পছন্দের":"🤍 পছন্দের";render()};
$("prt").onclick=()=>print();
$("vcf").onclick=()=>{const v=vcard(list);const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([v],{type:"text/vcard"}));a.download="VCAJ-sponsors.vcf";a.click();toast("📇 ফাইল নামল — খুলে 'Contacts'-এ সেভ করুন")};
$("cat").innerHTML=Object.entries(CATS).map(([k,v])=>`<option value="${k}">${v.e} ${v.n}</option>`).join("");
$("cancel").onclick=()=>fillForm(null);
$("lb").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("em").value,$("pw").value)}catch(e){alert("Login হয়নি")}};
$("add").onclick=async()=>{
 const name=$("n").value.trim();if(!name){$("msg").textContent="⚠️ নাম দিন";return}
 try{
  const id=editId||"SP"+Date.now().toString(36),old=editId?byId(editId):null;
  const data={name,cat:$("cat").value,owner:$("own").value.trim(),phone1:$("p1").value.trim(),phone2:$("p2").value.trim(),place:$("pl").value.trim(),desc:$("ds").value.trim(),tier:$("t").value,logo:$("l").value.trim(),link:$("u").value.trim(),createdAtMs:(old&&old.createdAtMs)||Date.now(),...(old?{editedAtMs:Date.now()}:{})};
  await setDoc(doc(db,"sponsors",id),data);
  const was=!!editId;fillForm(null);$("msg").textContent=was?"✅ পরিবর্তন সেভ হয়েছে":"✅ যোগ হয়েছে";load(true)
 }catch(e){$("msg").textContent="❌ "+(e.code==="permission-denied"?"firestore.rules-এ sponsors-এর নিয়ম publish করুন":e.message)}};
onAuthStateChanged(auth,u=>{adm=isAdmin(u);$("adm").classList.toggle("hide",!adm);$("lg").classList.toggle("hide",adm);render()});
render();load();
