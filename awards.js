import {auth,db,isAdmin,collection,getDocs,doc,getDoc,setDoc,onAuthStateChanged,signInWithEmailAndPassword} from './firebase.js';

const $=id=>document.getElementById(id);
function setAdminUI(ok){const login=$('loginCard'),app=$('adminAwardsApp');if(login)login.classList.toggle('hidden',ok);if(app)app.classList.toggle('hidden',!ok);}
function setSaveMessage(text,error=false){const el=$('saveMsg');if(el){el.textContent=text;el.className=error?'msg':'muted';}}
async function requireAdmin(){const u=auth.currentUser;if(!u||!isAdmin(u)){setAdminUI(false);setSaveMessage('Admin login প্রয়োজন।',true);return false;}user=u;setAdminUI(true);return true;}
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let players=[],user=null,recommendations={},matchRecommendations=[],seasonStats={};

const awards=['bestBatsman','bestBowler','bestKeeper','bestFielder','playerOfTournament'];
const matchAwards=['bestBatsman','bestBowler','bestKeeper','bestFielder','manOfMatch'];
const awardLabels={bestBatsman:'Best Batsman',bestBowler:'Best Bowler',bestKeeper:'Best Wicketkeeper',bestFielder:'Best Fielder',playerOfTournament:'Player of the Tournament',manOfMatch:'Man of the Match'};

