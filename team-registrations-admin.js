import {db,auth,collection,doc,getDocs,writeBatch,serverTimestamp} from "./firebase.js";

const $ = id => document.getElementById(id);
let registrations = [];

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));
const money = value => "₹" + Number(value || 0).toLocaleString("en-IN");
const pick = (obj, ...keys) => {
  for (const key of keys) if (obj?.[key] !== undefined && obj?.[key] !== null) return obj[key];
  return "";
};
function dateText(value) {
  if (!value) return "—";
  if (value?.seconds) return new Date(value.seconds * 1000).toLocaleString("en-IN");
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("en-IN");
}
function statusLabel(status) {
  const s = String(status || "pending").toLowerCase();
  return s === "verified" || s === "approved" ? "VERIFIED" : s === "rejected" ? "REJECTED" : "PENDING";
}
function paymentData(item) {
  const entry = item.entryFee || {};
  const kasan = item.kasanmani || {};
  const entryTotal = Number(entry.total ?? 3501);
  const kasanTotal = Number(kasan.total ?? 1500);
  const entryPaid = Number(entry.paid || 0);
  const kasanPaid = Number(kasan.paid || 0);
  return {
    entry, kasan, entryTotal, kasanTotal, entryPaid, kasanPaid,
    entryDue: Number(entry.due ?? Math.max(0, entryTotal - entryPaid)),
    kasanDue: Number(kasan.due ?? Math.max(0, kasanTotal - kasanPaid)),
    totalPaid: Number(item.totalPaid ?? entryPaid + kasanPaid),
    totalDue: Number(item.totalDue ?? Math.max(0, entryTotal-entryPaid) + Math.max(0, kasanTotal-kasanPaid))
  };
}

async function load() {
  const msg = $("registrationMsg");
  if (msg) msg.textContent = "Registration লোড হচ্ছে…";
  try {
    const snap = await getDocs(collection(db, "teamRegistrations"));
    registrations = snap.docs.map(d => ({id:d.id, ...d.data()})).sort((a,b) => {
      const av = a.submittedAt?.seconds || a.createdAt?.seconds || 0;
      const bv = b.submittedAt?.seconds || b.createdAt?.seconds || 0;
      return bv - av;
    });
    render();
    if (msg) msg.textContent = `${registrations.length}টি registration লোড হয়েছে।`;
  } catch (error) {
    if (msg) msg.textContent = `লোড করা যায়নি: ${error.message}`;
  }
}

