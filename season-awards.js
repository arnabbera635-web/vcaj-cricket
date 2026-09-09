import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getFirestore, doc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const seasonEl = document.getElementById('season');
const statusEl = document.getElementById('status');
const awardsEl = document.getElementById('tournamentAwards');
const matchesEl = document.getElementById('matchesList');

const AWARDS = [
  ['bestBatsman', '🏏 Best Batsman'],
  ['bestBowler', '🎯 Best Bowler'],
  ['bestKeeper', '🧤 Best Wicketkeeper'],
  ['bestFielder', '🏃 Best Fielder'],
  ['playerOfTournament', '🏆 Player of the Tournament']
];

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
}

function prettyMetric(value) {
  if (value === undefined || value === null || value === '') return '';
  return String(value);
}

function awardCard(key, label, award) {
  if (!award || typeof award !== 'object') {
    return `<article class="award-card"><div class="muted">${esc(label)}</div><div class="empty">এখনও Award save করা হয়নি।</div></article>`;
  }

  // Admin save structure: playerId, playerName, metric, note, savedAt.
  // Prefer the saved playerName so Public always shows exactly what Admin selected.
  const name = award.playerName || award.player || award.name || award.playerId || 'নাম পাওয়া যায়নি';
  const metric = prettyMetric(award.metric);
  const note = prettyMetric(award.note);
  const saved = award.savedAt?.toDate ? award.savedAt.toDate().toLocaleString('en-IN') : prettyMetric(award.savedAt);

  return `<article class="award-card">
    <div class="metric">${esc(label)}</div>
    <div class="winner">${esc(name)}</div>
    ${metric ? `<div class="metric"><b>Record:</b> ${esc(metric)}</div>` : ''}
    ${note ? `<div class="recommend">${esc(note)}</div>` : ''}
    ${saved ? `<div class="metric">Saved: ${esc(saved)}</div>` : ''}
  </article>`;
}

async function loadTournamentAwards(season) {
  awardsEl.innerHTML = '<div class="empty">Award loading…</div>';

  const snap = await getDoc(doc(db, 'tournaments', String(season)));
  if (!snap.exists()) {
    awardsEl.innerHTML = '<div class="empty">এই season-এর tournament document পাওয়া যায়নি।</div>';
    return;
  }

  const data = snap.data() || {};
  const awards = data.awards || {};

  // Directly render the exact saved awards map from tournaments/{season}.
  awardsEl.innerHTML = AWARDS.map(([key, label]) => awardCard(key, label, awards[key])).join('');
  statusEl.textContent = `Season ${season} • Admin-এর saved awards দেখানো হচ্ছে`;
}

function matchAwardValue(match) {
  return match.award || match.awards || match.matchAward || null;
}

function matchTitle(match, id) {
  const a = match.teamA || match.battingTeam || match.homeTeam || 'Team A';
  const b = match.teamB || match.bowlingTeam || match.awayTeam || 'Team B';
  return match.title || `${a} vs ${b}` || id;
}

function renderMatchAward(match, id) {
  const awards = matchAwardValue(match);
  if (!awards) return '';
  const items = [];
  if (typeof awards === 'string') items.push(`<div class="mini-award"><b>🏅 Award</b>${esc(awards)}</div>`);
  else if (typeof awards === 'object') {
    for (const [k, v] of Object.entries(awards)) {
      if (v && typeof v === 'object') {
        const n = v.playerName || v.player || v.name || v.playerId;
        if (n) items.push(`<div class="mini-award"><b>${esc(k)}</b>${esc(n)}</div>`);
      } else if (v) {
        items.push(`<div class="mini-award"><b>${esc(k)}</b>${esc(v)}</div>`);
      }
    }
  }
  if (!items.length) return '';
  return `<article class="match-card"><div class="match-head"><h3>${esc(matchTitle(match,id))}</h3><div class="muted">${esc(match.stage || '')}</div></div><div class="match-awards">${items.join('')}</div></article>`;
}

async function loadMatchAwards(season) {
  matchesEl.innerHTML = '<div class="empty">Match-wise awards loading…</div>';
  try {
    const snap = await getDocs(collection(db, 'matches'));
    const rows = [];
    snap.forEach(s => {
      const d = s.data() || {};
      if (String(d.season ?? d.seasonId ?? '') !== String(season)) return;
      const html = renderMatchAward(d, s.id);
      if (html) rows.push(html);
    });
    matchesEl.innerHTML = rows.length ? rows.join('') : '<div class="empty">এই season-এর match-wise saved awards নেই।</div>';
  } catch (err) {
    matchesEl.innerHTML = `<div class="empty">Match-wise awards load হয়নি। Tournament awards উপরে দেখা যাবে।</div>`;
  }
}

async function loadAll() {
  const season = seasonEl.value;
  statusEl.textContent = 'Loading…';
  try {
    // Tournament awards are intentionally independent of match/event queries.
    await loadTournamentAwards(season);
    await loadMatchAwards(season);
  } catch (err) {
    console.error('Public awards load error:', err);
    statusEl.textContent = 'Award load করতে সমস্যা হয়েছে।';
    awardsEl.innerHTML = `<div class="empty">Award load হয়নি: ${esc(err?.message || err)}</div>`;
  }
}

seasonEl.addEventListener('change', loadAll);
loadAll();
