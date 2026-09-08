import {
  auth, db, isAdmin, collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
  signInWithEmailAndPassword, signOut, onAuthStateChanged, serverTimestamp
} from "./firebase.js";

const $ = id => document.getElementById(id);
let members = [];
let teams = [];
let currentUser = null;
let editingId = null;

const esc = s => String(s ?? "").replace(/[&<>'"]/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
}[c]));

function renderAuth(){
  if(isAdmin(currentUser)){
    $("authBox").innerHTML = `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><strong>Admin mode চালু</strong><button id="logoutBtn">Logout</button></div>`;
    $("logoutBtn").onclick = () => signOut(auth);
    $("memberFormCard").classList.remove("hidden");
  }else{
    $("authBox").innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input id="adminEmail" type="email" placeholder="Admin email" value="vcajofficial@gmail.com">
      <input id="adminPassword" type="password" placeholder="Password">
      <button id="loginBtn">Admin Login</button><span id="loginMsg"></span></div>`;
    $("loginBtn").onclick = login;
    $("memberFormCard").classList.add("hidden");
  }
}

async function login(){
  const email = $("adminEmail").value.trim();
  const password = $("adminPassword").value;
  if(!email || !password){$("loginMsg").textContent="Email ও password দিন।";return;}
  try{await signInWithEmailAndPassword(auth,email,password);$("loginMsg").textContent="";}
  catch(e){$("loginMsg").textContent="Login হয়নি। Password যাচাই করুন।";}
}

async function load(){
  try{
    const [ms,ts] = await Promise.all([getDocs(collection(db,"members")),getDocs(collection(db,"teams"))]);
    members = ms.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
    teams = ts.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
    $("memberTeam").innerHTML = `<option value="">দল নেই / প্রযোজ্য নয়</option>` + teams.map(t=>`<option value="${esc(t.id)}">${esc(t.name||t.id)}${t.shortName?` (${esc(t.shortName)})`:""}</option>`).join("");
    render();
  }catch(e){$("members").innerHTML=`<p>ডাটা লোড হয়নি: ${esc(e.message)}</p>`;}
}

function render(){
  $("memberCount").textContent = `${members.length} জন`;
  const admin = isAdmin(currentUser);
  if(!members.length){$("members").innerHTML="<p>এখনও কোনো সদস্য যোগ করা হয়নি।</p>";return;}
  $("members").innerHTML = `<table><tr><th>নাম</th><th>ভূমিকা</th><th>ফোন</th><th>দল</th>${admin?"<th>Action</th>":""}</tr>` +
    members.map(x=>`<tr>
      <td>${esc(x.name)}</td><td>${esc(x.role)}</td><td>${esc(x.phone)}</td><td>${esc(x.teamName||x.team||"")}</td>
      ${admin?`<td><div style="display:flex;gap:6px;flex-wrap:wrap"><button data-edit="${esc(x.id)}">Edit</button><button data-delete="${esc(x.id)}">Delete</button></div></td>`:""}
    </tr>`).join("") + `</table>`;
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>startEdit(b.dataset.edit));
  document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>removeMember(b.dataset.delete));
}

function resetForm(){
  editingId=null;
  $("formTitle").textContent="নতুন সদস্য যোগ করুন";
  $("saveMember").textContent="সদস্য Save করুন";
  $("cancelEdit").classList.add("hidden");
  $("memberName").value=""; $("memberRole").value=""; $("memberPhone").value=""; $("memberTeam").value="";
  $("memberMsg").textContent="";
}

function startEdit(id){
  const m=members.find(x=>x.id===id); if(!m||!isAdmin(currentUser))return;
  editingId=id;
  $("formTitle").textContent="সদস্য Edit করুন";
  $("saveMember").textContent="পরিবর্তন Save করুন";
  $("cancelEdit").classList.remove("hidden");
  $("memberName").value=m.name||""; $("memberRole").value=m.role||""; $("memberPhone").value=m.phone||"";
  $("memberTeam").value=m.teamId||"";
  window.scrollTo({top:0,behavior:"smooth"});
}

async function saveMember(){
  if(!isAdmin(currentUser))return;
  const name=$("memberName").value.trim(), role=$("memberRole").value.trim(), phone=$("memberPhone").value.trim(), teamId=$("memberTeam").value;
  if(!name){$("memberMsg").textContent="সদস্যের নাম দিন।";return;}
  const team=teams.find(t=>t.id===teamId);
  const data={name,role,phone,teamId:teamId||"",teamName:team?.name||"",updatedAt:serverTimestamp()};
  try{
    if(editingId){await updateDoc(doc(db,"members",editingId),data);$("memberMsg").textContent="সদস্যের তথ্য আপডেট হয়েছে।";}
    else{const id=`member-${Date.now()}`;await setDoc(doc(db,"members",id),{id,...data,createdAt:serverTimestamp()});$("memberMsg").textContent="সদস্য Save হয়েছে।";}
    resetForm(); await load();
  }catch(e){$("memberMsg").textContent=`Save হয়নি: ${e.message}`;}
}

async function removeMember(id){
  const m=members.find(x=>x.id===id); if(!m||!isAdmin(currentUser))return;
  if(!confirm(`“${m.name||id}” সদস্যকে Delete করতে চান?`))return;
  try{await deleteDoc(doc(db,"members",id));await load();}
  catch(e){alert(`Delete হয়নি: ${e.message}`);}
}

$("saveMember").onclick=saveMember;
$("cancelEdit").onclick=resetForm;
$("refresh").onclick=load;
onAuthStateChanged(auth,u=>{currentUser=u;renderAuth();render();});
load();
