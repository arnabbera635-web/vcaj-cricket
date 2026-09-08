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
 const live=matches.filter(m=>m.status==='LIVE'||m.status==='SUPER_OVER'||m.status==='INNINGS_BREAK'||m.status==='SUPER_OVER_READY'||m.status==='COMPLETED');
 select.innerHTML=live.length?`<option value="">— Match নির্বাচন করুন —</option>`+live.map(m=>`<option value="${esc(m.id)}">${esc(m.team1Name||m.battingTeam||'Team 1')} vs ${esc(m.team2Name||m.bowlingTeam||'Team 2')} • ${esc(m.stageName||'Match')} • ${esc(m.status==='COMPLETED'?'Completed':'LIVE')}</option>`).join(''):'<option value="">কোনো Match পাওয়া যায়নি</option>';
 if(selectedId&&live.some(m=>m.id===selectedId))select.value=selectedId;
 else if(live.length&&!selectedId){selectedId=live[0].id;select.value=selectedId;watch(selectedId)}
 else if(selectedId&&!live.some(m=>m.id===selectedId)){selectedId='';watch('')}
}
function cardInnings(title,inn,idx){
 if(!inn) return `<section class="score-card innings-card"><div class="card-head"><h2>${title}</h2><span class="pill">Scorecard</span></div><div class="empty">এই innings-এর scorecard এখনও available নয়।</div></section>`;
 const players=Array.isArray(inn.players)?inn.players:[];
 const bowlers=Array.isArray(inn.bowlers)?inn.bowlers:[];
 const crr=Number(inn.legalBalls)?(Number(inn.score||0)/(Number(inn.legalBalls)/6)).toFixed(2):'0.00';
 const extras=inn.extras||{};
 const extraTotal=Number(extras.wide||0)+Number(extras.noBall||0)+Number(extras.bye||0)+Number(extras.legBye||0);
 const batRows=players.map(p=>{
   const sr=Number(p.balls)?((Number(p.runs||0)/Number(p.balls))*100).toFixed(1):'0.0';
   const status=p.out?'OUT':(p.id===inn.striker||p.id===inn.nonStriker?'*':'');
   return `<tr><td>${esc(p.name)} ${status?`<span class="status-mini ${p.out?'out':'notout'}">${status}</span>`:''}</td><td>${num(p.runs)}</td><td>${num(p.balls)}</td><td>${num(p.fours)}</td><td>${num(p.sixes)}</td><td>${sr}</td></tr>`;
 }).join('');
 const bowlRows=bowlers.map(p=>{
   const eco=Number(p.balls)?(Number(p.runs||0)/(Number(p.balls)/6)).toFixed(2):'0.00';
   return `<tr><td>${esc(p.name)}</td><td>${overs(p.balls)}</td><td>${num(p.runs)}</td><td>${num(p.wickets)}</td><td>${eco}</td></tr>`;
 }).join('');
 return `<section class="score-card innings-card"><div class="card-head"><div><h2>${esc(title)}</h2><div class="muted2">${esc(inn.battingTeam||'')} ${num(inn.score)}/${num(inn.wickets)} • ${overs(inn.legalBalls)} / ${num(inn.maxOvers)} overs • CRR ${crr}</div></div><span class="pill">Innings ${idx}</span></div>
 <div class="score-summary"><div><b>Batting</b><span>${esc(inn.battingTeam||'')}</span></div><div><b>Bowling</b><span>${esc(inn.bowlingTeam||'')}</span></div><div><b>Extras</b><span>${extraTotal} (W ${num(extras.wide)}, NB ${num(extras.noBall)}, B ${num(extras.bye)}, LB ${num(extras.legBye)})</span></div><div><b>Target</b><span>${num(inn.target)||'—'}</span></div></div>
 <div class="grid two scorecard-tables"><div><h3>🏏 Batting Card</h3><div class="table-wrap"><table><thead><tr><th>ব্যাটার</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>${batRows||'<tr><td colspan="6">No batting data</td></tr>'}</tbody></table></div></div><div><h3>🎯 Bowling Card</h3><div class="table-wrap"><table><thead><tr><th>বোলার</th><th>O</th><th>R</th><th>W</th><th>Econ</th></tr></thead><tbody>${bowlRows||'<tr><td colspan="5">No bowling data</td></tr>'}</tbody></table></div></div></div></section>`;
}
function render(m){
 if(!m){box.innerHTML='<div class="empty">এই মুহূর্তে কোনো Live Match নেই।</div>';return}
 const target=num(m.target); const remaining=Math.max(0,num(m.maxOvers)*6-num(m.legalBalls)); const rrr=target&&remaining?Math.max(0,(target-num(m.score))/(remaining/6)):0;
 const striker=(m.players||[]).find(p=>p.id===m.striker); const non=(m.players||[]).find(p=>p.id===m.nonStriker); const bowler=(m.bowlers||[]).find(p=>p.id===m.bowler);
 const commentary=(m.commentary||[]).slice(-50).reverse();
 const history=Array.isArray(m.inningsHistory)?m.inningsHistory:[];
 const first=history.find(x=>Number(x.inningsNo)===1)||((Number(m.inningsNo)===1&&!m.superOver)?m:null);
 const second=history.find(x=>Number(x.inningsNo)===2)||((Number(m.inningsNo)===2&&!m.superOver)?m:null);
 const scorecards=`<div class="scorecard-title"><h2>📋 Full Scorecard</h2><p>প্রথম ও দ্বিতীয় innings-এর batting এবং bowling card public panel থেকেই দেখা যাবে।</p></div>${cardInnings('১ম Innings',first,1)}${cardInnings('২য় Innings',second,2)}`;
 box.innerHTML=`<section class="score-card"><div class="score-line"><div><span class="pill-live"><i class="dot"></i>${esc(m.status||'LIVE')}</span><div class="teams" style="margin-top:10px">${esc(m.battingTeam||m.team1Name||'')} <span class="muted2">vs</span> ${esc(m.bowlingTeam||m.team2Name||'')}</div><div class="muted2">${esc(m.season||'')} • ${esc(m.stageName||'Match')} • ${esc(m.id||'')}</div></div><div class="score">${num(m.score)}/${num(m.wickets)}</div></div>
 <div class="live-grid" style="margin-top:18px"><div class="live-stat"><span>Overs</span><strong>${overs(m.legalBalls)} / ${num(m.maxOvers)}</strong></div><div class="live-stat"><span>CRR</span><strong>${m.legalBalls?(num(m.score)/(num(m.legalBalls)/6)).toFixed(2):'0.00'}</strong></div><div class="live-stat"><span>Target</span><strong>${target||'—'}</strong></div><div class="live-stat"><span>RRR</span><strong>${target?rrr.toFixed(2):'—'}</strong></div></div>
 <div class="live-grid" style="margin-top:12px"><div class="live-stat"><span>Striker</span><strong style="font-size:18px">${esc(striker?.name||'—')} ${striker?`• ${num(striker.runs)} (${num(striker.balls)})`:''}</strong></div><div class="live-stat"><span>Non-striker</span><strong style="font-size:18px">${esc(non?.name||'—')}</strong></div><div class="live-stat"><span>Bowler</span><strong style="font-size:18px">${esc(bowler?.name||'—')}</strong></div><div class="live-stat"><span>Updated</span><strong style="font-size:18px">${esc(ts(m.updatedAt)||'Now')}</strong></div></div>
 <div style="margin-top:16px"><b>Live Commentary</b><div class="commentary-live">${commentary.length?commentary.map(x=>`<div><b>${esc(x.over||'')}</b> — ${esc(x.text||'')}</div>`).join(''):'<div class="muted2">এখনও কোনো বলের commentary নেই।</div>'}</div></div>
 <div class="public-note">এই panel Firebase real-time listener ব্যবহার করছে—scorer update করলেই এই পেজ automatically update হবে।</div></section>${scorecards}`;
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