function n(v){return Number(v||0)}
function overs(b){return `${Math.floor(n(b)/6)}.${n(b)%6}`}
function economy(x){return x.bowlingBalls ? x.bowlingRuns/(x.bowlingBalls/6) : 999}
function strikeRate(x){return x.balls ? x.runs/x.balls*100 : 0}
function ensure(by,id,name=''){
  if(!id)return null;
  return by[id] ||= {id,name,runs:0,balls:0,fours:0,sixes:0,wickets:0,bowlingBalls:0,bowlingRuns:0,catches:0,stumpings:0,runOuts:0,matches:new Set(),matchScores:[]};
}
async function loadPlayers(){
  const s=await getDocs(collection(db,'players'));
  players=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
}
function populateSelects(){
  awards.forEach(id=>{if(!$(`${id}`))return;$(`${id}`).innerHTML='<option value="">Player নির্বাচন</option>'+players.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');});
}
async function getSeasonData(season){
  const ms=await getDocs(collection(db,'matches'));
  const matches=ms.docs.map(d=>({id:d.id,...d.data()})).filter(m=>n(m.season)===n(season));
  const by={}; const matchRows=[];
  for(const m of matches){
    const evs=await getDocs(collection(db,'matches',m.id,'events')); const per={};
    evs.docs.forEach(d=>{
      const e=d.data();
      [['batter',e.strikerId,e.batterName||''],['bowler',e.bowlerId,e.bowlerName||''],['fielder',e.fielderId,e.fielderName||'']].forEach(([role,id,name])=>{if(id){ensure(by,id,name);ensure(per,id,name);}});
      if(e.strikerId){const x=ensure(by,e.strikerId,e.batterName),q=ensure(per,e.strikerId,e.batterName);x.runs+=n(e.batterRuns);x.balls+=e.legal?1:0;x.fours+=e.batterRuns===4?1:0;x.sixes+=e.batterRuns===6?1:0;x.matches.add(m.id);q.runs+=n(e.batterRuns);q.balls+=e.legal?1:0;q.fours+=e.batterRuns===4?1:0;q.sixes+=e.batterRuns===6?1:0;q.matches.add(m.id);}
      if(e.bowlerId){const x=ensure(by,e.bowlerId,e.bowlerName),q=ensure(per,e.bowlerId,e.bowlerName);x.bowlingBalls+=e.legal?1:0;x.bowlingRuns+=n(e.bowlerRuns);x.wickets+=e.bowlerWicket?1:0;x.matches.add(m.id);q.bowlingBalls+=e.legal?1:0;q.bowlingRuns+=n(e.bowlerRuns);q.wickets+=e.bowlerWicket?1:0;q.matches.add(m.id);}
      if(e.fielderId){const x=ensure(by,e.fielderId,e.fielderName),q=ensure(per,e.fielderId,e.fielderName);const c=e.dismissalType==='caught'?1:0,s=e.dismissalType==='stumped'?1:0,r=e.dismissalType==='runOut'?1:0;x.catches+=c;x.stumpings+=s;x.runOuts+=r;x.matches.add(m.id);q.catches+=c;q.stumpings+=s;q.runOuts+=r;q.matches.add(m.id);}
    });
    Object.values(per).forEach(x=>x.matchScores.push({matchId:m.id,title:m.title||`${m.team1Name||''} vs ${m.team2Name||''}`,stage:m.stageName||m.stage||'',points:performancePoints(x),runs:x.runs,wickets:x.wickets,catches:x.catches,stumpings:x.stumpings,runOuts:x.runOuts}));
    matchRows.push({id:m.id,title:m.title||`${m.team1Name||''} vs ${m.team2Name||''}`,stage:m.stageName||m.stage||'',status:m.status||'',players:per,match:m});
  }
  return {matches,by,matchRows};
}
function performancePoints(x){return n(x.runs)+n(x.fours)+n(x.sixes)*2+n(x.wickets)*20+n(x.catches)*8+n(x.stumpings)*10+n(x.runOuts)*12;}
function playerName(id,x){return x?.name||players.find(p=>p.id===id)?.name||id}
function top(arr,cmp){return arr.filter(Boolean).sort(cmp)[0]||null}
function bestForPlayers(per){
  const all=Object.values(per).map(x=>({...x}));
  return {
    bestBatsman:top(all.filter(x=>x.balls>0),(a,b)=>b.runs-a.runs||strikeRate(b)-strikeRate(a)||b.sixes-a.sixes||b.fours-a.fours),
    bestBowler:top(all.filter(x=>x.bowlingBalls>0),(a,b)=>b.wickets-a.wickets||economy(a)-economy(b)||b.bowlingBalls-a.bowlingBalls),
    bestKeeper:top(all.filter(x=>x.stumpings>0||x.catches>0),(a,b)=>(b.stumpings*4+b.catches*2)-(a.stumpings*4+a.catches*2)||b.stumpings-a.stumpings||b.catches-a.catches),
    bestFielder:top(all.filter(x=>x.catches>0||x.runOuts>0),(a,b)=>(b.catches*2+b.runOuts*3)-(a.catches*2+a.runOuts*3)||b.runOuts-a.runOuts||b.catches-a.catches),
    manOfMatch:top(all,(a,b)=>performancePoints(b)-performancePoints(a)||b.runs-a.runs||b.wickets-a.wickets)
  };
}
function calculateRecommendations(data){
  const all=Object.values(data.by).map(x=>({...x,matchCount:x.matches.size}));
  const bats=top(all.filter(x=>x.balls>0),(a,b)=>b.runs-a.runs||strikeRate(b)-strikeRate(a)||b.sixes-a.sixes||b.fours-a.fours);
  const bowl=top(all.filter(x=>x.bowlingBalls>0),(a,b)=>b.wickets-a.wickets||economy(a)-economy(b)||b.bowlingBalls-a.bowlingBalls);
  const keep=top(all.filter(x=>x.stumpings>0||x.catches>0),(a,b)=>(b.stumpings*4+b.catches*2)-(a.stumpings*4+a.catches*2)||b.stumpings-a.stumpings||b.catches-a.catches);
  const field=top(all.filter(x=>x.catches>0||x.runOuts>0),(a,b)=>(b.catches*2+b.runOuts*3)-(a.catches*2+a.runOuts*3)||b.runOuts-a.runOuts||b.catches-a.catches);
  const tournament=top(all,(a,b)=>{const sa=performancePoints(a)+strikeRate(a)*.25+n(a.wickets)*4+n(a.catches)*2+n(a.runOuts)*3;const sb=performancePoints(b)+strikeRate(b)*.25+n(b.wickets)*4+n(b.catches)*2+n(b.runOuts)*3;return sb-sa||b.runs-a.runs;});
  return {bestBatsman:bats,bestBowler:bowl,bestKeeper:keep,bestFielder:field,playerOfTournament:tournament};
}
function candidateText(id,x){
  if(!x)return 'কোনও পর্যাপ্ত record পাওয়া যায়নি।';
  if(id==='bestBatsman')return `${playerName(x.id,x)} — ${x.runs} runs, SR ${strikeRate(x).toFixed(1)}, ${x.fours}×4, ${x.sixes}×6`;
  if(id==='bestBowler')return `${playerName(x.id,x)} — ${x.wickets} wickets, ${overs(x.bowlingBalls)} overs, economy ${economy(x).toFixed(2)}`;
  if(id==='bestKeeper')return `${playerName(x.id,x)} — ${x.stumpings} stumpings, ${x.catches} catches`;
  if(id==='bestFielder')return `${playerName(x.id,x)} — ${x.catches} catches, ${x.runOuts} run-outs`;
  if(id==='manOfMatch')return `${playerName(x.id,x)} — ${x.runs} runs, ${x.wickets} wickets, ${x.catches} catches, ${x.stumpings} stumpings, ${x.runOuts} run-outs`;
  return `${playerName(x.id,x)} — ${x.runs} runs, ${x.wickets} wickets, ${x.catches} catches, ${x.stumpings} stumpings, ${x.runOuts} run-outs`;
}

function awardMetrics(id,x){
  if(!x)return [];
  if(id==='bestBatsman')return [
    ['Runs',n(x.runs),'high'],['Strike rate',strikeRate(x),'high'],['4s',n(x.fours),'high'],['6s',n(x.sixes),'high']
  ];
  if(id==='bestBowler')return [
    ['Wickets',n(x.wickets),'high'],['Overs',n(x.bowlingBalls)/6,'high'],['Economy',economy(x),'low']
  ];
  if(id==='bestKeeper')return [
    ['Stumpings',n(x.stumpings),'high'],['Catches',n(x.catches),'high']
  ];
  if(id==='bestFielder')return [
    ['Catches',n(x.catches),'high'],['Run-outs',n(x.runOuts),'high']
  ];
  if(id==='manOfMatch')return [
    ['Performance points',performancePoints(x),'high'],['Runs',n(x.runs),'high'],['Wickets',n(x.wickets),'high'],['Catches',n(x.catches),'high'],['Stumpings',n(x.stumpings),'high'],['Run-outs',n(x.runOuts),'high']
  ];
  return [
    ['Performance points',performancePoints(x),'high'],['Runs',n(x.runs),'high'],['Wickets',n(x.wickets),'high'],['Catches',n(x.catches),'high'],['Stumpings',n(x.stumpings),'high'],['Run-outs',n(x.runOuts),'high']
  ];
}
function fmtMetric(label,v){
  if(label==='Strike rate' || label==='Economy')return Number(v).toFixed(2);
  if(label==='Overs')return Number(v).toFixed(1);
  return Number(v).toFixed(0);
}
function metricClass(value,reference,direction){
  if(!reference || value===reference)return '';
  if(direction==='low')return value>reference?'metric-bad':'metric-good';
  return value<reference?'metric-bad':'metric-good';
}
function comparisonHTML(id,selected,reference){
  if(!reference)return '<div class="compare-empty">Automatic recommendation-এর পর্যাপ্ত record নেই।</div>';
  if(!selected)selected=reference;
  const refName=playerName(reference.id,reference), selName=playerName(selected.id,selected);
  const rows=awardMetrics(id,reference).map(([label,rv,direction])=>{
    const sv=awardMetrics(id,selected).find(m=>m[0]===label)?.[1] ?? 0;
    const cls=selected.id===reference.id?'':metricClass(sv,rv,direction);
    return `<div class="compare-metric"><span>${esc(label)}</span><b class="metric-ref">${fmtMetric(label,rv)}</b><b class="metric-selected ${cls}">${fmtMetric(label,sv)}</b></div>`;
  }).join('');
  return `<div class="compare-title">Record comparison</div><div class="compare-head"><span>Metric</span><span>Recommended: ${esc(refName)}</span><span>Selected: ${esc(selName)}</span></div><div class="compare-body">${rows}</div><div class="compare-legend"><span class="metric-good">Higher/better</span><span class="metric-bad">Lower/worse than recommendation</span></div>`;
}
function bindAwardComparison(id){
  const sel=$(id); if(!sel)return;
  const update=()=>{
    const p=players.find(p=>p.id===sel.value);
    const selected=p ? {...(seasonStats[p.id]||{}),...p,id:p.id,name:p.name} : null;
    const box=$(`${id}Recommendation`);
    box.innerHTML=comparisonHTML(id,selected,recommendations[id]);
  };
  sel.onchange=update;
  update();
}
function showRecommendations(r){
  recommendations=r;
  awards.forEach(id=>{const x=r[id];if($(id))$(id).value=x?.id||'';bindAwardComparison(id);});
  $('calcMsg').textContent='Tournament-level record গণনা সম্পন্ন হয়েছে। Recommended record-এর পাশে আপনার নির্বাচিত player-এর record দেখা যাবে।';
}
function renderMatchRecommendations(rows){
  matchRecommendations=rows;
  const box=$('matchAwardsList');
  if(!rows.length){box.innerHTML='<div class="empty">এই season-এ কোনো match পাওয়া যায়নি।</div>';return;}
  box.innerHTML=rows.map((r,i)=>`<div class="card match-award-card" style="margin:12px 0"><h3>${i+1}. ${esc(r.title)}</h3><p class="small muted">${esc(r.stage||'')} ${r.status?'• '+esc(r.status):''}</p><div class="grid two">${matchAwards.map(id=>{const x=r.awards[id];return `<div class="award-row"><label>${esc(awardLabels[id])}</label><select data-match="${esc(r.id)}" data-award="${id}"><option value="">Player নির্বাচন</option>${players.map(p=>`<option value="${esc(p.id)}" ${x?.id===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select><div class="recommend" data-compare="${esc(r.id)}" data-award-box="${id}">${comparisonHTML(id,x,x)}</div></div>`}).join('')}</div></div>`).join('');
  rows.forEach(r=>matchAwards.forEach(id=>{
    const sel=document.querySelector(`select[data-match="${CSS.escape(r.id)}"][data-award="${id}"]`);
    const box=document.querySelector(`[data-compare="${CSS.escape(r.id)}"][data-award-box="${id}"]`);
    if(!sel||!box)return;
    const reference=r.awards[id];
    const update=()=>{const p=players.find(p=>p.id===sel.value);const selected=p ? {...(r.players[p.id]||{}),...p,id:p.id,name:p.name} : reference;box.innerHTML=comparisonHTML(id,selected,reference);};
    sel.onchange=update;
    update();
  }));
}
async function calculateMatches(){
  const season=n($('season').value||2026);$('matchMsg').textContent='প্রতিটি ম্যাচের record গণনা হচ্ছে…';
  try{const data=await getSeasonData(season);renderMatchRecommendations(data.matchRows.map(r=>({...r,awards:bestForPlayers(r.players)})));$('matchMsg').textContent=`${data.matchRows.length}টি ম্যাচের awards recommendation তৈরি হয়েছে।`;}
  catch(e){console.error(e);$('matchMsg').textContent='Match awards গণনা করতে সমস্যা হয়েছে: '+e.message;}
}
async function saveMatches(){
  if(!await requireAdmin())return;
  if(!matchRecommendations.length){alert('আগে Calculate All Match Awards চাপুন।');return;}
  const btn=$('saveMatchesBtn');if(btn){btn.disabled=true;btn.textContent='Saving…';}
  try{
    for(const r of matchRecommendations){
      const awardsData={};
      matchAwards.forEach(id=>{const sel=document.querySelector(`select[data-match="${CSS.escape(r.id)}"][data-award="${id}"]`);const pid=sel?.value;const p=players.find(x=>x.id===pid);if(pid)awardsData[id]={playerId:pid,playerName:p?.name||'',metrics:candidateText(id,r.awards[id]),savedAt:new Date().toISOString()};});
      if(Object.keys(awardsData).length)await setDoc(doc(db,'matches',r.id),{awards:awardsData},{merge:true});
    }
    $('matchMsg').textContent='সব match awards save হয়েছে।';
  }catch(e){console.error('Save match awards failed:',e);$('matchMsg').textContent='Save হয়নি: '+(e?.message||e);alert('Match awards Save হয়নি.\n\n'+(e?.message||e));}
  finally{if(btn){btn.disabled=false;btn.textContent='Save All Match Awards';}}
}
async function loadSaved(){
  const season=n($('season').value||2026);const s=await getDoc(doc(db,'tournaments',String(season)));const a=s.exists()?s.data().awards||{}:{};
  $('saved').innerHTML=Object.keys(a).length?Object.entries(a).map(([k,v])=>`<div class="award-row"><b>${esc(awardLabels[k]||k)}</b> — ${esc(v.playerName||players.find(p=>p.id===v.playerId)?.name||'—')} <span class="muted">${esc(v.note||'')}</span></div>`).join(''):'<div class="empty">এই season-এ এখনও কোনো tournament award save করা হয়নি।</div>';
}
async function calculate(){const season=n($('season').value||2026);$('calcMsg').textContent='Record গণনা হচ্ছে…';try{const data=await getSeasonData(season);seasonStats=data.by;showRecommendations(calculateRecommendations(data));}catch(e){console.error(e);$('calcMsg').textContent='Record গণনা করতে সমস্যা হয়েছে: '+e.message;}}
async function saveAll(){
  if(!await requireAdmin())return;
  const btn=$('saveAllBtn');if(btn){btn.disabled=true;btn.textContent='Saving…';}
  setSaveMessage('Award save হচ্ছে…');
  try{
    const season=n($('season').value||2026);
    if(!Object.keys(recommendations||{}).length)await calculate();
    const snap=await getDoc(doc(db,'tournaments',String(season)));
    const awardsData=snap.exists()?{...(snap.data().awards||{})}:{};
    let count=0;
    awards.forEach(id=>{const pid=$(id)?.value;if(pid){const p=players.find(x=>x.id===pid);awardsData[id]={playerId:pid,playerName:p?.name||'',note:$(`${id}Note`)?.value.trim()||'Automatic record-based recommendation',metrics:candidateText(id,recommendations[id]),savedAt:new Date().toISOString()};count++;}});
    if(!count)throw new Error('কোনো award player নির্বাচন করা হয়নি। আগে Calculate Awards চাপুন।');
    await setDoc(doc(db,'tournaments',String(season)),{season,awards:awardsData},{merge:true});
    await loadSaved();setSaveMessage(`✓ ${count}টি tournament award Firebase-এ save হয়েছে।`);
  }catch(e){console.error('Save All Awards failed:',e);setSaveMessage('Save হয়নি: '+(e?.message||e),true);alert('Award Save হয়নি.\n\n'+(e?.message||e));}
  finally{if(btn){btn.disabled=false;btn.textContent='Save All Awards';}}
}
$('calculateBtn').onclick=calculate;$('saveAllBtn').onclick=saveAll;$('calculateMatchesBtn').onclick=calculateMatches;$('saveMatchesBtn').onclick=saveMatches;
$('adminLoginBtn').onclick=async()=>{const email=$('adminEmail').value.trim(),password=$('adminPassword').value;$('adminLoginMsg').textContent='Login হচ্ছে…';try{await signInWithEmailAndPassword(auth,email,password);$('adminLoginMsg').textContent='Login সফল।';}catch(e){$('adminLoginMsg').textContent='Login হয়নি: '+(e?.message||e);}};
$('season').onchange=async()=>{recommendations={};matchRecommendations=[];if(auth.currentUser&&isAdmin(auth.currentUser))await loadSaved();$('matchAwardsList').innerHTML='';$('calcMsg').textContent='';$('matchMsg').textContent='';setSaveMessage('');};
onAuthStateChanged(auth,async u=>{user=u;const ok=!!u&&isAdmin(u);setAdminUI(ok);if(ok){try{await loadPlayers();populateSelects();awards.forEach(bindAwardComparison);await loadSaved();}catch(e){console.error(e);setSaveMessage('Admin panel load হয়নি: '+(e?.message||e),true);}}else{setSaveMessage('Admin login করলে award save করা যাবে।');}});