function render() {
  const query = String($("search")?.value || "").trim().toLowerCase();
  const status = String($("statusFilter")?.value || "").toLowerCase();
  const paidFilter = String($("paidFilter")?.value || "").toLowerCase();
  const tbody = $("rows");
  if (!tbody) return;

  const list = registrations.filter(item => {
    const p = paymentData(item);
    const searchable = [item.teamName, item.name, item.uniqueId, item.whatsapp, item.phone, item.location, item.id]
      .join(" ").toLowerCase();
    if (query && !searchable.includes(query)) return false;
    if (status && String(item.status || "pending").toLowerCase() !== status) return false;
    if (paidFilter === "due" && p.totalDue <= 0) return false;
    if (paidFilter === "paid" && p.totalDue > 0) return false;
    return true;
  });

  tbody.innerHTML = list.length ? list.map(item => {
    const p = paymentData(item);
    return `<tr>
      <td>${esc(item.uniqueId || item.id)}<br><small>${esc(dateText(item.submittedAt || item.createdAt))}</small></td>
      <td><strong>${esc(item.teamName || item.name || "—")}</strong><br><small>${esc(item.location || "")}</small></td>
      <td>${esc(item.whatsapp || item.phone || "—")}<br><small>${esc(item.contact || item.captainName || "")}</small></td>
      <td>${money(p.entryPaid)} / ${money(p.entryTotal)}<br><small>বাকি: ${money(p.entryDue)}</small></td>
      <td>${money(p.kasanPaid)} / ${money(p.kasanTotal)}<br><small>বাকি: ${money(p.kasanDue)}</small></td>
      <td><strong>${money(p.totalDue)}</strong><br><small>মোট Paid: ${money(p.totalPaid)}</small></td>
      <td>${esc(statusLabel(item.status))}</td>
      <td>
        <button class="btn btn-light" data-view="${esc(item.id)}">Details</button>
        <button class="btn btn-primary" data-receipt="${esc(item.id)}">Receipt PDF</button>
        ${String(item.status || "pending").toLowerCase() !== "verified" ? `<button class="btn btn-primary" data-verify="${esc(item.id)}">Verify</button>` : ""}
        ${String(item.status || "pending").toLowerCase() !== "rejected" ? `<button class="btn btn-danger" data-reject="${esc(item.id)}">Reject</button>` : ""}
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="8">কোনো registration পাওয়া যায়নি।</td></tr>`;

  tbody.querySelectorAll("[data-view]").forEach(b => b.onclick = () => showDetails(b.dataset.view));
  tbody.querySelectorAll("[data-receipt]").forEach(b => b.onclick = () => generateReceipt(b.dataset.receipt));
  tbody.querySelectorAll("[data-verify]").forEach(b => b.onclick = () => changeStatus(b.dataset.verify, "verified"));
  tbody.querySelectorAll("[data-reject]").forEach(b => b.onclick = () => changeStatus(b.dataset.reject, "rejected"));
}

function showDetails(id) {
  const item = registrations.find(r => r.id === id);
  if (!item) return;
  const p = paymentData(item);
  const history = Array.isArray(item.paymentHistory) ? item.paymentHistory : [];
  $("modalTitle").textContent = `Registration — ${item.teamName || item.name || item.id}`;
  $("detail").innerHTML = `
    <div class="detail-grid">
      <div class="detail"><strong>Team</strong>${esc(item.teamName || item.name || "—")}</div>
      <div class="detail"><strong>Registration ID</strong>${esc(item.uniqueId || item.id)}</div>
      <div class="detail"><strong>WhatsApp</strong>${esc(item.whatsapp || item.phone || "—")}</div>
      <div class="detail"><strong>Location</strong>${esc(item.location || "—")}</div>
      <div class="detail"><strong>Entry Fee</strong>Total ${money(p.entryTotal)} · Paid ${money(p.entryPaid)} · Due ${money(p.entryDue)}</div>
      <div class="detail"><strong>Kasanmani</strong>Total ${money(p.kasanTotal)} · Paid ${money(p.kasanPaid)} · Due ${money(p.kasanDue)}</div>
      <div class="detail"><strong>Total Paid / Due</strong>${money(p.totalPaid)} / ${money(p.totalDue)}</div>
      <div class="detail"><strong>Status</strong>${esc(statusLabel(item.status))}</div>
    </div>
    <h3>Payment History</h3>
    ${history.length ? history.map((h,i) => `<div class="receipt"><strong>${i+1}. ${esc(h.category || h.type || "Payment")}</strong><br>
      Amount: ${money(h.amount ?? h.paid ?? 0)}<br>
      Method: ${esc(h.method || h.mode || "—")}<br>
      Date: ${esc(dateText(h.date || h.paymentDate || h.createdAt))}<br>
      Received by: ${esc(h.receivedBy || "—")}<br>
      ${esc(h.note || "")}</div>`).join("") : `<p>এই registration-এ আলাদা paymentHistory নেই; বর্তমান paid/due summary থেকে voucher তৈরি হবে।</p>`}
    <div class="admin-actions"><button class="btn btn-primary" id="modalReceiptBtn">Receipt PDF</button></div>`;
  $("modalReceiptBtn").onclick = () => generateReceipt(id);
  $("modal").classList.add("open");
}

/* =====================================================================
   RECEIPT VOUCHER (preview on the website + Save as PDF)
   ===================================================================== */
const VOUCHER_CONFIG = {
  orgName: "VIVEKANANDA CRICKET ASSOCIATION OF JELIAKHALI",
  orgShort: "VCAJ",
  tournament: "জেলিয়াখালী “মন্ডল এন্ড মন্ডল” ক্রিকেট টুর্নামেন্ট ২০২৬",
  // false = nothing is written to Firestore (default, same as before).
  // true  = each issued voucher code is also saved in a NEW collection "receiptVouchers"
  //         (needs a Firestore rule that lets the admin create documents there).
  saveVoucherRecord: false
};

/* ---------- unique voucher code ---------- */
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I — easy to read & type

async function digestBytes(text) {
  try {
    if (window.crypto?.subtle) {
      return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
    }
  } catch (_) { /* fall through to the simple hash */ }
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    let h1 = 0xdeadbeef ^ i, h2 = 0x41c6ce57 ^ i;
    for (let k = 0; k < text.length; k++) {
      const ch = text.charCodeAt(k);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    out[i] = (h1 >>> 0) & 255;
  }
  return out;
}

// Same registration + same payments => same code (re-printing never changes it).
// A new payment => a new, different code. Format: VCAJ-RV-XXXX-XXXX-C (C = check character).
async function makeVoucherCode(item, p, history) {
  const ts = v => v?.seconds ?? v ?? "";
  const payload = JSON.stringify([
    item.id, item.uniqueId || "", p.entryPaid, p.kasanPaid, p.totalPaid,
    history.map(h => [h.category || h.type || "", h.amount ?? h.paid ?? 0, ts(h.date || h.paymentDate || h.createdAt)])
  ]);
  const bytes = await digestBytes(payload);
  const chars = Array.from({length: 8}, (_, i) => CODE_ALPHABET[bytes[i] & 31]);
  const check = CODE_ALPHABET[chars.reduce((sum, c, i) => sum + CODE_ALPHABET.indexOf(c) * (i + 1), 0) % 32];
  const body = chars.join("");
  return `VCAJ-RV-${body.slice(0, 4)}-${body.slice(4)}-${check}`;
}

/* ---------- amount in words (Indian system) ---------- */
const W1 = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
const W2 = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
const below100 = n => n < 20 ? W1[n] : W2[Math.floor(n / 10)] + (n % 10 ? " " + W1[n % 10] : "");
const below1000 = n => n < 100 ? below100(n) : W1[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + below100(n % 100) : "");
function rupeesInWords(value) {
  const total = Math.round(Math.max(0, Number(value) || 0) * 100);
  const rupees = Math.floor(total / 100), paise = total % 100;
  if (!rupees && !paise) return "Zero Rupees Only";
  const parts = [];
  const crore = Math.floor(rupees / 1e7), lakh = Math.floor(rupees % 1e7 / 1e5);
  const thousand = Math.floor(rupees % 1e5 / 1e3), rest = rupees % 1e3;
  if (crore) parts.push(below1000(crore) + " Crore");
  if (lakh) parts.push(below100(lakh) + " Lakh");
  if (thousand) parts.push(below100(thousand) + " Thousand");
  if (rest) parts.push(below1000(rest));
  let text = (parts.join(" ") || "Zero") + (rupees === 1 ? " Rupee" : " Rupees");
  if (paise) text += " and " + below100(paise) + " Paise";
  return text + " Only";
}

function payState(p) {
  if (p.totalPaid <= 0) return {label: "UNPAID", stamp: "UNPAID", color: "#b91c1c"};
  if (p.totalDue > 0) return {label: "PARTIALLY PAID", stamp: "PARTIAL", color: "#b45309"};
  return {label: "FULLY PAID", stamp: "PAID", color: "#15803d"};
}

/* ---------- voucher document (HTML) ---------- */
function buildVoucherHtml({item, p, history, code, standalone}) {
  const state = payState(p);
  const grand = p.entryTotal + p.kasanTotal;
  const pct = grand > 0 ? Math.max(0, Math.min(100, Math.round((p.totalPaid / grand) * 100))) : 0;
  const issuedAt = new Date().toLocaleString("en-IN", {dateStyle: "medium", timeStyle: "short"});
  const issuedBy = auth.currentUser?.email || "VCAJ Admin";
  const teamName = item.teamName || item.name || "—";

  const historyRows = history.length ? history.map((h, i) => `
      <tr><td>${i + 1}</td><td>${esc(h.category || h.type || "Payment")}</td><td>${esc(h.method || h.mode || "—")}</td>
      <td>${esc(dateText(h.date || h.paymentDate || h.createdAt))}</td><td>${esc(h.receivedBy || "—")}</td>
      <td class="num paid">${money(h.amount ?? h.paid ?? 0)}</td></tr>`).join("")
    : `<tr><td>1</td><td>Entry Fee + Kasanmani <small>(current summary)</small></td>
      <td>${esc(p.entry.paymentMethod || p.kasan.paymentMethod || "—")}</td>
      <td>${esc(p.entry.paymentDate || p.kasan.paymentDate || "—")}</td>
      <td>${esc(p.entry.receivedBy || p.kasan.receivedBy || issuedBy)}</td>
      <td class="num paid">${money(p.totalPaid)}</td></tr>`;

  const actions = standalone
    ? `<div class="actions"><button onclick="window.print()">⬇ Print / Save as PDF</button></div>` : "";

  return `<!doctype html><html lang="bn"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(code)} - Payment Receipt Voucher</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Noto+Sans+Bengali:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root{--navy:#0b2447;--navy2:#19376d;--gold:#c9a227;--ink:#172033;--muted:#64748b;--line:#dbe3ee;--soft:#f5f8fc;--state:${state.color}}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0}
body{font-family:Inter,'Noto Sans Bengali','Segoe UI',Arial,sans-serif;color:var(--ink);background:#e8edf4;font-size:13px;line-height:1.45}
.page{padding:16px}
.sheet{position:relative;max-width:820px;margin:0 auto;background:#fff;border:2px solid var(--navy);overflow:hidden;box-shadow:0 10px 30px rgba(11,36,71,.18)}
.sheet::after{content:"";position:absolute;inset:6px;border:1px solid var(--gold);pointer-events:none;z-index:3}
.wm{position:absolute;top:52%;left:50%;transform:translate(-50%,-50%) rotate(-24deg);font-size:120px;font-weight:900;letter-spacing:10px;color:var(--state);opacity:.07;pointer-events:none;white-space:nowrap;z-index:0}
.head{position:relative;z-index:1;background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;padding:22px 28px;display:flex;gap:16px;align-items:center}
.logo{width:64px;height:64px;border-radius:50%;border:3px solid var(--gold);display:grid;place-items:center;font-weight:800;font-size:15px;letter-spacing:.5px;color:var(--gold);background:rgba(255,255,255,.07);flex:none}
.org h1{margin:0;font-size:17px;letter-spacing:.6px;line-height:1.25}
.org p{margin:5px 0 0;font-size:12px;opacity:.9}
.badge{margin-left:auto;text-align:right;flex:none}
.badge b{display:block;font-size:10px;letter-spacing:2px;color:var(--gold)}
.badge span{font-size:15px;font-weight:800;letter-spacing:1px}
.body{position:relative;z-index:1;padding:22px 30px 26px}
.title{text-align:center;margin:0 0 16px}
.title h2{margin:0;font-size:20px;letter-spacing:2px;color:var(--navy)}
.title .rule{width:90px;height:3px;background:var(--gold);margin:8px auto 0;border-radius:3px}
.codebox{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border:1.5px dashed var(--navy2);background:var(--soft);border-radius:10px;padding:12px 16px;margin-bottom:16px}
.codebox small{display:block;font-size:10px;letter-spacing:1.6px;color:var(--muted);font-weight:700}
.codebox .code{font-family:'Courier New',ui-monospace,monospace;font-size:23px;font-weight:800;letter-spacing:2px;color:var(--navy)}
.codebox .hint{font-size:11px;color:var(--muted);max-width:230px;text-align:right}
.pill{display:inline-block;padding:3px 11px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.8px;color:#fff;background:var(--state)}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 14px;margin-bottom:6px}
.field{border:1px solid var(--line);border-radius:8px;padding:8px 11px;background:#fff}
.field small{display:block;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);font-weight:700}
.field b{font-size:14px;word-break:break-word}
h3.sec{margin:18px 0 8px;font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:var(--navy);display:flex;align-items:center;gap:8px}
h3.sec::after{content:"";flex:1;height:1px;background:var(--line)}
.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th,td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
thead th{background:var(--navy);color:#fff;font-size:11px;letter-spacing:.8px;text-transform:uppercase}
th.num,td.num{text-align:right;white-space:nowrap}
tbody tr:nth-child(even) td{background:var(--soft)}
tfoot td{font-weight:800;background:#eaf1fb;border-top:2px solid var(--navy)}
tr{page-break-inside:avoid}
.paid{color:#15803d;font-weight:700}.due{color:#b91c1c;font-weight:700}
.progress{margin:14px 0 4px;height:10px;border-radius:99px;background:#e2e8f0;overflow:hidden}
.progress i{display:block;height:100%;width:${pct}%;background:linear-gradient(90deg,#16a34a,#22c55e)}
.pt{display:flex;justify-content:space-between;font-size:11px;color:var(--muted)}
.received{display:flex;gap:12px;flex-wrap:wrap;margin-top:14px}
.card{flex:1 1 220px;border-radius:10px;padding:12px 14px;border:1px solid var(--line)}
.card.g{background:#f0fdf4;border-color:#bbf7d0}.card.r{background:#fef2f2;border-color:#fecaca}
.card small{display:block;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted);font-weight:700}
.card b{font-size:21px}.card.g b{color:#15803d}.card.r b{color:#b91c1c}
.words{margin-top:12px;font-size:12px;padding:9px 12px;background:var(--soft);border-left:4px solid var(--gold);border-radius:4px}
.sign{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:46px}
.sign div{border-top:1px solid #64748b;padding-top:6px;text-align:center;font-size:11.5px;color:var(--muted)}
.foot{margin-top:22px;padding-top:12px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:10.5px;color:var(--muted)}
.foot b{color:var(--navy)}
.actions{text-align:center;margin:18px 0 6px}
.actions button{padding:12px 22px;background:var(--navy);color:#fff;border:0;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer}
@media(max-width:640px){
  .page{padding:8px}.head{flex-wrap:wrap;padding:16px}.badge{margin-left:0;text-align:left;width:100%}
  .body{padding:16px}.grid{grid-template-columns:1fr}.codebox .code{font-size:18px;letter-spacing:1px}.codebox .hint{text-align:left;max-width:none}
  .wm{font-size:64px}.sign{gap:24px}.org h1{font-size:14px}
}
@media print{
  @page{size:A4;margin:0}
  html,body{background:#fff}.page{padding:0}
  .sheet{max-width:none;margin:0;box-shadow:none;min-height:296mm}
  .actions{display:none}
}
</style></head><body><div class="page"><main class="sheet">
<div class="wm">${esc(state.stamp)}</div>
<header class="head">
  <div class="logo">${esc(VOUCHER_CONFIG.orgShort)}</div>
  <div class="org"><h1>${esc(VOUCHER_CONFIG.orgName)}</h1><p>${esc(VOUCHER_CONFIG.tournament)}</p></div>
  <div class="badge"><b>OFFICIAL</b><span>PAYMENT VOUCHER</span></div>
</header>
<div class="body">
  <div class="title"><h2>PAYMENT RECEIPT VOUCHER</h2><div class="rule"></div></div>

  <div class="codebox">
    <div><small>UNIQUE VOUCHER CODE</small><div class="code">${esc(code)}</div></div>
    <div class="hint">Quote this code to the organisers to verify this receipt.<br>Issued: ${esc(issuedAt)}</div>
  </div>

  <div class="grid">
    <div class="field"><small>Team Name</small><b>${esc(teamName)}</b></div>
    <div class="field"><small>Registration ID</small><b>${esc(item.uniqueId || item.id)}</b></div>
    <div class="field"><small>WhatsApp</small><b>${esc(item.whatsapp || item.phone || "—")}</b></div>
    <div class="field"><small>Location</small><b>${esc(item.location || "—")}</b></div>
    <div class="field"><small>Registration Status</small><b>${esc(statusLabel(item.status))}</b></div>
    <div class="field"><small>Payment Status</small><span class="pill">${esc(state.label)}</span></div>
  </div>

  <h3 class="sec">Payment Summary</h3>
  <div class="tw"><table>
    <thead><tr><th>Particulars</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Due</th></tr></thead>
    <tbody>
      <tr><td>Entry Fee</td><td class="num">${money(p.entryTotal)}</td><td class="num paid">${money(p.entryPaid)}</td><td class="num due">${money(p.entryDue)}</td></tr>
      <tr><td>Kasanmani / Security Deposit</td><td class="num">${money(p.kasanTotal)}</td><td class="num paid">${money(p.kasanPaid)}</td><td class="num due">${money(p.kasanDue)}</td></tr>
    </tbody>
    <tfoot><tr><td>Total</td><td class="num">${money(grand)}</td><td class="num">${money(p.totalPaid)}</td><td class="num">${money(p.totalDue)}</td></tr></tfoot>
  </table></div>
  <div class="progress"><i></i></div>
  <div class="pt"><span>${pct}% paid</span><span>${money(p.totalPaid)} of ${money(grand)}</span></div>

  <div class="received">
    <div class="card g"><small>Amount received to date</small><b>${money(p.totalPaid)}</b></div>
    <div class="card r"><small>Outstanding due</small><b>${money(p.totalDue)}</b></div>
  </div>
  <div class="words"><strong>Received (in words):</strong> ${esc(rupeesInWords(p.totalPaid))}</div>

  <h3 class="sec">Payment Transactions</h3>
  <div class="tw"><table>
    <thead><tr><th>#</th><th>Category</th><th>Method</th><th>Date</th><th>Received By</th><th class="num">Amount</th></tr></thead>
    <tbody>${historyRows}</tbody>
  </table></div>

  <div class="sign"><div>Team Representative</div><div>Authorized Signature / VCAJ</div></div>

  <div class="foot">
    <span>Computer-generated voucher · issued by ${esc(issuedBy)}</span>
    <span>Code: <b>${esc(code)}</b></span>
  </div>
  ${actions}
</div></main></div></body></html>`;
}

/* ---------- on-page viewer (no pop-up needed) ---------- */
function ensureVoucherStyles() {
  if ($("vcajVoucherStyles")) return;
  const style = document.createElement("style");
  style.id = "vcajVoucherStyles";
  style.textContent = `
    .vv-backdrop{position:fixed;inset:0;z-index:99999;background:rgba(11,36,71,.78);backdrop-filter:blur(3px);display:flex;flex-direction:column}
    .vv-bar{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#0b2447;color:#fff;flex-wrap:wrap}
    .vv-title{font-weight:700;font-size:14px;margin-right:auto}
    .vv-title span{display:block;font:700 12px 'Courier New',monospace;color:#e6c65c;letter-spacing:1px}
    .vv-bar button{border:0;border-radius:8px;padding:9px 14px;font-weight:700;font-size:13px;cursor:pointer;background:rgba(255,255,255,.14);color:#fff}
    .vv-bar button.vv-main{background:#c9a227;color:#0b2447}
    .vv-frame{flex:1;width:100%;border:0;background:#e8edf4}
    @media(max-width:520px){.vv-bar{padding:8px 10px}.vv-bar button{padding:8px 11px;font-size:12px}}
  `;
  document.head.appendChild(style);
}

function closeVoucherViewer() {
  $("vcajVoucherViewer")?.remove();
  document.body.style.overflow = "";
  document.removeEventListener("keydown", voucherEsc);
}
function voucherEsc(event) { if (event.key === "Escape") closeVoucherViewer(); }

function openHtmlViewer({code, build, whatsapp}) {
  ensureVoucherStyles();
  closeVoucherViewer();
  const wrap = document.createElement("div");
  wrap.id = "vcajVoucherViewer";
  wrap.className = "vv-backdrop";
  wrap.innerHTML = `
    <div class="vv-bar">
      <div class="vv-title">Payment Receipt<span>${esc(code)}</span></div>
      <button class="vv-main" id="vvPrint">⬇ Save as PDF / Print</button>
      ${whatsapp ? `<button id="vvWa">WhatsApp</button>` : ""}
      <button id="vvTab">New tab</button>
      <button id="vvClose" aria-label="Close">✕ Close</button>
    </div>
    <iframe class="vv-frame" id="vvFrame" title="Payment receipt preview"></iframe>`;
  document.body.appendChild(wrap);
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", voucherEsc);

  const frame = $("vvFrame");
  frame.srcdoc = build(false);

  $("vvClose").onclick = closeVoucherViewer;
  wrap.addEventListener("click", e => { if (e.target === wrap) closeVoucherViewer(); });
  $("vvPrint").onclick = async () => {
    try { await frame.contentDocument?.fonts?.ready; } catch (_) {}
    frame.contentWindow.focus();
    frame.contentWindow.print(); // choose "Save as PDF" as the destination
  };
  if (whatsapp) $("vvWa").onclick = () => window.open(whatsapp, "_blank");
  $("vvTab").onclick = () => {
    const url = URL.createObjectURL(new Blob([build(true)], {type: "text/html"}));
    const tab = window.open(url, "_blank");
    if (!tab) alert("নতুন tab খুলতে pop-up allow করুন, অথবা এই preview থেকেই “Save as PDF / Print” চাপুন।");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
}

function openVoucherViewer(item, p, history, code) {
  openHtmlViewer({code, build: standalone => buildVoucherHtml({item, p, history, code, standalone})});
}

async function generateReceipt(id) {
  const item = registrations.find(r => r.id === id);
  if (!item) return;
  const p = paymentData(item);
  const history = Array.isArray(item.paymentHistory) ? item.paymentHistory : [];
  const code = await makeVoucherCode(item, p, history);

  if (VOUCHER_CONFIG.saveVoucherRecord) {
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "receiptVouchers", code), {
        code, registrationId: item.id, uniqueId: item.uniqueId || "", teamName: item.teamName || item.name || "",
        totalPaid: p.totalPaid, totalDue: p.totalDue, entryPaid: p.entryPaid, kasanPaid: p.kasanPaid,
        issuedBy: auth.currentUser?.email || "", issuedAt: serverTimestamp()
      });
      await batch.commit();
    } catch (error) {
      console.warn("Voucher record could not be saved:", error.message);
    }
  }
  openVoucherViewer(item, p, history, code);
}

