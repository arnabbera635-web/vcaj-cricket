import {db,collection,onSnapshot} from './firebase.js';
const list=document.getElementById('list'),search=document.getElementById('search');
let data=[];
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function render(){
 const q=(search.value||'').trim().toLowerCase();
 const rows=data.filter(m=>!q||`${m.id||''} ${m.team1Name||''} ${m.team2Name||''} ${m.battingTeam||''} ${m.bowlingTeam||''} ${m.stageName||''}`.toLowerCase().includes(q));
 list.innerHTML=rows.length?rows.map(m=>{
   const score=`${Number(m.score||0)}/${Number(m.wickets||0)}`;
   const status=m.status==='COMPLETED'?'COMPLETED':(m.status||'LIVE');
   return `<div class="match-card" style="margin-top:12px"><div class="card-head"><div><b>${esc(m.team1Name||m.battingTeam||'Team 1')} vs ${esc(m.team2Name||m.bowlingTeam||'Team 2')}</b><div class="muted">${esc(m.season||'')} • ${esc(m.stageName||'Match')} • ${esc(m.id||'')}</div></div><span class="badge">${esc(status)}</span></div><div class="toolbar"><span class="pill">Current: ${esc(m.battingTeam||'')} ${score} • ${esc(m.status||'')}</span><a href="live.html?match=${encodeURIComponent(m.id)}"><button class="secondary">Scorecard / Live</button></a></div></div>`;
 }).join(''):'<div class="empty">কোনো Match পাওয়া যায়নি।</div>';
}
function load(){onSnapshot(collection(db,'matches'),s=>{data=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.updatedAt?.seconds||b.updatedAt||'').localeCompare(String(a.updatedAt?.seconds||a.updatedAt||'')));render()},()=>{list.innerHTML='<div class="empty">Match data unavailable.</div>'})}
search.oninput=render;load();
