import {auth,signInWithEmailAndPassword} from './firebase.js';
const $=id=>document.getElementById(id);
const phoneToAuthEmail=phone=>`m${String(phone||'').replace(/\D/g,'')}@member.vcajcricket.com`;
$('homeAdminLogin')?.addEventListener('click',async()=>{try{await signInWithEmailAndPassword(auth,$('homeAdminEmail').value.trim(),$('homeAdminPassword').value);location.href='scorer.html';}catch(e){$('homeAdminMsg').textContent='Admin Login হয়নি।';}});
$('homeMemberLogin')?.addEventListener('click',async()=>{const phone=$('homeMemberPhone').value.trim();if(phone.replace(/\D/g,'').length<10){$('homeMemberMsg').textContent='সঠিক Mobile Number দিন।';return;}try{await signInWithEmailAndPassword(auth,phoneToAuthEmail(phone),$('homeMemberPassword').value);location.href='member-panel.html';}catch(e){$('homeMemberMsg').textContent='Member Login হয়নি: Mobile Number বা Password ভুল।';}});