/* =====================================================================
   PAYMENT RECEIPT DESK
   Admin creates a colourful receipt directly after taking a payment.
   No team registration is needed.
   ===================================================================== */
const RECEIPT_COLLECTION = "paymentReceipts";
const LOCAL_KEY = "vcajIssuedReceipts";
const PREF_KEY = "vcajReceiptPrefs";
const THEMES = {
  royal:   {name: "Royal Blue", c1: "#1e3a8a", c2: "#2563eb", ac: "#f59e0b", soft: "#eff6ff"},
  emerald: {name: "Emerald",    c1: "#064e3b", c2: "#059669", ac: "#f59e0b", soft: "#ecfdf5"},
  sunset:  {name: "Sunset",     c1: "#9d174d", c2: "#ea580c", ac: "#facc15", soft: "#fff7ed"},
  violet:  {name: "Violet",     c1: "#4c1d95", c2: "#7c3aed", ac: "#f59e0b", soft: "#f5f3ff"}
};
const CATEGORY_TOTALS = {
  "Entry Fee": 3501,
  "Kasanmani / Security Deposit": 1500,
  "Entry Fee + Kasanmani": 5001,
  "Other": ""
};
let deskTheme = "royal";
let issuedCache = [];

const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; } };
const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };

function newReceiptCode() {
  const bytes = new Uint8Array(8);
  if (window.crypto?.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  const chars = Array.from(bytes, b => CODE_ALPHABET[b & 31]);
  const check = CODE_ALPHABET[chars.reduce((sum, c, i) => sum + CODE_ALPHABET.indexOf(c) * (i + 1), 0) % 32];
  const body = chars.join("");
  return `VCAJ-RC-${body.slice(0, 4)}-${body.slice(4)}-${check}`;
}

const prettyDate = iso => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(iso || "—") : d.toLocaleDateString("en-IN", {day: "2-digit", month: "short", year: "numeric"});
};

