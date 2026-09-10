import {auth,db,isAdmin,collection,doc,getDoc,getDocs,setDoc,updateDoc,signInWithEmailAndPassword,signOut,updatePassword,onAuthStateChanged,serverTimestamp} from './firebase.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const phoneDigits=phone=>String(phone||'').replace(/\D/g,'');
const phoneToAuthEmail=phone=>`m${phoneDigits(phone)}@member.vcajcricket.com`;
let directory=[];
async function getAccount(user){const snap=await getDoc(doc(db,'memberAccounts',user.uid));return snap.exists()?snap.data():null;}
async function loadDirectory(user){
  if(!user || isAdmin(user) || $('passwordChangeCard')?.classList.contains('active')){ directory=[]; $('count').textContent='0 জন'; $('directory').innerHTML='<div class="empty">Member List দেখতে Member Login করুন এবং প্রথমে password পরিবর্তন করুন।</div>'; return; }
  try{
    const account=await getAccount(user);
    if(!account){ $('count').textContent='0 জন'; $('directory').innerHTML='<div class="empty">এই account-এর সঙ্গে কোনো Member Profile যুক্ত নেই। Admin-এর সঙ্গে যোগাযোগ করুন।</div>'; return; }
    if(account.mustChangePassword){$('count').textContent='';$('directory').innerHTML='<div class="empty">প্রথমে আপনার password পরিবর্তন করুন।</div>';return;}
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
  $('authBox').innerHTML=`<div class="grid two"><div><label>Mobile Number</label><input id="phone" type="tel" inputmode="numeric" placeholder="যেমন 9144966118"></div><div><label>Member Password</label><input id="password" type="password" placeholder="আপনার initial password"></div></div><div class="toolbar"><button id="login" class="primary">Member Login</button></div><p id="authMsg" class="msg">প্রথম login-এ আপনার password পরিবর্তন করতে হবে।</p>`;
  $('login').onclick=login;
}
async function login(){
  const phone=$('phone').value.trim(), password=$('password').value;
  if(phoneDigits(phone).length<10){$('authMsg').textContent='সঠিক Mobile Number দিন।';return;}
  if(!password){$('authMsg').textContent='Member Password দিন।';return;}
  try{ await signInWithEmailAndPassword(auth,phoneToAuthEmail(phone),password); }
  catch(e){ $('authMsg').textContent='Member Login হয়নি: Mobile Number বা Password ভুল, অথবা account এখনও তৈরি হয়নি।'; }
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
function showPasswordChange(user,account){
  $('passwordChangeCard').classList.add('active');
  $('passwordChangeCard').classList.remove('hidden');
  $('passwordChange').innerHTML=`<p><strong>প্রথম login সম্পন্ন হয়েছে।</strong> নিরাপত্তার জন্য এখন একটি নতুন password সেট করুন।</p><div class="grid two"><div><label>নতুন Password</label><input id="newPassword" type="password" minlength="6" autocomplete="new-password" placeholder="কমপক্ষে 6 অক্ষর"></div><div><label>নতুন Password আবার দিন</label><input id="confirmNewPassword" type="password" minlength="6" autocomplete="new-password"></div></div><button id="changePasswordBtn" class="primary">Password পরিবর্তন করুন</button><p id="passwordMsg" class="msg"></p>`;
  $('changePasswordBtn').onclick=async()=>{
    const a=$('newPassword').value,b=$('confirmNewPassword').value;
    if(a.length<6){$('passwordMsg').textContent='Password অন্তত 6 অক্ষরের হতে হবে।';return;}
    if(a!==b){$('passwordMsg').textContent='দুটি password একই নয়।';return;}
    try{
      $('changePasswordBtn').disabled=true;
      await updatePassword(user,a);
      await updateDoc(doc(db,'memberAccounts',user.uid),{mustChangePassword:false,updatedAt:serverTimestamp()});
      $('passwordMsg').textContent='Password সফলভাবে পরিবর্তন হয়েছে। এখন Member List দেখা যাবে।';
      $('passwordChangeCard').classList.remove('active');
      await loadProfile(user); await loadDirectory(user);
      setTimeout(()=>{$('passwordChangeCard').classList.add('hidden');},500);
    }catch(e){$('passwordMsg').textContent='Password পরিবর্তন হয়নি: '+(e.code||e.message);$('changePasswordBtn').disabled=false;}
  };
}
$('refresh').onclick=()=>loadDirectory(auth.currentUser);
onAuthStateChanged(auth,async user=>{
  authBox(user);
  if(user&&!isAdmin(user)){
    const account=await getAccount(user).catch(()=>null);
    if(account?.mustChangePassword){showPasswordChange(user,account);$('myProfileCard').classList.add('hidden');loadDirectory(user);}
    else{$('passwordChangeCard').classList.add('hidden');$('passwordChangeCard').classList.remove('active');loadProfile(user);loadDirectory(user);}
  }else{$('passwordChangeCard').classList.add('hidden');$('passwordChangeCard').classList.remove('active');$('myProfileCard').classList.add('hidden');loadDirectory(null);}
});
loadDirectory(null);
