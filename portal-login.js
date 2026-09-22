import {
  auth,isAdmin,onAuthStateChanged,signInWithEmailAndPassword,signOut
} from "./firebase.js";

const $=id=>document.getElementById(id);
const phoneToAuthEmail=phone=>`m${String(phone||"").replace(/\D/g,"")}@member.vcajcricket.com`;

function setMsg(id,text,error=false){
  const el=$(id);if(!el)return;
  el.textContent=text;el.classList.toggle("danger",!!error);
}

onAuthStateChanged(auth,user=>{
  if(!user)return;
  if(isAdmin(user)){
    const p=location.pathname.split("/").pop();
    if(p==="index.html"||p==="")location.replace("admin.html");
  }
});

$("homeAdminLogin")?.addEventListener("click",async()=>{
  const email=$("homeAdminEmail")?.value.trim();
  const password=$("homeAdminPassword")?.value||"";
  if(!email||!password){setMsg("homeAdminMsg","Email এবং Password দিন।",true);return;}
  try{
    const cred=await signInWithEmailAndPassword(auth,email,password);
    if(!isAdmin(cred.user)){
      await signOut(auth);
      setMsg("homeAdminMsg","এই account-এর Admin access নেই।",true);return;
    }
    setMsg("homeAdminMsg","Login সফল। Admin Panel খোলা হচ্ছে...");
    location.href="admin.html";
  }catch(e){
    setMsg("homeAdminMsg",`Login হয়নি: ${e.message}`,true);
  }
});

$("homeMemberLogin")?.addEventListener("click",async()=>{
  const phone=$("homeMemberPhone")?.value.trim();
  const password=$("homeMemberPassword")?.value||"";
  if(!phone||!password){setMsg("homeMemberMsg","Phone এবং Password দিন।",true);return;}
  try{
    await signInWithEmailAndPassword(auth,phoneToAuthEmail(phone),password);
    setMsg("homeMemberMsg","Member Login সফল।");
    location.href="member-panel.html";
  }catch(e){
    setMsg("homeMemberMsg",`Login হয়নি: ${e.message}`,true);
  }
});