function receiptState(r) {
  const hasTotal = r.total !== null && r.total !== undefined && r.total !== "";
  const balance = hasTotal ? Math.max(0, Number(r.total) - Number(r.previous || 0) - Number(r.amount || 0)) : null;
  if (!hasTotal) return {balance, label: "PAYMENT RECEIVED", stamp: "RECEIVED", color: "#2563eb"};
  if (balance === 0) return {balance, label: "FULLY PAID", stamp: "PAID", color: "#16a34a"};
  return {balance, label: "PARTIALLY PAID", stamp: "PARTIAL", color: "#d97706"};
}

function buildReceiptHtml(r, standalone) {
  const t = THEMES[r.theme] || THEMES.royal;
  const st = receiptState(r);
  const hasTotal = st.balance !== null;
  const paidSoFar = Number(r.previous || 0) + Number(r.amount || 0);
  const pct = hasTotal && Number(r.total) > 0 ? Math.min(100, Math.round(paidSoFar / Number(r.total) * 100)) : 100;
  const issued = new Date(r.issuedAtMs || Date.now()).toLocaleString("en-IN", {dateStyle: "medium", timeStyle: "short"});

  const rows = [
    hasTotal ? `<tr><td>Total payable</td><td class="num">${money(r.total)}</td></tr>` : "",
    Number(r.previous) > 0 ? `<tr><td>Previously paid</td><td class="num">${money(r.previous)}</td></tr>` : "",
    `<tr class="now"><td>This payment received</td><td class="num">${money(r.amount)}</td></tr>`,
    hasTotal ? `<tr class="${st.balance > 0 ? "bal" : "ok"}"><td>${st.balance > 0 ? "Balance due" : "Balance"}</td><td class="num">${money(st.balance)}</td></tr>` : ""
  ].join("");

  const actions = standalone ? `<div class="actions"><button onclick="window.print()">⬇ Print / Save as PDF</button></div>` : "";

  return `<!doctype html><html lang="bn"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(r.code)} - Payment Receipt</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Noto+Sans+Bengali:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root{--c1:${t.c1};--c2:${t.c2};--ac:${t.ac};--soft:${t.soft};--ink:#172033;--muted:#64748b;--line:#e2e8f0;--state:${st.color}}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0}
body{font-family:Inter,'Noto Sans Bengali','Segoe UI',Arial,sans-serif;color:var(--ink);background:#e9eef6;font-size:13px;line-height:1.45}
.page{padding:16px}
.sheet{position:relative;max-width:820px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 14px 36px rgba(15,23,42,.2)}
.wm{position:absolute;top:56%;left:50%;transform:translate(-50%,-50%) rotate(-24deg);font-size:130px;font-weight:900;letter-spacing:10px;color:var(--state);opacity:.06;pointer-events:none;white-space:nowrap}
.head{position:relative;background:linear-gradient(120deg,var(--c1),var(--c2));color:#fff;padding:24px 28px 22px;display:flex;gap:16px;align-items:center}
.head::before{content:"";position:absolute;right:-60px;top:-70px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.09)}
.head::after{content:"";position:absolute;right:70px;bottom:-90px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,.07)}
.logo{position:relative;z-index:1;width:66px;height:66px;border-radius:50%;border:3px solid var(--ac);display:grid;place-items:center;font-weight:800;font-size:15px;color:#fff;background:rgba(255,255,255,.16);flex:none}
.org{position:relative;z-index:1}
.org h1{margin:0;font-size:17px;letter-spacing:.6px;line-height:1.25}
.org p{margin:5px 0 0;font-size:12px;opacity:.92}
.badge{position:relative;z-index:1;margin-left:auto;text-align:right;flex:none}
.badge b{display:block;font-size:10px;letter-spacing:2px;color:var(--ac)}
.badge span{font-size:16px;font-weight:800;letter-spacing:1px}
.ribbon{height:8px;background:linear-gradient(90deg,var(--ac),var(--c2),var(--c1),var(--ac))}
.body{position:relative;padding:22px 30px 26px}
.codebox{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border:2px dashed var(--c2);background:var(--soft);border-radius:12px;padding:12px 16px;margin-bottom:16px}
.codebox small{display:block;font-size:10px;letter-spacing:1.6px;color:var(--muted);font-weight:700}
.codebox .code{font-family:'Courier New',ui-monospace,monospace;font-size:23px;font-weight:800;letter-spacing:2px;color:var(--c1)}
.codebox .hint{font-size:11px;color:var(--muted);max-width:230px;text-align:right}
.amount{border-radius:14px;padding:16px 20px;color:#fff;background:linear-gradient(120deg,var(--c1),var(--c2));display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.amount small{display:block;font-size:11px;letter-spacing:1.6px;opacity:.9;font-weight:700}
.amount b{font-size:34px;line-height:1.1}
.pill{display:inline-block;padding:5px 14px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.9px;color:#fff;background:var(--state);box-shadow:0 0 0 3px rgba(255,255,255,.35)}
.words{margin-top:10px;font-size:12px;padding:9px 12px;background:var(--soft);border-left:4px solid var(--ac);border-radius:4px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px 14px;margin-top:16px}
.field{border:1px solid var(--line);border-left:4px solid var(--c2);border-radius:8px;padding:8px 12px;background:#fff}
.field:nth-child(even){border-left-color:var(--ac)}
.field small{display:block;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);font-weight:700}
.field b{font-size:14px;word-break:break-word}
h3.sec{margin:20px 0 8px;font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:var(--c1);display:flex;align-items:center;gap:8px}
h3.sec::after{content:"";flex:1;height:2px;background:linear-gradient(90deg,var(--c2),transparent)}
table{width:100%;border-collapse:collapse;font-size:13px;border-radius:10px;overflow:hidden}
td{padding:10px 14px;border-bottom:1px solid var(--line)}
tr:nth-child(odd) td{background:var(--soft)}
td.num{text-align:right;white-space:nowrap;font-weight:700}
tr.now td{background:#dcfce7;color:#166534;font-weight:800;font-size:14px}
tr.bal td{background:#fee2e2;color:#991b1b;font-weight:800}
tr.ok td{background:#dcfce7;color:#166534;font-weight:800}
.progress{margin:12px 0 4px;height:11px;border-radius:99px;background:#e2e8f0;overflow:hidden}
.progress i{display:block;height:100%;width:${pct}%;background:linear-gradient(90deg,#16a34a,#4ade80)}
.pt{display:flex;justify-content:space-between;font-size:11px;color:var(--muted)}
.note{margin-top:14px;padding:10px 12px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;font-size:12px}
.sign{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:46px}
.sign div{border-top:1px solid #64748b;padding-top:6px;text-align:center;font-size:11.5px;color:var(--muted)}
.thanks{margin-top:22px;text-align:center;font-weight:800;color:var(--c1);font-size:14px}
.foot{margin-top:14px;padding-top:12px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:10.5px;color:var(--muted)}
.foot b{color:var(--c1)}
.actions{text-align:center;margin:18px 0 6px}
.actions button{padding:12px 22px;background:var(--c1);color:#fff;border:0;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer}
@media(max-width:640px){
  .page{padding:8px}.head{flex-wrap:wrap;padding:18px 16px}.badge{margin-left:0;text-align:left;width:100%}
  .body{padding:16px}.grid{grid-template-columns:1fr}.codebox .code{font-size:18px;letter-spacing:1px}.codebox .hint{text-align:left;max-width:none}
  .amount b{font-size:28px}.wm{font-size:64px}.sign{gap:24px}.org h1{font-size:14px}
}
@media print{
  @page{size:A4;margin:0}
  html,body{background:#fff}.page{padding:0}
  .sheet{max-width:none;margin:0;box-shadow:none;border-radius:0;min-height:296mm}
  .actions{display:none}
}
</style></head><body><div class="page"><main class="sheet">
<div class="wm">${esc(st.stamp)}</div>
<header class="head">
  <div class="logo">${esc(VOUCHER_CONFIG.orgShort)}</div>
  <div class="org"><h1>${esc(VOUCHER_CONFIG.orgName)}</h1><p>${esc(VOUCHER_CONFIG.tournament)}</p></div>
  <div class="badge"><b>OFFICIAL</b><span>PAYMENT RECEIPT</span></div>
</header>
<div class="ribbon"></div>
<div class="body">
  <div class="codebox">
    <div><small>UNIQUE RECEIPT CODE</small><div class="code">${esc(r.code)}</div></div>
    <div class="hint">Quote this code to the organisers to verify this receipt.<br>Issued: ${esc(issued)}</div>
  </div>

  <div class="amount">
    <div><small>AMOUNT RECEIVED</small><b>${money(r.amount)}</b></div>
    <span class="pill">${esc(st.label)}</span>
  </div>
  <div class="words"><strong>In words:</strong> ${esc(rupeesInWords(r.amount))}</div>

  <div class="grid">
    <div class="field"><small>Received From (Team)</small><b>${esc(r.payer)}</b></div>
    <div class="field"><small>Payment For</small><b>${esc(r.category)}</b></div>
    <div class="field"><small>Phone / WhatsApp</small><b>${esc(r.phone || "—")}</b></div>
    <div class="field"><small>Location</small><b>${esc(r.location || "—")}</b></div>
    <div class="field"><small>Payment Method</small><b>${esc(r.method || "—")}</b></div>
    <div class="field"><small>Payment Date</small><b>${esc(prettyDate(r.paymentDate))}</b></div>
  </div>

  <h3 class="sec">Payment Details</h3>
  <table><tbody>${rows}</tbody></table>
  ${hasTotal ? `<div class="progress"><i></i></div><div class="pt"><span>${pct}% paid</span><span>${money(paidSoFar)} of ${money(r.total)}</span></div>` : ""}
  ${r.note ? `<div class="note"><strong>Note:</strong> ${esc(r.note)}</div>` : ""}

  <div class="sign"><div>Received by: ${esc(r.receivedBy || "—")}</div><div>Authorized Signature / VCAJ</div></div>
  <div class="thanks">ধন্যবাদ · Thank you for your payment!</div>
  <div class="foot"><span>Computer-generated receipt · issued by ${esc(r.issuedBy || "VCAJ Admin")}</span><span>Code: <b>${esc(r.code)}</b></span></div>
  ${actions}
</div></main></div></body></html>`;
}

