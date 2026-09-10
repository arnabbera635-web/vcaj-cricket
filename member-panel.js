import {auth,db,isAdmin,collection,doc,getDoc,getDocs,setDoc,updateDoc,signInWithEmailAndPassword,signOut,updatePassword,onAuthStateChanged,serverTimestamp} from './firebase.js';
import {MEMBERS} from './member-data.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const phoneDigits=phone=>String(phone||'').replace(/\D/g,'');
const memberIdToAuthEmail=memberId=>`member${String(memberId||'').toLowerCase()}@member.vcajcricket.com`;
const phoneToAuthEmail=phone=>`m${phoneDigits(phone)}@member.vcajcricket.com`;
function resolveMemberId(loginId){
  const raw=String(loginId||'').trim();
  if(/^M\d+$/i.test(raw)) return raw.toUpperCase();
  const digits=phoneDigits(raw);
  const byPhone=digits.length>=10?MEMBERS.find(m=>phoneDigits(m.phone)===digits):null;
  if(byPhone) return byPhone.memberId;
  const byEmail=MEMBERS.find(m=>String(m.email||'').toLowerCase()===raw.toLowerCase());
  return byEmail?.memberId||null;
}
let directory=[];
async function getAccount(user){const snap=await getDoc(doc(db,'memberAccounts',user.uid));return snap.exists()?snap.data():null;}
async function loadDirectory(user){
  if(!user || isAdmin(user)){ directory=[]; $('count').textContent='0 জন'; $('directory').innerHTML='<div class="empty">Member List দেখতে Member Login করুন।</div>'; return; }
  try{
    const account=await getAccount(user);
    if(!account){ $('count').textContent='0 জন'; $('directory').innerHTML='<div class="empty">এই account-এর সঙ্গে কোনো Member Profile যুক্ত নেই। Admin-এর সঙ্গে যোগাযোগ করুন।</div>'; return; }
    const snap=await getDocs(collection(db,'memberDirectory'));
    directory=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    $('count').textContent=`${directory.length} জন`;
    $('directory').innerHTML=directory.length?`<table><tr><th>Member ID</th><th>নাম</th><th>ভূমিকা</th><th>দল</th><th>পরিশোধ</th><th>Payment Status</th></tr>${directory.map(m=>`<tr><td>${esc(m.memberId||m.id)}</td><td>${esc(m.name)}</td><td>${esc(m.role)}</td><td>${esc(m.teamName)}</td><td>₹ ${esc(m.paidAmount||0)}</td><td>${esc(m.paymentStatus||'')}</td></tr>`).join('')}</table>`:'<p>এখনও কোনো সদস্য প্রকাশ করা হয়নি।';
  }catch(e){ $('directory').innerHTML=`<p>তালিকা লোড হয়নি: ${esc(e.message)}</p>`; }
}
function authBox(user){
  if(user){
    $('authBox').innerHTML=`<div class="toolbar"><div><strong>Member Login সফল</strong><p class="muted">${esc(user.email||'')}</p></div><button id="logoutBtn">Logout</button></div>`;
    $('logoutBtn').onclick=()=>signOut(auth); return;
  }
  $('authBox').innerHTML=`<div class="grid two"><div><label>Member ID / Mobile / Email</label><input id="loginId" type="text" autocomplete="username" placeholder="যেমন M001 / 9144966118"></div><div><label>Member Password</label><div class="password-wrap"><input id="password" type="password" autocomplete="current-password" placeholder="আপনার initial password"><button type="button" class="password-toggle" id="toggleLoginPassword">দেখুন</button></div></div></div><div class="toolbar"><button id="login" class="primary">Member Login</button></div><p id="authMsg" class="msg">প্রথম login-এ initial password দিয়ে Login করুন।</p>`;
  $('login').onclick=login;
  $('toggleLoginPassword').onclick=()=>togglePassword('password','toggleLoginPassword');
}
async function login(){
  const loginId=$('loginId').value.trim(), password=$('password').value;
  if(!loginId){$('authMsg').textContent='Member ID, Mobile Number অথবা Email দিন।';return;}
  if(!password){$('authMsg').textContent='Member Password দিন।';return;}
  const memberId=resolveMemberId(loginId);
  if(!memberId){$('authMsg').textContent='এই Member ID/Mobile/Email তালিকায় পাওয়া যায়নি।';return;}
  try{
    await signInWithEmailAndPassword(auth,memberIdToAuthEmail(memberId),password);
  }catch(e){
    if(e.code==='auth/user-not-found'){
      $('authMsg').textContent='এই Member-এর account এখনও তৈরি হয়নি। Admin Panel → Member Account Creation থেকে আবার account তৈরি করুন।';
    }else if(e.code==='auth/wrong-password' || e.code==='auth/invalid-credential'){
      $('authMsg').textContent='Password সঠিক নয়। Initial password-টি ঠিকভাবে লিখুন; বড়/ছোট অক্ষর ও @ চিহ্ন মিলিয়ে দিন।';
    }else{
      $('authMsg').textContent='Member Login হয়নি: '+(e.code||e.message);
    }
  }
}
async function loadProfile(user){
  $('myProfileCard').classList.remove('hidden');
  try{
    const map=await getAccount(user);
    if(!map){$('profile').innerHTML='<p>এই login-এর সঙ্গে কোনো Member Profile যুক্ত নেই। Admin-এর সঙ্গে যোগাযোগ করুন।</p>';return;}
    const snap=await getDoc(doc(db,'members',map.memberId));
    if(!snap.exists()){$('profile').innerHTML='<p>Member record পাওয়া যায়নি।</p>';return;}
    const m=snap.data();
    $('profile').innerHTML=`<div class="grid two"><div><strong>Member ID</strong><p>${esc(map.memberId)}</p></div><div><strong>নাম</strong><p>${esc(m.name)}</p></div><div><strong>ভূমিকা</strong><p>${esc(m.role)}</p></div><div><strong>ফোন</strong><p>${esc(m.phone)}</p></div><div><strong>ঠিকানা</strong><p>${esc(m.address||'')}</p></div><div><strong>Fee</strong><p>₹ ${esc(m.fee||0)}</p></div><div><strong>Payment Status</strong><p>${esc(m.feeStatus||'')}</p></div><div><strong>Season</strong><p>${esc(m.season||'')}</p></div><div><strong>Note</strong><p>${esc(m.note||'')}</p></div></div>`;
  }catch(e){$('profile').innerHTML=`<p>Profile লোড হয়নি: ${esc(e.message)}</p>`;}
}
function togglePassword(inputId,buttonId){
  const input=$(inputId), button=$(buttonId);
  if(!input || !button) return;
  const visible=input.type==='text';
  input.type=visible?'password':'text';
  button.textContent=visible?'দেখুন':'লুকান';
}
function showPasswordChange(user,account){
  $('passwordChangeCard').classList.add('active');
  $('passwordChangeCard').classList.remove('hidden');
  $('passwordChange').innerHTML=`<p><strong>নতুন Password সেট করা ঐচ্ছিক।</strong> চাইলে এখনই পরিবর্তন করতে পারেন, না চাইলে “পরে করব” চাপুন।</p><div class="grid two"><div><label>নতুন Password</label><div class="password-wrap"><input id="newPassword" type="password" minlength="6" autocomplete="new-password" placeholder="কমপক্ষে 6 অক্ষর"><button type="button" class="password-toggle" id="toggleNewPassword">দেখুন</button></div></div><div><label>নতুন Password আবার দিন</label><div class="password-wrap"><input id="confirmNewPassword" type="password" minlength="6" autocomplete="new-password" placeholder="আবার লিখুন"><button type="button" class="password-toggle" id="toggleConfirmPassword">দেখুন</button></div></div></div><div class="toolbar"><button id="changePasswordBtn" class="primary">Password পরিবর্তন করুন</button><button id="skipPasswordBtn" type="button">পরে করব</button></div><p id="passwordMsg" class="msg"></p>`;
  $('toggleNewPassword').onclick=()=>togglePassword('newPassword','toggleNewPassword');
  $('toggleConfirmPassword').onclick=()=>togglePassword('confirmNewPassword','toggleConfirmPassword');
  $('skipPasswordBtn').onclick=async()=>{
    try{await updateDoc(doc(db,'memberAccounts',user.uid),{mustChangePassword:false,updatedAt:serverTimestamp()});}catch(e){}
    $('passwordChangeCard').classList.remove('active');
    $('passwordChangeCard').classList.add('hidden');
    await loadProfile(user); await loadDirectory(user);
  };
  $('changePasswordBtn').onclick=async()=>{
    const a=$('newPassword').value,b=$('confirmNewPassword').value;
    if(!a && !b){$('passwordMsg').textContent='নতুন password না দিলে “পরে করব” চাপুন।';return;}
    if(a.length<6){$('passwordMsg').textContent='Password অন্তত 6 অক্ষরের হতে হবে।';return;}
    if(a!==b){$('passwordMsg').textContent='দুটি password একই নয়।';return;}
    try{
      $('changePasswordBtn').disabled=true;
      await updatePassword(user,a);
      await updateDoc(doc(db,'memberAccounts',user.uid),{mustChangePassword:false,updatedAt:serverTimestamp()});
      $('passwordMsg').textContent='Password সফলভাবে পরিবর্তন হয়েছে।';
      $('passwordChangeCard').classList.remove('active');
      $('passwordChangeCard').classList.add('hidden');
      await loadProfile(user); await loadDirectory(user);
    }catch(e){$('passwordMsg').textContent='Password পরিবর্তন হয়নি: '+(e.code||e.message);$('changePasswordBtn').disabled=false;}
  };
}
$('refresh').onclick=()=>loadDirectory(auth.currentUser);
onAuthStateChanged(auth,async user=>{
  authBox(user);
  if(user&&!isAdmin(user)){
    const account=await getAccount(user).catch(()=>null);
    showPasswordChange(user,account);
    loadProfile(user);
    loadDirectory(user);
  }else{$('passwordChangeCard').classList.add('hidden');$('passwordChangeCard').classList.remove('active');$('myProfileCard').classList.add('hidden');loadDirectory(null);}
});
loadDirectory(null);
