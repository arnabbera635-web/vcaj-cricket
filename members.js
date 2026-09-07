import {
  auth,
  db,
  isAdmin,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "./firebase.js";

const $ = id => document.getElementById(id);

let members = [];
let teams = [];
let currentUser = null;
let editingId = null;

const esc = s => String(s ?? "").replace(/[&<>'"]/g, c => ({
  "&":"&amp;",
  "<":"&lt;",
  ">":"&gt;",
  "'":"&#39;",
  '"':"&quot;"
}[c]));

async function load() {
  const [ms, ts] = await Promise.all([
    getDocs(collection(db, "members")),
    getDocs(collection(db, "teams"))
  ]);

  members = ms.docs.map(d => ({ id:d.id, ...d.data() }));
  teams = ts.docs.map(d => ({ id:d.id, ...d.data() }));

  renderTeams();
  render();
}

function renderTeams() {
  $("memberTeam").innerHTML =
    `<option value="">দল নেই / প্রযোজ্য নয়</option>` +
    teams.map(t =>
      `<option value="${esc(t.id)}">${esc(t.name || t.id)}</option>`
    ).join("");
}

function renderAuth() {
  if (isAdmin(currentUser)) {
    $("authBox").innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <strong>Admin mode চালু</strong>
        <button id="logoutBtn">Logout</button>
      </div>`;

    $("memberFormCard").classList.remove("hidden");

    $("logoutBtn").onclick = () => signOut(auth);
  } else {
    $("authBox").innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input id="adminEmail" type="email"
          value="vcajofficial@gmail.com"
          placeholder="Admin email">

        <input id="adminPassword" type="password"
          placeholder="Password">

        <button id="loginBtn">Admin Login</button>
        <span id="loginMsg"></span>
      </div>`;

    $("memberFormCard").classList.add("hidden");
    $("loginBtn").onclick = login;
  }
}

async function login() {
  const email = $("adminEmail").value.trim();
  const password = $("adminPassword").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    $("loginMsg").textContent = "Login হয়নি। Password যাচাই করুন।";
  }
}

function render() {
  $("memberCount").textContent = `${members.length} জন`;

  if (!members.length) {
    $("members").innerHTML = "<p>এখনও কোনো সদস্য যোগ করা হয়নি।</p>";
    return;
  }

  $("members").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>নাম</th>
          <th>ভূমিকা</th>
          <th>ফোন</th>
          <th>দল</th>
          ${isAdmin(currentUser) ? "<th>Action</th>" : ""}
        </tr>
      </thead>
      <tbody>
        ${members.map(m => `
          <tr>
            <td>${esc(m.name)}</td>
            <td>${esc(m.role)}</td>
            <td>${esc(m.phone)}</td>
            <td>${esc(m.teamName || "-")}</td>

            ${isAdmin(currentUser) ? `
              <td>
                <button data-edit="${esc(m.id)}">Edit</button>
                <button data-delete="${esc(m.id)}">Delete</button>
              </td>
            ` : ""}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  document.querySelectorAll("[data-edit]")
    .forEach(b => b.onclick = () => editMember(b.dataset.edit));

  document.querySelectorAll("[data-delete]")
    .forEach(b => b.onclick = () => deleteMember(b.dataset.delete));
}

async function saveMember() {
  if (!isAdmin(currentUser)) return;

  const name = $("memberName").value.trim();
  const role = $("memberRole").value.trim();
  const phone = $("memberPhone").value.trim();
  const teamId = $("memberTeam").value;

  if (!name) {
    $("memberMsg").textContent = "নাম অবশ্যই দিতে হবে।";
    return;
  }

  const team = teams.find(t => t.id === teamId);

  const data = {
    name,
    role,
    phone,
    teamId: teamId || "",
    teamName: team ? (team.name || "") : "",
    updatedAt: new Date().toISOString()
  };

  if (editingId) {
    await updateDoc(doc(db, "members", editingId), data);
    $("memberMsg").textContent = "সদস্য আপডেট হয়েছে।";
  } else {
    const id = `member-${Date.now()}`;

    await setDoc(doc(db, "members", id), {
      id,
      ...data,
      createdAt: new Date().toISOString()
    });

    $("memberMsg").textContent = "নতুন সদস্য যোগ হয়েছে।";
  }

  clearForm();
  await load();
}

function editMember(id) {
  const m = members.find(x => x.id === id);
  if (!m || !isAdmin(currentUser)) return;

  editingId = id;

  $("formTitle").textContent = "সদস্য Edit করুন";
  $("memberName").value = m.name || "";
  $("memberRole").value = m.role || "";
  $("memberPhone").value = m.phone || "";
  $("memberTeam").value = m.teamId || "";

  $("cancelEdit").classList.remove("hidden");
}

async function deleteMember(id) {
  const m = members.find(x => x.id === id);

  if (!m || !isAdmin(currentUser)) return;

  if (!confirm(`“${m.name || id}” সদস্যকে Delete করতে চান?`)) return;

  try {
    await deleteDoc(doc(db, "members", id));
    await load();
  } catch (e) {
    alert("Delete করা যায়নি। Firestore Rules-এ admin delete অনুমতি দিতে হবে।");
  }
}

function clearForm() {
  editingId = null;

  $("formTitle").textContent = "নতুন সদস্য যোগ করুন";
  $("memberName").value = "";
  $("memberRole").value = "";
  $("memberPhone").value = "";
  $("memberTeam").value = "";
  $("cancelEdit").classList.add("hidden");
}

$("saveMember").onclick = saveMember;
$("cancelEdit").onclick = clearForm;
$("refresh").onclick = load;

onAuthStateChanged(auth, u => {
  currentUser = u;
  renderAuth();
  render();
});

load();