function whatsappLink(r) {
  let digits = String(r.phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = "91" + digits;
  if (digits.length < 11) return "";
  const text = `✅ Payment Receipt — VCAJ\nTeam: ${r.payer}\nFor: ${r.category}\nAmount received: ${money(r.amount)}\nReceipt code: ${r.code}\nধন্যবাদ!`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function openReceiptViewer(r) {
  openHtmlViewer({code: r.code, build: standalone => buildReceiptHtml(r, standalone), whatsapp: whatsappLink(r)});
}

async function saveReceipt(r) {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, RECEIPT_COLLECTION, r.code), {...r, createdAt: serverTimestamp()});
    await batch.commit();
    return {ok: true};
  } catch (error) {
    const list = readJson(LOCAL_KEY, []).filter(x => x.code !== r.code);
    list.unshift(r);
    writeJson(LOCAL_KEY, list.slice(0, 60));
    return {ok: false, error: error.message};
  }
}

function ensureDeskStyles() {
  if ($("vcajDeskStyles")) return;
  const style = document.createElement("style");
  style.id = "vcajDeskStyles";
  style.textContent = `
    #rcFab{position:fixed;right:16px;bottom:16px;z-index:9990;border:0;border-radius:999px;padding:14px 20px;font-weight:800;font-size:14px;color:#fff;cursor:pointer;
      background:linear-gradient(120deg,#1e3a8a,#7c3aed);box-shadow:0 10px 24px rgba(76,29,149,.4)}
    #rcFab:active{transform:scale(.97)}
    .rc-backdrop{position:fixed;inset:0;z-index:99990;background:rgba(15,23,42,.62);display:flex;align-items:flex-end;justify-content:center}
    .rc-panel{background:#fff;width:100%;max-width:640px;max-height:94vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;font-family:Inter,'Noto Sans Bengali',system-ui,sans-serif;color:#172033}
    @media(min-width:700px){.rc-backdrop{align-items:center}.rc-panel{border-radius:20px}}
    .rc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:16px 18px;color:#fff;background:linear-gradient(120deg,#1e3a8a,#7c3aed)}
    .rc-head h2{margin:0;font-size:18px}.rc-head p{margin:3px 0 0;font-size:12px;opacity:.9}
    .rc-x{border:0;background:rgba(255,255,255,.2);color:#fff;border-radius:10px;width:36px;height:36px;font-size:16px;cursor:pointer;flex:none}
    .rc-tabs{display:flex;border-bottom:1px solid #e2e8f0}
    .rc-tabs button{flex:1;border:0;background:#fff;padding:12px;font-weight:700;font-size:13px;color:#64748b;cursor:pointer;border-bottom:3px solid transparent}
    .rc-tabs button.on{color:#1e3a8a;border-bottom-color:#7c3aed}
    .rc-body{padding:16px 18px 20px;overflow-y:auto}
    .rc-body[hidden]{display:none}
    .rc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .rc-grid .full{grid-column:1/-1}
    @media(max-width:520px){.rc-grid{grid-template-columns:1fr}}
    .rc-body label{display:block;font-size:11px;font-weight:700;letter-spacing:.6px;color:#475569;text-transform:uppercase;margin-bottom:4px}
    .rc-body input,.rc-body select,.rc-body textarea{width:100%;padding:11px 12px;border:1.5px solid #cbd5e1;border-radius:10px;font:inherit;font-size:15px;background:#fff;color:#172033}
    .rc-body input:focus,.rc-body select:focus,.rc-body textarea:focus{outline:none;border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.15)}
    .rc-swatches{display:flex;gap:10px;flex-wrap:wrap}
    .rc-sw{width:44px;height:44px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px #cbd5e1;cursor:pointer}
    .rc-sw.on{box-shadow:0 0 0 3px #172033}
    .rc-bal{padding:10px 12px;border-radius:10px;background:#f1f5f9;font-weight:700;font-size:14px}
    .rc-bal.due{background:#fee2e2;color:#991b1b}.rc-bal.ok{background:#dcfce7;color:#166534}
    .rc-go{width:100%;margin-top:6px;border:0;border-radius:12px;padding:15px;font-weight:800;font-size:16px;color:#fff;cursor:pointer;background:linear-gradient(120deg,#059669,#16a34a)}
    .rc-msg{margin-top:10px;font-size:13px;line-height:1.5}
    .rc-msg.warn{color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 12px}
    .rc-msg.good{color:#166534}
    .rc-item{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:12px;border:1px solid #e2e8f0;border-radius:12px;margin-top:10px}
    .rc-item b{font-size:14px}.rc-item small{display:block;color:#64748b;font-size:11.5px;margin-top:2px;word-break:break-all}
    .rc-item .amt{font-weight:800;color:#15803d;white-space:nowrap}
    .rc-item button{border:0;border-radius:9px;padding:9px 13px;font-weight:700;background:#1e3a8a;color:#fff;cursor:pointer}
    .rc-tag{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:99px;background:#fde68a;color:#92400e;font-size:10px;font-weight:800}
  `;
  document.head.appendChild(style);
}

