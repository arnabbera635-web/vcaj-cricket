import {db,auth,collection,doc,getDocs,writeBatch,serverTimestamp} from "./firebase.js";

const $ = id => document.getElementById(id);
let registrations = [];

/* ---------- helpers ---------- */
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

/* ---------- unique voucher number ---------- */
function makeVoucherNo(item) {
  const idPart = String(item.uniqueId || item.id || "VCAJ")
    .replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase();
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const time = String(now.getHours()).padStart(2,"0") + String(now.getMinutes()).padStart(2,"0");
  return `VCAJ-${idPart}-${y}${m}${d}-${time}${rand}`;
}

/* ---------- load ---------- */
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

/* ---------- render table ---------- */
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
        <button class="btn btn-primary" data-receipt="${esc(item.id)}">🧾 Receipt PDF</button>
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

/* ---------- details modal ---------- */
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
    <div class="admin-actions"><button class="btn btn-primary" id="modalReceiptBtn">🧾 Receipt PDF তৈরি করুন</button></div>`;
  $("modalReceiptBtn").onclick = () => generateReceipt(id);
  $("modal").classList.add("open");
}

/* ---------- ⭐ premium receipt voucher ---------- */
function generateReceipt(id) {
  const item = registrations.find(r => r.id === id);
  if (!item) return;
  const p = paymentData(item);
  const history = Array.isArray(item.paymentHistory) ? item.paymentHistory : [];
  const voucherNo = makeVoucherNo(item);
  const issuedAt = new Date().toLocaleString("en-IN", {dateStyle:"medium", timeStyle:"short"});
  const issuedBy = auth.currentUser?.email || "VCAJ Admin";
  const status = statusLabel(item.status);

  const historyRows = history.length ? history.map((h,i) => `
    <tr>
      <td class="c">${i+1}</td>
      <td>${esc(h.category || h.type || "Payment")}</td>
      <td>${esc(h.method || h.mode || "—")}</td>
      <td>${esc(dateText(h.date || h.paymentDate || h.createdAt))}</td>
      <td>${esc(h.receivedBy || "—")}</td>
      <td class="num">${money(h.amount ?? h.paid ?? 0)}</td>
    </tr>`).join("")
    : `<tr>
      <td class="c">1</td>
      <td>Entry Fee + Kasanmani (current summary)</td>
      <td>${esc(p.entry.paymentMethod || p.kasan.paymentMethod || "—")}</td>
      <td>${esc(p.entry.paymentDate || p.kasan.paymentDate || "—")}</td>
      <td>${esc(p.entry.receivedBy || p.kasan.receivedBy || issuedBy)}</td>
      <td class="num">${money(p.totalPaid)}</td>
    </tr>`;

  const statusColor = status === "VERIFIED" ? "#16a34a" : status === "REJECTED" ? "#dc2626" : "#d97706";

  const html = `<!doctype html><html lang="bn"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(voucherNo)} — VCAJ Payment Voucher</title>
  <style>
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    html,body{margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,'Noto Sans Bengali',sans-serif;background:#e8eef5;color:#0f172a;line-height:1.5}
    .sheet{max-width:860px;margin:24px auto;background:#fff;border-radius:14px;overflow:hidden;
      box-shadow:0 12px 40px rgba(15,23,42,.18);position:relative}
    .watermark{position:absolute;top:44%;left:50%;transform:translate(-50%,-50%) rotate(-22deg);
      font-size:110px;font-weight:900;color:rgba(16,40,74,.05);white-space:nowrap;pointer-events:none;
      letter-spacing:8px;user-select:none;z-index:0}
    .sheet > *:not(.watermark){position:relative;z-index:1}

    /* header */
    .head{background:linear-gradient(135deg,#0b1f3a 0%,#10284a 45%,#1e4d8c 100%);
      color:#fff;padding:26px 32px 22px;display:flex;justify-content:space-between;align-items:center;gap:16px}
    .head .brand{display:flex;align-items:center;gap:14px}
    .logo{width:54px;height:54px;border-radius:50%;background:radial-gradient(circle at 30% 30%,#fbbf24,#d97706);
      display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;color:#0b1f3a;flex:none;
      box-shadow:0 0 0 3px rgba(255,255,255,.15)}
    .head h1{font-size:17px;margin:0;letter-spacing:.6px;line-height:1.3}
    .head .sub{font-size:11.5px;opacity:.85;margin-top:3px}
    .badge{text-align:right;font-size:11px;letter-spacing:1.5px;font-weight:700;color:#fbbf24;line-height:1.4}
    .badge .status-pill{display:inline-block;margin-top:6px;padding:3px 10px;border-radius:20px;
      font-size:10px;font-weight:800;letter-spacing:1px;color:#fff;background:${statusColor}}

    /* title strip */
    .strip{background:linear-gradient(90deg,#fbbf24,#f59e0b);color:#0b1f3a;text-align:center;
      padding:9px;font-size:14px;font-weight:900;letter-spacing:4px;text-transform:uppercase}

    /* body */
    .body{padding:26px 32px 10px}
    .meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;font-size:12.5px;
      background:#f1f5f9;border:1px dashed #94a3b8;border-radius:8px;padding:10px 14px;margin-bottom:20px}
    .meta strong{color:#0b1f3a}
    .meta .vno{font-family:'Courier New',monospace;font-weight:800;color:#1e4d8c;letter-spacing:.5px}

    h3{font-size:13px;color:#0b1f3a;margin:20px 0 8px;text-transform:uppercase;letter-spacing:1.2px;
      border-left:4px solid #fbbf24;padding-left:9px}

    /* info grid */
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 22px;margin-bottom:6px}
    .info-grid .row{display:flex;gap:10px;font-size:13px;padding:6px 0;border-bottom:1px solid #eef2f7}
    .info-grid .row .k{width:42%;color:#64748b;font-weight:600}
    .info-grid .row .v{font-weight:700;color:#0f172a;word-break:break-word}

    /* tables */
    table{width:100%;border-collapse:collapse;margin:10px 0 4px;font-size:12.5px}
    th,td{border:1px solid #dbe3ec;padding:8px 10px;text-align:left;vertical-align:top}
    thead th{background:#0b1f3a;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.8px;font-weight:700}
    tbody tr:nth-child(even){background:#f8fafc}
    .num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
    .c{text-align:center}
    tr.total-row td{background:#eff6ff!important;font-weight:800;font-size:13.5px;color:#0b1f3a;border-top:2px solid #1e4d8c}
    tr.total-row td.num{font-size:14px}

    /* amount highlight */
    .amount-wrap{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0 6px}
    .amount-card{border-radius:10px;padding:14px 16px;color:#fff;position:relative;overflow:hidden}
    .amount-card.paid{background:linear-gradient(135deg,#059669,#10b981)}
    .amount-card.due{background:linear-gradient(135deg,#b91c1c,#ef4444)}
    .amount-card .lbl{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;opacity:.9}
    .amount-card .val{font-size:22px;font-weight:900;margin-top:4px;letter-spacing:.5px}
    .amount-card::after{content:"";position:absolute;right:-20px;top:-20px;width:80px;height:80px;
      border-radius:50%;background:rgba(255,255,255,.15)}

    /* signatures */
    .signatures{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:52px;padding:0 10px}
    .sign{text-align:center;font-size:11.5px;color:#475569}
    .sign .line{border-top:1.5px solid #475569;margin-bottom:6px;height:34px}
    .sign .role{font-weight:700;color:#0b1f3a}

    /* footer */
    .foot{margin-top:26px;padding:14px 32px 22px;border-top:1px dashed #cbd5e1;font-size:10.5px;
      color:#64748b;line-height:1.6;background:#f8fafc}
    .foot .gen{margin-top:6px;font-family:'Courier New',monospace;font-size:9.5px;color:#94a3b8}

    /* print button */
    .actions{text-align:center;padding:18px 0 26px;background:#f8fafc}
    .actions button{padding:12px 28px;background:linear-gradient(135deg,#0b1f3a,#1e4d8c);color:#fff;border:0;
      border-radius:30px;font-weight:800;font-size:14px;letter-spacing:.8px;cursor:pointer;
      box-shadow:0 6px 18px rgba(30,77,140,.35);transition:transform .15s}
    .actions button:hover{transform:translateY(-2px)}
    .actions .hint{margin-top:8px;font-size:11px;color:#64748b}

    @media print{
      @page{size:A4;margin:10mm}
      body{background:#fff}
      .sheet{margin:0;max-width:none;border-radius:0;box-shadow:none}
      .actions{display:none!important}
      .head{background:#0b1f3a!important}
      .strip{background:#fbbf24!important}
      .amount-card.paid{background:#059669!important}
      .amount-card.due{background:#b91c1c!important}
      thead th{background:#0b1f3a!important;color:#fff!important}
    }
    @media(max-width:640px){
      .body,.head,.foot{padding-left:18px;padding-right:18px}
      .info-grid{grid-template-columns:1fr}
      .head{flex-direction:column;align-items:flex-start}
      .badge{text-align:left}
      .signatures{gap:30px}
      .watermark{font-size:70px}
    }
  </style></head>
  <body>
    <div class="sheet">
      <div class="watermark">VCAJ</div>

      <div class="head">
        <div class="brand">
          <div class="logo">V</div>
          <div>
            <h1>VIVEKANANDA CRICKET ASSOCIATION OF JELIAKHALI</h1>
            <div class="sub">জেলিয়াখালী “মন্ডল এন্ড মন্ডল” ক্রিকেট টুর্নামেন্ট ২০২৬</div>
          </div>
        </div>
        <div class="badge">
          OFFICIAL<br>PAYMENT VOUCHER
          <div class="status-pill">${esc(status)}</div>
        </div>
      </div>

      <div class="strip">Payment Receipt / Voucher</div>

      <div class="body">
        <div class="meta">
          <span>Voucher No: <span class="vno">${esc(voucherNo)}</span></span>
          <span>Issued: <strong>${esc(issuedAt)}</strong></span>
        </div>

        <h3>Registration Details</h3>
        <div class="info-grid">
          <div class="row"><span class="k">Team Name</span><span class="v">${esc(item.teamName || item.name || "—")}</span></div>
          <div class="row"><span class="k">Registration ID</span><span class="v">${esc(item.uniqueId || item.id)}</span></div>
          <div class="row"><span class="k">WhatsApp</span><span class="v">${esc(item.whatsapp || item.phone || "—")}</span></div>
          <div class="row"><span class="k">Location</span><span class="v">${esc(item.location || "—")}</span></div>
          <div class="row"><span class="k">Captain / Contact</span><span class="v">${esc(item.contact || item.captainName || "—")}</span></div>
          <div class="row"><span class="k">Receipt Status</span><span class="v">${esc(status)}</span></div>
        </div>

        <h3>Payment Summary</h3>
        <table>
          <thead><tr>
            <th>Particulars</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Due</th>
          </tr></thead>
          <tbody>
            <tr><td>Entry Fee</td><td class="num">${money(p.entryTotal)}</td><td class="num">${money(p.entryPaid)}</td><td class="num">${money(p.entryDue)}</td></tr>
            <tr><td>Kasanmani / Security Deposit</td><td class="num">${money(p.kasanTotal)}</td><td class="num">${money(p.kasanPaid)}</td><td class="num">${money(p.kasanDue)}</td></tr>
            <tr class="total-row"><td>Grand Total</td><td class="num">${money(p.entryTotal + p.kasanTotal)}</td><td class="num">${money(p.totalPaid)}</td><td class="num">${money(p.totalDue)}</td></tr>
          </tbody>
        </table>

        <div class="amount-wrap">
          <div class="amount-card paid">
            <div class="lbl">Amount Received</div>
            <div class="val">${money(p.totalPaid)}</div>
          </div>
          <div class="amount-card due">
            <div class="lbl">Outstanding Due</div>
            <div class="val">${money(p.totalDue)}</div>
          </div>
        </div>

        <h3>Payment Transactions</h3>
        <table>
          <thead><tr>
            <th class="c">#</th><th>Category</th><th>Method</th><th>Date</th><th>Received By</th><th class="num">Amount</th>
          </tr></thead>
          <tbody>${historyRows}</tbody>
        </table>

        <div class="signatures">
          <div class="sign"><div class="line"></div><div class="role">Team Representative</div></div>
          <div class="sign"><div class="line"></div><div class="role">Authorized Signature / VCAJ</div></div>
        </div>

        <div class="foot">
          <strong>Note:</strong> This voucher records the payment details available in the VCAJ registration system at the time of generation. Please retain it for future reference. This is a system-generated document and does not require a physical seal to be valid.
          <div class="gen">Generated by: ${esc(issuedBy)} · Voucher: ${esc(voucherNo)}</div>
        </div>

        <div class="actions">
          <button onclick="window.print()">🖨️ Print / Save as PDF</button>
          <div class="hint">Android Chrome-এ "Save as PDF" নির্বাচন করুন · Desktop-এ Print ডায়ালগ আসবে</div>
        </div>
      </div>
    </div>
    <script>window.onload=()=>setTimeout(()=>window.print(),400);<\/script>
  </body></html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("PDF তৈরি করতে নতুন window দরকার। Browser settings থেকে pop-ups allow করে আবার Receipt PDF চাপুন।");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/* ---------- change status ---------- */
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
    $("registrationMsg").textContent = `Update হয়নি: ${error.message}`;
  }
}

/* ---------- wire up ---------- */
$("refreshRegistrations")?.addEventListener("click", load);
$("statusFilter")?.addEventListener("change", render);
$("paidFilter")?.addEventListener("change", render);
$("search")?.addEventListener("input", render);
$("closeModal")?.addEventListener("click", () => $("modal")?.classList.remove("open"));
$("modal")?.addEventListener("click", event => {
  if (event.target === $("modal")) $("modal").classList.remove("open");
});

await load();
