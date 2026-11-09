import {db,collection,doc,getDoc,onSnapshot,getDocs} from './firebase.js';
import {snapOnce} from './vcaj-cache.js';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),n=v=>Number(v)||0;
let matches=[],players=[];
function teamNames(){return [...new Set(matches.flatMap(m=>[m.team1Name,m.team2Name]).filter(Boolean))].sort()}
function fillH(){const o='<option value="">— দল —</option>'+teamNames().map(t=>`<option>${esc(t)}</option>`).join(''),a=$('ha').value,b=$('hb').value;$('ha').innerHTML=o;$('hb').innerHTML=o;$('ha').value=a;$('hb').value=b;h2h()}
function h2h(){const A=$('ha').value,B=$('hb').value;if(!A||!B||A===B){$('h2h').textContent='দুটো আলাদা দল বেছে নিন';return}const ms=matches.filter(m=>m.status==='COMPLETED'&&((m.team1Name===A&&m.team2Name===B)||(m.team1Name===B&&m.team2Name===A))),wa=ms.filter(m=>m.winnerTeamName===A).length,wb=ms.filter(m=>m.winnerTeamName===B).length;$('h2h').innerHTML=ms.length?`<div class="cmp row"><span class="${wa>wb?'w':''}">${wa}</span><small>জয় (${ms.length} ম্যাচে)</small><span class="${wb>wa?'w':''}">${wb}</span></div>`+ms.map(m=>`<div class="res"><span><b>${esc(m.team1Name)} vs ${esc(m.team2Name)}</b><br><small class="muted">${esc(m.stageName||'')} • ${esc(m.resultText||'')}</small></span></div>`).join(''):'এই দুই দলের মধ্যে এখনও কোনো ম্যাচ শেষ হয়নি।'}

function render(){
 const done=matches.filter(m=>m.status==='COMPLETED'),T={};
 done.forEach(m=>{[m.team1Name,m.team2Name].filter(Boolean).forEach(t=>{T[t]||={p:0,w:0};T[t].p++});const w=m.winnerTeamName;if(w&&T[w])T[w].w++});
 const rows=Object.entries(T).map(([k,v])=>({k,...v,l:v.p-v.w,pct:v.p?Math.round(v.w*100/v.p):0})).sort((a,b)=>b.w-a.w||b.pct-a.pct);
 $('teams').innerHTML=rows.map((r,i)=>`<div><div class="row"><span><b>${i+1}. ${esc(r.k)}</b></span><span>P ${r.p} • W ${r.w} • L ${r.l} • <b>${r.pct}%</b></span></div><div class="bar"><i style="width:${r.pct}%"></i></div></div>`).join('')||'<div class="empty">এখনও কোনো ম্যাচ শেষ হয়নি।</div>';
 const runs=players.reduce((a,p)=>a+n(p.totalRuns),0),wk=players.reduce((a,p)=>a+n(p.totalWickets),0),six=players.reduce((a,p)=>a+n(p.totalSixes),0);
 $('tiles').innerHTML=[[matches.length,'মোট ম্যাচ'],[done.length,'সম্পন্ন'],[players.length,'খেলোয়াড়'],[runs,'মোট রান'],[wk,'মোট উইকেট']].concat(six?[[six,'মোট ছক্কা']]:[]).map(x=>`<div class="tile"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('');
 const top=(k,u)=>[...players].filter(p=>n(p[k])>0).sort((a,b)=>n(b[k])-n(a[k])).slice(0,5),mx=k=>Math.max(1,...players.map(p=>n(p[k])));
 const list=(k,u)=>top(k).map((p,i)=>`<div><div class="row"><span><b>${i+1}. <a href="player-profile.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></b><br><small class="muted">${esc(p.teamName||'')}</small></span><strong>${n(p[k])} ${u}</strong></div><div class="bar"><i style="width:${n(p[k])*100/mx(k)}%"></i></div></div>`).join('')||'<div class="empty">ডেটা নেই</div>';
 $('runs').innerHTML=list('totalRuns','runs');$('wkts').innerHTML=list('totalWickets','wkts');
 const rec=[...done].sort((a,b)=>String(b.updatedAt?.seconds||'').localeCompare(String(a.updatedAt?.seconds||''))).slice(0,6);
 $('results').innerHTML=rec.map(m=>{const t=`🏏 ${m.team1Name||''} vs ${m.team2Name||''} — ${m.resultText||m.winnerTeamName+' won'}`;return `<div class="res"><span><b>${esc(m.team1Name||'')} vs ${esc(m.team2Name||'')}</b><br><small class="muted">${esc(m.stageName||'')} • ${esc(m.resultText||(m.winnerTeamName?m.winnerTeamName+' won':''))}</small></span><a href="https://wa.me/?text=${encodeURIComponent(t+'\n'+location.origin+location.pathname.replace('stats.html','live.html')+'?match='+encodeURIComponent(m.id))}" target="_blank" rel="noopener"><button class="secondary">📤 WhatsApp</button></a></div>`}).join('')||'<div class="empty">ফলাফল নেই</div>';
}
function fillCompare(){const opt='<option value="">— খেলোয়াড় —</option>'+[...players].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(p=>`<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.teamName||'')})</option>`).join('');const a=$('pa').value,b=$('pb').value;$('pa').innerHTML=opt;$('pb').innerHTML=opt;$('pa').value=a;$('pb').value=b;cmp()}
function cmp(){const A=players.find(p=>p.id===$('pa').value),B=players.find(p=>p.id===$('pb').value);if(!A||!B){$('cmp').textContent='দুইজন খেলোয়াড় বেছে নিন';return}
 const f=[['totalRuns','রান'],['totalWickets','উইকেট'],['fieldingDismissals','ফিল্ডিং আউট'],['totalFours','চার'],['totalSixes','ছক্কা']];
 $('cmp').innerHTML=f.map(([k,l])=>{const x=n(A[k]),y=n(B[k]);return `<div class="cmp row"><span class="${x>y?'w':''}">${x}</span><small>${l}</small><span class="${y>x?'w':''}">${y}</span></div>`}).join('')}
$('ha').onchange=h2h;$('hb').onchange=h2h;$('pa').onchange=cmp;$('pb').onchange=cmp;
snapOnce(db,getDocs,collection,'matches',s=>{matches=s.docs.map(d=>({id:d.id,...d.data()}));render();fillH()},()=>{$('teams').textContent='ডেটা লোড হয়নি'});
snapOnce(db,getDocs,collection,'players',s=>{players=s.docs.map(d=>({id:d.id,...d.data()}));render();fillCompare()},()=>{});
getDoc(doc(db,'tournaments','2026')).then(s=>{const id=s.exists()&&s.data().championTeamId;if(!id)return;getDocs(collection(db,'teams')).then(t=>{const x=t.docs.find(d=>d.id===id);if(x)$('champ').innerHTML=`<div class="champ">🏆 চ্যাম্পিয়ন: ${esc(x.data().name)}</div>`})}).catch(()=>{});