function openDesk() {
  ensureDeskStyles();
  $("rcDesk")?.remove();
  const prefs = readJson(PREF_KEY, {});
  if (THEMES[prefs.theme]) deskTheme = prefs.theme;
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const wrap = document.createElement("div");
  wrap.id = "rcDesk";
  wrap.className = "rc-backdrop";
  wrap.innerHTML = `
    <div class="rc-panel">
      <div class="rc-head"><div><h2>Payment Receipt Desk</h2><p>Payment নেওয়ার পরই এখান থেকে colourful receipt বানান — registration লাগবে না</p></div>
        <button class="rc-x" id="rcX" aria-label="Close">✕</button></div>
      <div class="rc-tabs"><button class="on" data-tab="new">＋ New Receipt</button><button data-tab="list">Issued Receipts</button></div>

      <div class="rc-body" id="rcNew">
        <div class="rc-grid">
          <div class="full"><label for="rcName">Team / payer name *</label><input id="rcName" placeholder="যেমন: Jeliakhali Strikers" autocomplete="off"></div>
          <div><label for="rcPhone">Phone / WhatsApp</label><input id="rcPhone" inputmode="tel" placeholder="98XXXXXXXX"></div>
          <div><label for="rcLoc">Location</label><input id="rcLoc" placeholder="গ্রাম / এলাকা"></div>
          <div class="full"><label for="rcCat">Payment for</label>
            <select id="rcCat">${Object.keys(CATEGORY_TOTALS).map(k => `<option>${esc(k)}</option>`).join("")}</select></div>
          <div><label for="rcTotal">Total payable (₹)</label><input id="rcTotal" inputmode="numeric" placeholder="ঐচ্ছিক"></div>
          <div><label for="rcPrev">Previously paid (₹)</label><input id="rcPrev" inputmode="numeric" placeholder="0"></div>
          <div class="full"><label for="rcAmt">Amount received now (₹) *</label><input id="rcAmt" inputmode="decimal" placeholder="যেমন: 2000" style="font-size:20px;font-weight:800"></div>
          <div class="full"><div class="rc-bal" id="rcBal">Balance: —</div></div>
          <div><label for="rcMethod">Payment method</label>
            <select id="rcMethod"><option>Cash</option><option>UPI / PhonePe / GPay</option><option>Bank Transfer</option><option>Cheque</option><option>Other</option></select></div>
          <div><label for="rcDate">Payment date</label><input id="rcDate" type="date" value="${today}"></div>
          <div class="full"><label for="rcBy">Received by</label><input id="rcBy" value="${esc(prefs.receivedBy || auth.currentUser?.email || "")}"></div>
          <div class="full"><label for="rcNote">Note (optional)</label><textarea id="rcNote" rows="2"></textarea></div>
          <div class="full"><label>Receipt colour</label>
            <div class="rc-swatches">${Object.entries(THEMES).map(([k, t]) =>
              `<button type="button" class="rc-sw" data-theme="${k}" title="${esc(t.name)}" style="background:linear-gradient(135deg,${t.c1},${t.c2})"></button>`).join("")}</div></div>
        </div>
        <button class="rc-go" id="rcCreate">Create Receipt</button>
        <div class="rc-msg" id="rcMsg"></div>
      </div>

      <div class="rc-body" id="rcListWrap" hidden>
        <input id="rcSearch" placeholder="নাম বা code দিয়ে খুঁজুন">
        <div id="rcList"></div>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const close = () => wrap.remove();
  $("rcX").onclick = close;
  wrap.addEventListener("click", e => { if (e.target === wrap) close(); });

  const markTheme = () => wrap.querySelectorAll(".rc-sw").forEach(b => b.classList.toggle("on", b.dataset.theme === deskTheme));
  wrap.querySelectorAll(".rc-sw").forEach(b => b.onclick = () => { deskTheme = b.dataset.theme; markTheme(); });
  markTheme();

  wrap.querySelectorAll(".rc-tabs button").forEach(b => b.onclick = () => {
    wrap.querySelectorAll(".rc-tabs button").forEach(x => x.classList.toggle("on", x === b));
    $("rcNew").hidden = b.dataset.tab !== "new";
    $("rcListWrap").hidden = b.dataset.tab !== "list";
    if (b.dataset.tab === "list") loadIssued();
  });

  const num = id => { const v = String($(id).value).replace(/,/g, "").trim(); return v === "" ? null : Number(v); };
  const updateBalance = () => {
    const box = $("rcBal"), total = num("rcTotal"), prev = num("rcPrev") || 0, amt = num("rcAmt") || 0;
    if (total === null || Number.isNaN(total)) { box.className = "rc-bal"; box.textContent = "Balance: — (Total payable দিলে বাকি হিসাব হবে)"; return; }
    const bal = Math.max(0, total - prev - amt);
    box.className = "rc-bal " + (bal > 0 ? "due" : "ok");
    box.textContent = bal > 0 ? `Balance due: ${money(bal)}` : "Fully paid ✔";
  };
  $("rcCat").onchange = () => { const t = CATEGORY_TOTALS[$("rcCat").value]; $("rcTotal").value = t === "" ? "" : t; updateBalance(); };
  ["rcTotal", "rcPrev", "rcAmt"].forEach(id => $(id).addEventListener("input", updateBalance));
  $("rcTotal").value = CATEGORY_TOTALS[$("rcCat").value];
  updateBalance();

  $("rcSearch").addEventListener("input", renderIssued);

  $("rcCreate").onclick = async () => {
    const msg = $("rcMsg");
    const payer = $("rcName").value.trim(), amount = num("rcAmt"), total = num("rcTotal"), previous = num("rcPrev") || 0;
    msg.className = "rc-msg";
    if (!payer) { msg.textContent = "Team / payer name দিন।"; $("rcName").focus(); return; }
    if (amount === null || Number.isNaN(amount) || amount <= 0) { msg.textContent = "সঠিক Amount received লিখুন।"; $("rcAmt").focus(); return; }
    if ((total !== null && Number.isNaN(total)) || Number.isNaN(previous)) { msg.textContent = "Total / Previously paid-এ শুধু সংখ্যা দিন।"; return; }

    const r = {
      code: newReceiptCode(), payer, phone: $("rcPhone").value.trim(), location: $("rcLoc").value.trim(),
      category: $("rcCat").value, total: total === null ? null : total, previous, amount,
      method: $("rcMethod").value, paymentDate: $("rcDate").value || today, receivedBy: $("rcBy").value.trim(),
      note: $("rcNote").value.trim(), theme: deskTheme, issuedBy: auth.currentUser?.email || "", issuedAtMs: Date.now()
    };
    writeJson(PREF_KEY, {theme: deskTheme, receivedBy: r.receivedBy});
    $("rcCreate").disabled = true;
    const result = await saveReceipt(r);
    $("rcCreate").disabled = false;

    if (result.ok) { msg.className = "rc-msg good"; msg.textContent = `Receipt ${r.code} তৈরি ও save হয়েছে।`; }
    else {
      msg.className = "rc-msg warn";
      msg.textContent = `Receipt তৈরি হয়েছে (${r.code}), কিন্তু cloud-এ save হয়নি — Firestore rules-এ “${RECEIPT_COLLECTION}” collection-এ লেখার অনুমতি লাগবে। আপাতত এই device-এ রাখা হয়েছে। (${result.error})`;
    }
    ["rcName", "rcPhone", "rcLoc", "rcPrev", "rcAmt", "rcNote"].forEach(id => $(id).value = "");
    updateBalance();
    openReceiptViewer(r);
  };
}

async function loadIssued() {
  const box = $("rcList");
  if (box) box.innerHTML = `<p>লোড হচ্ছে…</p>`;
  let cloud = [], error = "";
  try {
    const snap = await getDocs(collection(db, RECEIPT_COLLECTION));
    cloud = snap.docs.map(d => ({...d.data(), code: d.id}));
  } catch (e) { error = e.message; }
  const local = readJson(LOCAL_KEY, []).filter(l => !cloud.some(c => c.code === l.code)).map(l => ({...l, _local: true}));
  issuedCache = [...cloud, ...local].sort((a, b) => (b.issuedAtMs || 0) - (a.issuedAtMs || 0));
  renderIssued(error);
}

function renderIssued(error) {
  const box = $("rcList");
  if (!box) return;
  const q = String($("rcSearch")?.value || "").trim().toLowerCase();
  const list = issuedCache.filter(r => !q || `${r.payer} ${r.code} ${r.phone}`.toLowerCase().includes(q));
  const warn = typeof error === "string" && error ? `<p class="rc-msg warn">Cloud list লোড হয়নি: ${esc(error)}</p>` : "";
  box.innerHTML = warn + (list.length ? list.map(r => `
    <div class="rc-item">
      <div><b>${esc(r.payer)}${r._local ? `<span class="rc-tag">Device only</span>` : ""}</b>
        <small>${esc(r.category)} · ${esc(prettyDate(r.paymentDate))}<br>${esc(r.code)}</small></div>
      <div style="text-align:right"><div class="amt">${money(r.amount)}</div><button data-open="${esc(r.code)}">Open</button></div>
    </div>`).join("") : `<p>এখনো কোনো receipt নেই।</p>`);
  box.querySelectorAll("[data-open]").forEach(b => b.onclick = () => {
    const r = issuedCache.find(x => x.code === b.dataset.open);
    if (r) openReceiptViewer(r);
  });
}

function initReceiptDesk() {
  if ($("rcFab")) return;
  ensureDeskStyles();
  const fab = document.createElement("button");
  fab.id = "rcFab";
  fab.type = "button";
  fab.textContent = "＋ New Receipt";
  fab.onclick = openDesk;
  document.body.appendChild(fab);
}

async function changeStatus(id, status) {
  const item = registrations.find(r => r.id === id);
  if (!item) return;
  const promptText = status === "verified" ? "Verification note (optional):" : "Reject করার কারণ দিন:";
  const note = prompt(promptText);
  if (note === null) return;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, "teamRegistrations", id), {
      status, verifiedAt: serverTimestamp(), verifiedBy: auth.currentUser?.email || "", adminNote: note
    });
    if (item.verificationCode) {
      batch.update(doc(db, "receiptVerifications", item.verificationCode), {
        status, verifiedAt: serverTimestamp(), verifiedBy: auth.currentUser?.email || "", adminNote: note
      });
    }
    await batch.commit();
    $("registrationMsg").textContent = `Registration ${status} হয়েছে।`;
    await load();
  } catch (error) {
    $("registrationMsg").textContent = `Update হয়নি: ${error.message}`;
  }
}

$("refreshRegistrations")?.addEventListener("click", load);
$("statusFilter")?.addEventListener("change", render);
$("paidFilter")?.addEventListener("change", render);
$("search")?.addEventListener("input", render);
$("closeModal")?.addEventListener("click", () => $("modal")?.classList.remove("open"));
$("modal")?.addEventListener("click", event => {
  if (event.target === $("modal")) $("modal").classList.remove("open");
});

initReceiptDesk();
await load();
