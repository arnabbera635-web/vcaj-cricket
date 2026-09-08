import {auth,db,isAdmin,collection,getDocs,doc,getDoc,setDoc,onAuthStateChanged} from './firebase.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let players=[],user=null,recommendations={};

const awards=['bestBatsman','bestBowler','bestKeeper','bestFielder','playerOfTournament'];
const awardLabels={bestBatsman:'Best Batsman',bestBowler:'Best Bowler',bestKeeper:'Best Wicketkeeper',bestFielder:'Best Fielder',playerOfTournament:'Player of the Tournament'};

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
  awards.concat(['manOfMatch']).forEach(id=>{
    if(!$(`${id}`))return;
    $(`${id}`).innerHTML='<option value="">Player নির্বাচন</option>'+players.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  });
}

async function getSeasonData(season){
  const ms=await getDocs(collection(db,'matches'));
  const matches=ms.docs.map(d=>({id:d.id,...d.data()})).filter(m=>n(m.season)===n(season));
  const by={};
  const matchRows=[];
  for(const m of matches){
    const evs=await getDocs(collection(db,'matches',m.id,'events'));
    const per={};
    evs.docs.forEach(d=>{
      const e=d.data();
      const ids=[];
      if(e.strikerId)ids.push(['batter',e.strikerId,e.batterName||'']);
      if(e.bowlerId)ids.push(['bowler',e.bowlerId,e.bowlerName||'']);
      if(e.fielderId)ids.push(['fielder',e.fielderId,e.fielderName||'']);
      ids.forEach(([role,id,name])=>{ensure(by,id,name);ensure(per,id,name);});
      if(e.strikerId){const x=ensure(by,e.strikerId,e.batterName),q=ensure(per,e.strikerId,e.batterName);x.runs+=n(e.batterRuns);x.balls+=e.legal?1:0;x.fours+=e.batterRuns===4?1:0;x.sixes+=e.batterRuns===6?1:0;x.matches.add(m.id);q.runs+=n(e.batterRuns);q.balls+=e.legal?1:0;q.fours+=e.batterRuns===4?1:0;q.sixes+=e.batterRuns===6?1:0;q.matches.add(m.id);}
      if(e.bowlerId){const x=ensure(by,e.bowlerId,e.bowlerName),q=ensure(per,e.bowlerId,e.bowlerName);x.bowlingBalls+=e.legal?1:0;x.bowlingRuns+=n(e.bowlerRuns);x.wickets+=e.bowlerWicket?1:0;x.matches.add(m.id);q.bowlingBalls+=e.legal?1:0;q.bowlingRuns+=n(e.bowlerRuns);q.wickets+=e.bowlerWicket?1:0;q.matches.add(m.id);}
      if(e.fielderId){const x=ensure(by,e.fielderId,e.fielderName),q=ensure(per,e.fielderId,e.fielderName);const c=e.dismissalType==='caught'?1:0,s=e.dismissalType==='stumped'?1:0,r=e.dismissalType==='runOut'?1:0;x.catches+=c;x.stumpings+=s;x.runOuts+=r;x.matches.add(m.id);q.catches+=c;q.stumpings+=s;q.runOuts+=r;q.matches.add(m.id);}
    });
    Object.values(per).forEach(x=>x.matchScores.push({matchId:m.id,title:m.title||`${m.team1Name||''} vs ${m.team2Name||''}`,stage:m.stageName||m.stage||'',points:performancePoints(x),runs:x.runs,wickets:x.wickets,catches:x.catches,stumpings:x.stumpings,runOuts:x.runOuts}));
    matchRows.push({id:m.id,title:m.title||`${m.team1Name||''} vs ${m.team2Name||''}`,stage:m.stageName||m.stage||'',status:m.status||'',players:per});
  }
  return {matches,by,matchRows};
}

function performancePoints(x){
  return n(x.runs)+n(x.fours)*1+n(x.sixes)*2+n(x.wickets)*20+n(x.catches)*8+n(x.stumpings)*10+n(x.runOuts)*12;
}
function playerName(id,x){return x?.name||players.find(p=>p.id===id)?.name||id}
function top(arr,cmp){return arr.filter(Boolean).sort(cmp)[0]||null}

