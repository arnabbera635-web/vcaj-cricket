import {db,collection,getDocs} from './firebase.js';
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function rows(a,metric,label){return a.slice(0,10).map((p,i)=>`<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--line)"><span><b>${i+1}. ${esc(p.name)}</b><br><small class="muted">${esc(p.teamName||'')}</small></span><strong>${p[metric]||0} ${label}</strong></div>`).join('')||'<div class="empty">No data yet</div>'}
function hatRows(a,key,label){return a.filter(p=>(p[key]||0)>0).sort((a,b)=>(b[key]||0)-(a[key]||0)).slice(0,10).map((p,i)=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line)"><span><b>${i+1}. ${esc(p.name)}</b><br><small class="muted">${esc(p.teamName||'')}</small></span><strong>${p[key]||0} ${label}</strong></div>`).join('')||'<div class="empty">No hat-trick record yet</div>'}
async function load(){
 const s=await getDocs(collection(db,'players'));const p=s.docs.map(d=>({id:d.id,...d.data()}));
 document.getElementById('batting').innerHTML=rows([...p].sort((a,b)=>(b.totalRuns||0)-(a.totalRuns||0)),'totalRuns','runs');
 document.getElementById('bowling').innerHTML=rows([...p].sort((a,b)=>(b.totalWickets||0)-(a.totalWickets||0)),'totalWickets','wkts');
 const field=[...p].sort((a,b)=>((b.fieldingDismissals||0)-(a.fieldingDismissals||0)));
 document.getElementById('fielding').innerHTML=field.slice(0,10).map(x=>`<div style="padding:9px 0;border-bottom:1px solid var(--line)"><b>${esc(x.name)}</b> — ${x.fieldingDismissals||0} dismissals <span class="muted">(C ${x.fieldingCatches||0}, S ${x.fieldingStumpings||0}, RO ${x.fieldingRunOuts||0})</span></div>`).join('')||'<div class="empty">No fielding data yet</div>';
 document.getElementById('bowlerHat').innerHTML=hatRows(p,'bowlingHatTricks','hat-trick');
 document.getElementById('batterHat').innerHTML=hatRows(p,'battingHatTricks','batting hat-trick');
 document.getElementById('fielderHat').innerHTML=hatRows(p,'fieldingHatTricks','fielding hat-trick');
 document.getElementById('candidates').innerHTML=`<p>Best Batsman: <b>${esc([...p].sort((a,b)=>(b.totalRuns||0)-(a.totalRuns||0))[0]?.name||'—')}</b></p><p>Best Bowler: <b>${esc([...p].sort((a,b)=>(b.totalWickets||0)-(a.totalWickets||0))[0]?.name||'—')}</b></p><p>Best Fielder/keeper: <b>${esc(field[0]?.name||'—')}</b></p>`;
}load();