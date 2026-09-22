import {db,auth,collection,doc,getDocs,setDoc,updateDoc,deleteDoc,serverTimestamp,signInWithEmailAndPassword} from "./firebase.js";
const $=id=>document.getElementById(id);let teams=[],members=[],editingMemberId="";
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
async function load(){
 const [ts,ms]=await Promise.all([getDocs(collection(db,"teams")),getDocs(collection(db,"members"))]);
 teams=ts.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
 members=ms.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
 $("memberTeam").innerHTML=`<option value="">দল নেই / প্রযোজ্য নয়</option>`+
  teams.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("");
 render();
}
function reset(){
 editingMemberId="";
 ["memberName","memberRole","memberPhone","memberEmail","memberAddress","memberFee","memberNote"].forEach(id=>$(id).value="");
 $("memberSeason").value="2026";$("memberFeeStatus").value="বাকি";$("memberTeam").value="";
 $("memberSave").textContent="সদস্য Save করুন";$("memberCancel").classList.add("hidden");
}
function render(){
 const box=$("memberAdminTable");
 box.innerHTML=members.length?`<div class="table-wrap"><table><tr><th>নাম</th><th>ভূমিকা</th><th>ফোন</th><th>দল</th><th>Season</th><th>Fee</th><th>Status</th><th>Action</th></tr>${
  members.map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(m.role)}</td><td>${esc(m.phone)}</td><td>${esc(m.teamName||"")}</td><td>${esc(m.season||"")}</td><td>${esc(m.fee||"")}</td><td>${esc(m.feeStatus||"")}</td><td><button data-edit="${esc(m.id)}">Edit</button> <button data-del="${esc(m.id)}">Delete</button></td></tr>`).join("")
 }</table></div>`:"<p class='muted'>এখনও কোনো সদস্যের তথ্য নেই।</p>";
 box.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>edit(b.dataset.edit));
 box.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>remove(b.dataset.del));
 $("memberCount").textContent=`${members.length} জন`;
}
function edit(id){
 const m=members.find(x=>x.id===id);if(!m)return;
 editingMemberId=id;
 $("memberName").value=m.name||"";$("memberRole").value=m.role||"";
 $("memberPhone").value=m.phone||"";$("memberEmail").value=m.email||"";
 $("memberAddress").value=m.address||"";$("memberFee").value=m.fee||"";
 $("memberFeeStatus").value=m.feeStatus||"বাকি";$("memberSeason").value=m.season||"2026";
 $("memberNote").value=m.note||"";$("memberTeam").value=m.teamId||"";
 $("memberSave").textContent="সদস্যের তথ্য Update করুন";$("memberCancel").classList.remove("hidden");
 window.scrollTo({top:0,behavior:"smooth"});
}
async function saveMember(){
 const name=$("memberName").value.trim();
 if(!name){$("memberMsg").textContent="সদস্যের নাম দিন।";return;}
 const team=teams.find(t=>t.id===$("memberTeam").value);
 const data={
  name,role:$("memberRole").value.trim(),phone:$("memberPhone").value.trim(),
  email:$("memberEmail").value.trim().toLowerCase(),address:$("memberAddress").value.trim(),
  fee:$("memberFee").value.trim(),feeStatus:$("memberFeeStatus").value,
  season:Number($("memberSeason").value||2026),note:$("memberNote").value.trim(),
  teamId:team?.id||"",teamName:team?.name||"",updatedAt:serverTimestamp()
 };
 try{
  const id=editingMemberId||`member-${Date.now()}`;
  if(editingMemberId)await updateDoc(doc(db,"members",id),data);
  else await setDoc(doc(db,"members",id),{id,...data,createdAt:serverTimestamp()});
  await setDoc(doc(db,"memberDirectory",id),{
   memberId:id,name:data.name,role:data.role,teamName:data.teamName,
   paidAmount:data.fee||0,paymentStatus:data.feeStatus||"",season:data.season,
   updatedAt:serverTimestamp()
  },{merge:true});
  $("memberMsg").textContent="সদস্যের তথ্য Save হয়েছে এবং public list update হয়েছে.";
  reset();await load();
 }catch(e){$("memberMsg").textContent=`Save হয়নি: ${e.message}`;}
}
async function remove(id){
 const m=members.find(x=>x.id===id);if(!m)return;
 if(!confirm(`“${m.name||id}” সদস্যের তথ্য Delete করতে চান?`))return;
 try{await deleteDoc(doc(db,"members",id));await deleteDoc(doc(db,"memberDirectory",id));await load();}
 catch(e){alert(`Delete হয়নি: ${e.message}`);}
}
$("memberSave").onclick=saveMember;$("memberCancel").onclick=reset;
await load();

const phoneToAuthEmail=phone=>`m${String(phone||"").replace(/\D/g,"")}@member.vcajcricket.com`;
$("memberLoginBtn").onclick=async()=>{
 try{
  await signInWithEmailAndPassword(auth,phoneToAuthEmail($("memberLoginPhone").value),$("memberLoginPassword").value);
  $("memberLoginMsg").textContent="Member Login সফল হয়েছে।";
  location.href="member-panel.html";
 }catch(e){$("memberLoginMsg").textContent=`Login হয়নি: ${e.message}`;}
};