function calculateRecommendations(data){
  const all=Object.values(data.by).map(x=>({...x,matchCount:x.matches.size}));
  const bats=top(all.filter(x=>x.balls>0),(a,b)=>b.runs-a.runs||strikeRate(b)-strikeRate(a)||b.sixes-a.sixes||b.fours-a.fours);
  const bowl=top(all.filter(x=>x.bowlingBalls>0),(a,b)=>b.wickets-a.wickets||economy(a)-economy(b)||b.bowlingBalls-a.bowlingBalls);
  const keep=top(all.filter(x=>x.stumpings>0||x.catches>0),(a,b)=>((b.stumpings*4+b.catches*2)-(a.stumpings*4+a.catches*2))||b.stumpings-a.stumpings||b.catches-a.catches);
  const field=top(all.filter(x=>x.catches>0||x.runOuts>0),(a,b)=>((b.catches*2+b.runOuts*3)-(a.catches*2+a.runOuts*3))||b.runOuts-a.runOuts||b.catches-a.catches);
  const tournament=top(all,(a,b)=>{
    const sa=performancePoints(a)+strikeRate(a)*0.25+n(a.wickets)*4+n(a.catches)*2+n(a.runOuts)*3;
    const sb=performancePoints(b)+strikeRate(b)*0.25+n(b.wickets)*4+n(b.catches)*2+n(b.runOuts)*3;
    return sb-sa||b.runs-a.runs;
  });
  const motm=[];
  data.matchRows.forEach(m=>{
    const p=top(Object.values(m.players),(a,b)=>performancePoints(b)-performancePoints(a)||b.runs-a.runs||b.wickets-a.wickets);
    if(p)motm.push({matchId:m.id,title:m.title,stage:m.stage,playerId:p.id,playerName:playerName(p.id,p),points:performancePoints(p),runs:p.runs,wickets:p.wickets,catches:p.catches,stumpings:p.stumpings,runOuts:p.runOuts});
  });
  return {bestBatsman:bats,bestBowler:bowl,bestKeeper:keep,bestFielder:field,playerOfTournament:tournament,motm};
}

function candidateText(id,x){
  if(!x)return 'কোনও পর্যাপ্ত record পাওয়া যায়নি।';
  if(id==='bestBatsman')return `${playerName(x.id,x)} — ${x.runs} runs, SR ${strikeRate(x).toFixed(1)}, ${x.fours}×4, ${x.sixes}×6`;
  if(id==='bestBowler')return `${playerName(x.id,x)} — ${x.wickets} wickets, ${overs(x.bowlingBalls)} overs, economy ${economy(x).toFixed(2)}`;
  if(id==='bestKeeper')return `${playerName(x.id,x)} — ${x.stumpings} stumpings, ${x.catches} catches`;
  if(id==='bestFielder')return `${playerName(x.id,x)} — ${x.catches} catches, ${x.runOuts} run-outs`;
  return `${playerName(x.id,x)} — ${x.runs} runs, ${x.wickets} wickets, ${x.catches} catches, ${x.stumpings} stumpings, ${x.runOuts} run-outs`;
}

function showRecommendations(r){
  recommendations=r;
  awards.forEach(id=>{
    const x=r[id];
    if($(id))$(id).value=x?.id||'';
    const box=$(`${id}Recommendation`);if(box)box.innerHTML=x?`<b>Automatic recommendation:</b> ${esc(candidateText(id,x))}`:'<span class="muted">পর্যাপ্ত record নেই।</span>';
  });
  const box=$('motmList');
  if(box)box.innerHTML=r.motm?.length?r.motm.map((m,i)=>`<div class="award-row"><b>${i+1}. ${esc(m.title)}</b><br>${esc(m.playerName)} — ${m.points} performance points <span class="muted">(${m.runs} R, ${m.wickets} W, C ${m.catches}, St ${m.stumpings}, RO ${m.runOuts})</span></div>`).join(''):'<div class="empty">এই season-এ match event record নেই।</div>';
  $('calcMsg').textContent=`${r.motm?.length||0} ম্যাচের record বিশ্লেষণ করা হয়েছে।`;
}

async function calculate(){
  const season=n($('season').value||2026);$('calcMsg').textContent='Record গণনা হচ্ছে…';
  try{const data=await getSeasonData(season);showRecommendations(calculateRecommendations(data));}catch(e){console.error(e);$('calcMsg').textContent='Record গণনা করতে সমস্যা হয়েছে: '+e.message;}
}

async function loadSaved(){
  const season=n($('season').value||2026);const s=await getDoc(doc(db,'tournaments',String(season)));const a=s.exists()?s.data().awards||{}:{};
  $('saved').innerHTML=Object.keys(a).length?Object.entries(a).map(([k,v])=>`<div class="award-row"><b>${esc(awardLabels[k]||k)}</b> — ${esc(v.playerName||players.find(p=>p.id===v.playerId)?.name||'—')} <span class="muted">${esc(v.note||'')}</span></div>`).join(''):'<div class="empty">এই season-এ এখনও কোনো award save করা হয়নি।</div>';
}

async function saveAll(){
  if(!isAdmin(user)){alert('Admin login প্রয়োজন।');return;}
  const season=n($('season').value||2026);const snap=await getDoc(doc(db,'tournaments',String(season)));const awardsData=snap.exists()?snap.data().awards||{}:{};
  awards.forEach(id=>{const pid=$(id)?.value;if(pid){const p=players.find(x=>x.id===pid);awardsData[id]={playerId:pid,playerName:p?.name||'',note:$(`${id}Note`)?.value.trim()||'Automatic record-based recommendation',metrics:candidateText(id,recommendations[id]),savedAt:new Date().toISOString()};}});
  await setDoc(doc(db,'tournaments',String(season)),{season,awards:awardsData},{merge:true});
  await loadSaved();$('saveMsg').textContent='Season awards Save হয়েছে।';
}

async function load(){await loadPlayers();populateSelects();await loadSaved();}
$('calculateBtn').onclick=calculate;$('saveAllBtn').onclick=saveAll;$('season').onchange=async()=>{recommendations={};await loadSaved();$('motmList').innerHTML='';$('calcMsg').textContent='';};
onAuthStateChanged(auth,async u=>{user=u;await load();});
