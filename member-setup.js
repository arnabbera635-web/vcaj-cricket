import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {getAuth,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut as signOutSecondary} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {auth,db,isAdmin,doc,setDoc,serverTimestamp,onAuthStateChanged} from './firebase.js';
import {firebaseConfig} from './firebase-config.js';
import {MEMBERS} from './member-data.js';
const $=id=>document.getElementById(id);
const secondaryApp=initializeApp(firebaseConfig,'memberAccountSetup');
const secondaryAuth=getAuth(secondaryApp);
const phoneDigits=phone=>String(phone||'').replace(/\D/g,'');
const phoneToAuthEmail=phone=>`m${phoneDigits(phone)}@member.vcajcricket.com`;
function initialPassword(m){
  const prefix=String(m.email||'').split('@')[0].replace(/[^a-zA-Z]/g,'').slice(0,4).toLowerCase();
  const digits=phoneDigits(m.phone); return `${prefix}@${digits.slice(-4)}`;
}
$('adminLogin').onclick=async()=>{try{await signInWithEmailAndPassword(auth,$('adminEmail').value.trim(),$('adminPassword').value);$('loginMsg').textContent='';}catch(e){$('loginMsg').textContent='Admin Login হয়নি।';}};
onAuthStateChanged(auth,user=>{if(user&&isAdmin(user)){$('loginCard').classList.add('hidden');$('setupCard').classList.remove('hidden');}else{$('loginCard').classList.remove('hidden');$('setupCard').classList.add('hidden');}});
async function createAccount(m,password){
  const authEmail=phoneToAuthEmail(m.phone); let cred;
  try{cred=await createUserWithEmailAndPassword(secondaryAuth,authEmail,password);}catch(e){
    if(e.code==='auth/email-already-in-use'){cred=await signInWithEmailAndPassword(secondaryAuth,authEmail,password);}else{throw e;}
  }
  const uid=cred.user.uid;
  await setDoc(doc(db,'members',m.memberId),{memberId:m.memberId,name:m.name,phone:m.phone,email:m.email,authEmail,role:'Member',address:'',teamId:'',teamName:'',season:2026,fee:0,feeStatus:'বাকি',note:'',updatedAt:serverTimestamp()},{merge:true});
  await setDoc(doc(db,'memberDirectory',m.memberId),{memberId:m.memberId,name:m.name,role:'Member',teamName:'',paidAmount:0,paymentStatus:'বাকি',season:2026,updatedAt:serverTimestamp()},{merge:true});
  await setDoc(doc(db,'memberAccounts',uid),{memberId:m.memberId,phone:m.phone,contactEmail:m.email,authEmail,mustChangePassword:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
  return {uid,authEmail,password};
}
$('createAll').onclick=async()=>{
  if(!isAdmin(auth.currentUser))return;
  $('createAll').disabled=true; $('progress').innerHTML=''; let ok=0,fail=0;
  for(const m of MEMBERS){
    const password=initialPassword(m);
    const row=document.createElement('div');row.className='msg';row.textContent=`${m.memberId} • ${m.name} — তৈরি হচ্ছে...`;$('progress').appendChild(row);
    try{await createAccount(m,password);ok++;row.innerHTML=`✓ <strong>${m.memberId} • ${m.name}</strong> — Ready <span class="muted">Initial password: ${password}</span>`;}
    catch(e){fail++;row.textContent=`✗ ${m.memberId} • ${m.name} — ${e.code||e.message}`;}
  }
  try{await signOutSecondary(secondaryAuth);}catch(e){}
  $('setupMsg').textContent=`সম্পন্ন: ${ok}টি account ready, ${fail}টি failed। প্রতিটি Member প্রথম login-এ password পরিবর্তন করবে।`;
  $('createAll').disabled=false;
};
