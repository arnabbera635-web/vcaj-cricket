import {db,collection,onSnapshot,doc} from './firebase.js';
const box=document.getElementById('liveBox');
const select=document.getElementById('matchSelect');
const connection=document.getElementById('connection');
let matches=[]; let selectedId=new URLSearchParams(location.search).get('match')||''; let detailUnsub=null;
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function num(v){return Number(v||0)}
function overs(b){b=num(b);return `${Math.floor(b/6)}.${b%6}`}
function ts(v){return v?.toDate?v.toDate().toLocaleTimeString('bn-IN',{hour:'2-digit',minute:'2-digit'}):''}
function setConnection(text){connection.textContent=text}
function renderSelect(){
 const live=matches.filter(m=>m.status==='LIVE'||m.status==='SUPER_OVER'||m.status==='INNINGS_BREAK'||m.status==='SUPER_OVER_READY');
 select.innerHTML=live.length?`<option value="">— Live match নির্বাচন করুন —</option>`+live.map(m=>`<option value="${esc(m.id)}">${esc(m.team1Name||m.battingTeam||'Team 1')} vs ${esc(m.team2Name||m.bowlingTeam||'Team 2')} • ${esc(m.stageName||'Match')}</option>`).join(''):'<option value="">এই মুহূর্তে কোনো Live Match নেই</option>';
 if(selectedId&&live.some(m=>m.id===selectedId))select.value=selectedId;
 else if(live.length&&!selectedId){selectedId=live[0].id;select.value=selectedId;watch(selectedId)}
 else if(selectedId&&!live.some(m=>m.id===selectedId)){selectedId='';watch('')}
}
function render(m){
 if(!m){box.innerHTML='<div class="empty">এই মুহূর্তে কোনো Live Match নেই।</div>';return}
 const target=num(m.target); const remaining=Math.max(0,num(m.maxOvers)*6-num(m.legalBalls)); const rrr=target&&remaining?Math.max(0,(target-num(m.score))/(remaining/6)):0;
 const striker=(m.players||[]).find(p=>p.id===m.striker); const non=(m.players||[]).find(p=>p.id===m.nonStriker); const bowler=(m.bowlers||[]).find(p=>p.id===m.bowler);
 const commentary=(m.commentary||[]).slice(-50).reverse();
 box.innerHTML=`<section class="score-card"><div class="score-line"><div><span class="pill-live"><i class="dot"></i>${esc(m.status||'LIVE')}</span><div class="teams" style="margin-top:10px">${esc(m.battingTeam||m.team1Name||'')} <span class="muted2">vs</span> ${esc(m.bowlingTeam||m.team2Name||'')}</div><div class="muted2">${esc(m.season||'')} • ${esc(m.stageName||'Match')} • ${esc(m.id||'')}</div></div><div class="score">${num(m.score)}/${num(m.wickets)}</div></div>
 <div class="live-grid" style="margin-top:18px"><div class="live-stat"><span>Overs</span><strong>${overs(m.legalBalls)} / ${num(m.maxOvers)}</strong></div><div class="live-stat"><span>CRR</span><strong>${m.legalBalls?(num(m.score)/(num(m.legalBalls)/6)).toFixed(2):'0.00'}</strong></div><div class="live-stat"><span>Target</span><strong>${target||'—'}</strong></div><div class="live-stat"><span>RRR</span><strong>${target?rrr.toFixed(2):'—'}</strong></div></div>
 <div class="live-grid" style="margin-top:12px"><div class="live-stat"><span>Striker</span><strong style="font-size:18px">${esc(striker?.name||'—')} ${striker?`• ${num(striker.runs)} (${num(striker.balls)})`:''}</strong></div><div class="live-stat"><span>Non-striker</span><strong style="font-size:18px">${esc(non?.name||'—')}</strong></div><div class="live-stat"><span>Bowler</span><strong style="font-size:18px">${esc(bowler?.name||'—')}</strong></div><div class="live-stat"><span>Updated</span><strong style="font-size:18px">${esc(ts(m.updatedAt)||'Now')}</strong></div></div>
 <div style="margin-top:16px"><b>Live Commentary</b><div class="commentary-live">${commentary.length?commentary.map(x=>`<div><b>${esc(x.over||'')}</b> — ${esc(x.text||'')}</div>`).join(''):'<div class="muted2">এখনও কোনো বলের commentary নেই।</div>'}</div></div>
 <div class="public-note">এই panel Firebase real-time listener ব্যবহার করছে—scorer update করলেই এই পেজ automatically update হবে।</div></section>`;
}
function watch(id){
 if(detailUnsub){detailUnsub();detailUnsub=null}
 if(!id){render(null);return}
 setConnection('Live match connected — automatic updates ON');
 detailUnsub=onSnapshot(doc(db,'liveMatches',id),snap=>{if(snap.exists())render({id:snap.id,...snap.data()});else render(null)},err=>{setConnection('Live connection error');box.innerHTML=`<div class="empty">Live data unavailable: ${esc(err.message)}</div>`});
 history.replaceState(null,'',`live.html?match=${encodeURIComponent(id)}`);
}
select.onchange=()=>{selectedId=select.value;watch(selectedId)};
onSnapshot(collection(db,'liveMatches'),snap=>{matches=snap.docs.map(d=>({id:d.id,...d.data()}));renderSelect();setConnection('Firebase connected — automatic updates ON');if(selectedId)watch(selectedId)},err=>{setConnection('Firebase connection unavailable');box.innerHTML='<div class="empty">Live data unavailable. পরে আবার চেষ্টা করুন।</div>'});
