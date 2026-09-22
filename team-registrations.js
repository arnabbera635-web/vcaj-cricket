import {
  auth,
  db,
  isAdmin,
  collection,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
  onAuthStateChanged
} from "./firebase.js";

const $ = (id) => document.getElementById(id);

let registrations = [];
let currentFilter = "all";

function esc(value) {
  return String(value ?? "").replace(/[&<>"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));
}

function money(value) {
  const n = Number(value || 0);
  return "₹" + n.toLocaleString("en-IN");
}

function statusText(status) {
  const s = String(status || "").toLowerCase();

  if (s === "verified" || s === "approved") {
    return `<span class="pill ok-pill">✅ VERIFIED</span>`;
  }

  if (s === "rejected") {
    return `<span class="pill danger-pill">❌ REJECTED</span>`;
  }

  return `<span class="pill warn-pill">⏳ PENDING</span>`;
}

function getStatus(status) {
  const s = String(status || "").toLowerCase();

  if (s === "verified" || s === "approved") {
    return "verified";
  }

  if (s === "rejected") {
    return "rejected";
  }

  return "pending";
}

function renderRegistrations() {

  const table = $("teamRegistrationTable");
  const count = $("registrationCount");

  if (!table) return;

  let list = [...registrations];

  if (currentFilter !== "all") {
    list = list.filter(
      item => getStatus(item.status) === currentFilter
    );
  }

  if (count) {
    count.textContent = `${list.length}টি Application`;
  }

  if (!list.length) {
    table.innerHTML = `
      <div class="card" style="margin:0">
        <p class="muted">
          এই filter-এর মধ্যে কোনো Team Registration পাওয়া যায়নি।
        </p>
      </div>
    `;
    return;
  }

  list.sort((a, b) => {

    const ad = a.createdAt?.seconds
      ? a.createdAt.seconds
      : 0;

    const bd = b.createdAt?.seconds
      ? b.createdAt.seconds
      : 0;

    return bd - ad;
  });

  table.innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th>WhatsApp</th>
          <th>Location</th>
          <th>Entry Fee</th>
          <th>Kasanmani</th>
          <th>Total</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>

        ${list.map((item, index) => {

          const entryPaid =
            Number(item.entryFee?.paid || 0);

          const entryDue =
            Number(item.entryFee?.due || 0);

          const kasanPaid =
            Number(item.kasanmani?.paid || 0);

          const kasanDue =
            Number(item.kasanmani?.due || 0);

          const totalPaid =
            Number(
              item.totalPaid ??
              (entryPaid + kasanPaid)
            );

          const totalDue =
            Number(
              item.totalDue ??
              (entryDue + kasanDue)
            );

          return `
            <tr>

              <td>${index + 1}</td>

              <td>
                <strong>${esc(item.teamName)}</strong>
                ${
                  item.uniqueId
                    ? `<br><small>${esc(item.uniqueId)}</small>`
                    : ""
                }
              </td>

              <td>
                ${esc(item.whatsapp || "—")}
              </td>

              <td>
                ${esc(item.location || "—")}
              </td>

              <td>
                ${money(entryPaid)}
                ${
                  entryDue > 0
                    ? `<br><small>Due: ${money(entryDue)}</small>`
                    : ""
                }
              </td>

              <td>
                ${money(kasanPaid)}
                ${
                  kasanDue > 0
                    ? `<br><small>Due: ${money(kasanDue)}</small>`
                    : ""
                }
              </td>

              <td>
                <strong>${money(totalPaid)}</strong>
                ${
                  totalDue > 0
                    ? `<br><small>Due: ${money(totalDue)}</small>`
                    : ""
                }
              </td>

              <td>
                ${statusText(item.status)}
              </td>

              <td>
                <button
                  class="secondary"
                  data-registration-view="${esc(item.id)}">
                  View
                </button>

                ${
                  getStatus(item.status) === "pending"
                    ? `
                      <button
                        class="primary"
                        data-registration-verify="${esc(item.id)}">
                        ✅ Verify
                      </button>

                      <button
                        class="danger"
                        data-registration-reject="${esc(item.id)}">
                        ❌ Reject
                      </button>
                    `
                    : ""
                }

              </td>

            </tr>
          `;
        }).join("")}

      </tbody>
    </table>
  `;
}

async function loadRegistrations() {

  const msg = $("registrationMsg");

  if (msg) {
    msg.textContent =
      "⏳ Team Registration data loading...";
  }

  try {

    const snap =
      await getDocs(
        collection(db, "teamRegistrations")
      );

    registrations = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    renderRegistrations();

    if (msg) {
      msg.textContent =
        `✅ ${registrations.length}টি Team Registration পাওয়া গেছে।`;
    }

  } catch (error) {

    console.error(
      "TEAM REGISTRATION LOAD ERROR:",
      error
    );

    if (msg) {
      msg.textContent =
        "❌ Registration data load করা যাচ্ছে না: " +
        (error.code || error.message);
    }
  }
}

async function updateRegistrationStatus(id, status) {

  const item = registrations.find(x => x.id === id);

  if (!item) {
    alert("Application পাওয়া যায়নি।");
    return;
  }

  const teamName = item.teamName || "এই Team";
  let note = "";

  if (status === "verified") {

    const ok = confirm(
      `${teamName}\n\nএই Team Registration এবং payment information VERIFIED হিসেবে Save করবেন?`
    );

    if (!ok) return;

    note = "Payment এবং registration Admin দ্বারা verified হয়েছে।";

  } else {

    note = prompt(
      `${teamName}\n\nReject করার কারণ লিখুন:`,
      ""
    );

    if (note === null) return;

    if (!note.trim()) {
      alert("Reject করার কারণ লিখুন।");
      return;
    }
  }

  try {

    const batch = writeBatch(db);

    const registrationRef =
      doc(db, "teamRegistrations", id);

    batch.update(registrationRef, {
      status: status,
      verifiedAt: serverTimestamp(),
      verifiedBy: auth.currentUser?.email || "",
      adminNote: note
    });

    if (item.verificationCode) {

      const receiptRef =
        doc(
          db,
          "receiptVerifications",
          item.verificationCode
        );

      batch.update(receiptRef, {
        status: status,
        verifiedAt: serverTimestamp(),
        verifiedBy: auth.currentUser?.email || "",
        adminNote: note
      });
    }

    await batch.commit();

    alert(
      status === "verified"
        ? "✅ Registration এবং Payment Receipt দুটোই VERIFIED হয়েছে।"
        : "❌ Registration এবং Payment Receipt দুটোই REJECTED হয়েছে।"
    );

    await loadRegistrations();

  } catch (error) {

    console.error(
      "REGISTRATION STATUS UPDATE ERROR:",
      error
    );

    alert(
      "❌ Status update করা যায়নি:\n" +
      (error.code || error.message)
    );
  }
}
function showRegistrationDetails(id) {
  const item =
    registrations.find(x => x.id === id);

  if (!item) {
    alert("Application পাওয়া যায়নি।");
    return;
  }

  const entryPaid =
    Number(item.entryFee?.paid || 0);

  const entryDue =
    Number(item.entryFee?.due || 0);

  const kasanPaid =
    Number(item.kasanmani?.paid || 0);

  const kasanDue =
    Number(item.kasanmani?.due || 0);

  const totalPaid =
    Number(
      item.totalPaid ??
      entryPaid + kasanPaid
    );

  const totalDue =
    Number(
      item.totalDue ??
      entryDue + kasanDue
    );

  const paymentHistory =
    Array.isArray(item.paymentHistory)
      ? item.paymentHistory
      : [];

  const historyText =
    paymentHistory.length
      ? paymentHistory.map((p, i) => {

          if (typeof p === "string") {
            return `${i + 1}. ${esc(p)}`;
          }

          return `
            ${i + 1}.
            ${esc(p.type || p.mode || "Payment")}
            —
            ${money(p.amount || p.paid || 0)}
          `;
        }).join("<br>")
      : "কোনো payment history নেই";

  const modal =
    document.createElement("div");

  modal.className = "modal";

  modal.innerHTML = `
    <div class="modal-box card">

      <div class="card-head">
        <div>
          <p class="eyebrow">TEAM REGISTRATION</p>
          <h2>${esc(item.teamName || "Team")}</h2>
        </div>

        <button id="closeRegistrationDetails">
          বন্ধ
        </button>
      </div>

      <p>
        <strong>Status:</strong>
        ${statusText(item.status)}
      </p>

      <hr>

      <p>
        <strong>Unique ID:</strong>
        ${esc(item.uniqueId || "—")}
      </p>

      <p>
        <strong>Verification Code:</strong>
        ${esc(item.verificationCode || "—")}
      </p>

      <p>
        <strong>WhatsApp:</strong>
        ${esc(item.whatsapp || "—")}
      </p>

      <p>
        <strong>Location:</strong>
        ${esc(item.location || "—")}
      </p>

      <hr>

      <h3>Payment Details</h3>

      <p>
        Entry Fee:
        <strong>${money(entryPaid)}</strong>
        ${
          entryDue
            ? ` / Due ${money(entryDue)}`
            : ""
        }
      </p>

      <p>
        Kasanmani:
        <strong>${money(kasanPaid)}</strong>
        ${
          kasanDue
            ? ` / Due ${money(kasanDue)}`
            : ""
        }
      </p>

      <p>
        Total Paid:
        <strong>${money(totalPaid)}</strong>
      </p>

      <p>
        Total Due:
        <strong>${money(totalDue)}</strong>
      </p>

      <h3>Payment History</h3>

      <div class="card">
        ${historyText}
      </div>

      ${
        item.adminNote
          ? `
            <h3>Admin Note</h3>
            <p>${esc(item.adminNote)}</p>
          `
          : ""
      }

      <div class="toolbar">

        ${
          getStatus(item.status) === "pending"
            ? `
              <button
                class="primary"
                id="modalVerifyRegistration">
                ✅ Verify Application
              </button>

              <button
                class="danger"
                id="modalRejectRegistration">
                ❌ Reject
              </button>
            `
            : ""
        }

      </div>

    </div>
  `;

  document.body.appendChild(modal);

  modal
    .querySelector("#closeRegistrationDetails")
    ?.addEventListener(
      "click",
      () => modal.remove()
    );

  modal
    .querySelector("#modalVerifyRegistration")
    ?.addEventListener(
      "click",
      async () => {
        modal.remove();
        await updateRegistrationStatus(
          id,
          "verified"
        );
      }
    );

  modal
    .querySelector("#modalRejectRegistration")
    ?.addEventListener(
      "click",
      async () => {
        modal.remove();
        await updateRegistrationStatus(
          id,
          "rejected"
        );
      }
    );
}

function setupButtons() {

  $("refreshRegistrations")
    ?.addEventListener(
      "click",
      loadRegistrations
    );

  $("filterAllRegistrations")
    ?.addEventListener(
      "click",
      () => {
        currentFilter = "all";
        renderRegistrations();
      }
    );

  $("filterPendingRegistrations")
    ?.addEventListener(
      "click",
      () => {
        currentFilter = "pending";
        renderRegistrations();
      }
    );

  $("filterVerifiedRegistrations")
    ?.addEventListener(
      "click",
      () => {
        currentFilter = "verified";
        renderRegistrations();
      }
    );

  $("filterRejectedRegistrations")
    ?.addEventListener(
      "click",
      () => {
        currentFilter = "rejected";
        renderRegistrations();
      }
    );

  $("teamRegistrationTable")
    ?.addEventListener(
      "click",
      async (event) => {

        const view =
          event.target.closest(
            "[data-registration-view]"
          );

        if (view) {
          showRegistrationDetails(
            view.dataset.registrationView
          );
          return;
        }

        const verify =
          event.target.closest(
            "[data-registration-verify]"
          );

        if (verify) {
          await updateRegistrationStatus(
            verify.dataset.registrationVerify,
            "verified"
          );
          return;
        }

        const reject =
          event.target.closest(
            "[data-registration-reject]"
          );

        if (reject) {
          await updateRegistrationStatus(
            reject.dataset.registrationReject,
            "rejected"
          );
        }
      }
    );
}

onAuthStateChanged(auth, async (user) => {

  const section =
    $("teamRegistrationSection");

  if (!user || !isAdmin(user)) {

    if (section) {
      section.classList.add("hidden");
    }

    return;
  }

  if (section) {
    section.classList.remove("hidden");
  }

  setupButtons();
  await loadRegistrations();
});
