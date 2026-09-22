import {auth,isAdmin,onAuthStateChanged,signOut} from "./firebase.js";

export function guardAdmin(redirect="index.html"){
  return new Promise(resolve=>{
    onAuthStateChanged(auth,user=>{
      if(!user || !isAdmin(user)){
        window.location.replace(redirect);
        return;
      }
      document.body.classList.remove("auth-pending");
      document.querySelectorAll("[data-admin-email]").forEach(el=>el.textContent=user.email||"");
      resolve(user);
    });
  });
}

export async function logout(){
  try{ await signOut(auth); }catch(e){}
  window.location.replace("index.html");
}

export function bindLogout(){
  document.querySelectorAll("[data-logout]").forEach(b=>b.addEventListener("click",logout));
}
