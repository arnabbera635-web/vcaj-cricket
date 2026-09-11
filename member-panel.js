import {auth,db,isAdmin,collection,doc,getDoc,getDocs,updateDoc,signInWithEmailAndPassword,signOut,updatePassword,onAuthStateChanged,serverTimestamp} from './firebase.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const phoneDigits=phone=>String(phone||'').replace(/\D/g,'');
const phoneToAuthEmail=phone=>`m${phoneDigits(phone)}@member.vcajcricket.com`;
const RATE_KEY='vcaj_member_login_attempts';
const MAX_ATTEMPTS=5, WINDOW_MS=10*60*1000;
let directory=[];
function attempts(){try{return JSON.parse(localStorage.getItem(RATE_KEY)||'[]').filter(t=>Date.now()-t<WINDOW_MS);}catch{return[];}}
function blocked(){return attempts().length>=MAX_ATTEMPTS;}
function recordFail(){const a=attempts();a.push(Date.now());localStorage.setItem(RATE_KEY,JSON.stringify(a));}
function clearFails(){localStorage.removeItem(RATE_KEY);}
async function getAccount(user){const snap=await getDoc(doc(db,'memberAccounts',user.uid));return snap.exists()?snap.data():null;}
async function loadDirectory(user){
  if(!user || isAdmin(user)){$('count').textContent='0 জন';$('directory').innerHTML='<div class="empty">Member List দেখতে Member Login করুন।</div>';return;}
  try{
    const account=await getAccount(user);
    if(!account){$('count').textContent='0 জন';$('directory').innerHTML='<div class="empty">এই account-এর সঙ্গে কোনো Member Profile যুক্ত নেই। Admin-এর সঙ্গে যোগাযোগ করুন।</div>';return;}
    const snap=await getDocs(collection(db,'memberDirectory'));
    directory=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    $('count').textContent=`${directory.length} জন`;
    $('directory').innerHTML=directory.length?`<table><tr><th>Member ID</th><th>নাম</th><th>ভূমিকা</th><th>দল</th><th>পরিশোধ</th><th>Payment Status</th></tr>${directory.map(m=>`<tr><td>${esc(m.memberId||m.id)}</td><td>${esc(m.name)}</td><td>${esc(m.role)}</td><td>${esc(m.teamName)}</td><td>₹ ${esc(m.paidAmount||0)}</td><td>${esc(m.paymentStatus||'')}</td></tr>`).join('')}</table>`:'<p>এখনও কোনো সদস্য প্রকাশ করা হয়নি।</p>';
  }catch(e){$('directory').innerHTML=`<p>তালিকা লোড হয়নি। আবার চেষ্টা করুন।</p>`;}
}
function passwordField(id,placeholder='Password'){
  return `<div class="password-wrap"><input id="${id}" type="password" placeholder="${placeholder}" autocomplete="current-password"><button type="button" class="password-toggle" data-target="${id}">দেখুন</button></div>`;
}
function wirePasswordToggles(){document.querySelectorAll('.password-toggle').forEach(btn=>btn.onclick=()=>{const input=$(btn.dataset.target);if(!input)return;const show=input.type==='password';input.type=show?'text':'password';btn.textContent=show?'লুকান':'দেখুন';});}
function authBox(user){
  if(user){$('authBox').innerHTML=`<div class="toolbar"><div><strong>Member Login সফল</strong><p class="muted">আপনি Member হিসেবে প্রবেশ করেছেন।</p></div><button id="logoutBtn">Logout</button></div>`;$('logoutBtn').onclick=()=>signOut(auth);return;}
  $('authBox').innerHTML=`<div class="grid two"><div><label>Mobile Number</label><input id="phone" type="tel" inputmode="numeric" autocomplete="username" placeholder="যেমন 9144966118"></div><div><label>Member Password</label>${passwordField('password','আপনার password')}</div></div><div class="toolbar"><button id="login" class="primary">Member Login</button></div><p id="authMsg" class="msg">Password ভুলে গেলে Admin-এর সঙ্গে যোগাযোগ করুন।</p>`;
  $('login').onclick=login;wirePasswordToggles();
}
async function login(){
  const phone=$('phone').value.trim(),password=$('password').value;
  if(phoneDigits(phone).length<10){$('authMsg').textContent='সঠিক Mobile Number দিন।';return;}
  if(!password){$('authMsg').textContent='Member Password দিন।';return;}
  if(blocked()){$('authMsg').textContent='অনেকবার ভুল চেষ্টা হয়েছে। 10 মিনিট পরে আবার চেষ্টা করুন।';return;}
  try{await signInWithEmailAndPassword(auth,phoneToAuthEmail(phone),password);clearFails();}
  catch(e){recordFail();$('authMsg').textContent='Member Login হয়নি। Mobile Number বা Password যাচাই করুন।';}
}
async function loadProfile(user){
  $('myProfileCard').classList.remove('hidden');
  try{const map=await getAccount(user);if(!map){$('profile').innerHTML='<p>এই login-এর সঙ্গে কোনো Member Profile যুক্ত নেই। Admin-এর সঙ্গে যোগাযোগ করুন।</p>';return;}const snap=await getDoc(doc(db,'members',map.memberId));if(!snap.exists()){$('profile').innerHTML='<p>Member record পাওয়া যায়নি।</p>';return;}const m=snap.data();$('profile').innerHTML=`<div class="grid two"><div><strong>Member ID</strong><p>${esc(map.memberId)}</p></div><div><strong>নাম</strong><p>${esc(m.name)}</p></div><div><strong>ভূমিকা</strong><p>${esc(m.role)}</p></div><div><strong>ফোন</strong><p>${esc(m.phone)}</p></div><div><strong>ঠিকানা</strong><p>${esc(m.address||'')}</p></div><div><strong>Fee</strong><p>₹ ${esc(m.fee||0)}</p></div><div><strong>Payment Status</strong><p>${esc(m.feeStatus||'')}</p></div><div><strong>Season</strong><p>${esc(m.season||'')}</p></div><div><strong>Note</strong><p>${esc(m.note||'')}</p></div></div>`;}catch(e){$('profile').innerHTML='<p>Profile লোড হয়নি। আবার চেষ্টা করুন।</p>';}
}
function showPasswordChange(user){
  $('passwordChangeCard').classList.remove('hidden');
  $('passwordChange').innerHTML=`<p><strong>আপনি চাইলে এখন password পরিবর্তন করতে পারেন।</strong> না চাইলে <b>পরে করব</b> চাপুন।</p><div class="grid two"><div><label>নতুন Password</label>${passwordField('newPassword','কমপক্ষে 6 অক্ষর')}</div><div><label>নতুন Password আবার দিন</label>${passwordField('confirmNewPassword','আবার লিখুন')}</div></div><div class="toolbar"><button id="changePasswordBtn" class="primary">Password পরিবর্তন করুন</button><button id="skipPasswordBtn" class="secondary">পরে করব</button></div><p id="passwordMsg" class="msg"></p>`;
  wirePasswordToggles();
  $('skipPasswordBtn').onclick=async()=>{try{await updateDoc(doc(db,'memberAccounts',user.uid),{mustChangePassword:false,updatedAt:serverTimestamp()});$('passwordChangeCard').classList.add('hidden');await loadProfile(user);await loadDirectory(user);}catch(e){$('passwordMsg').textContent='পরে করার setting save হয়নি।';}};
  $('changePasswordBtn').onclick=async()=>{const a=$('newPassword').value,b=$('confirmNewPassword').value;if(a.length<6){$('passwordMsg').textContent='Password অন্তত 6 অক্ষরের হতে হবে।';return;}if(a===a.toLowerCase()&&!/[A-Z]/.test(a)){/* optional policy: current free plan accepts lowercase */}if(a!==b){$('passwordMsg').textContent='দুটি password একই নয়।';return;}try{$('changePasswordBtn').disabled=true;await updatePassword(user,a);await updateDoc(doc(db,'memberAccounts',user.uid),{mustChangePassword:false,passwordChangedAt:serverTimestamp(),updatedAt:serverTimestamp()});$('passwordChangeCard').classList.add('hidden');await loadProfile(user);await loadDirectory(user);}catch(e){$('passwordMsg').textContent='Password পরিবর্তন হয়নি। আবার চেষ্টা করুন।';$('changePasswordBtn').disabled=false;}};
}
$('refresh').onclick=()=>loadDirectory(auth.currentUser);
onAuthStateChanged(auth,async user=>{authBox(user);$('passwordChangeCard').classList.add('hidden');$('myProfileCard').classList.add('hidden');if(user&&!isAdmin(user)){showPasswordChange(user);await loadProfile(user);await loadDirectory(user);}else{await loadDirectory(null);}});
loadDirectory(null);
