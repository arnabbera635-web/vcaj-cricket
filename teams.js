import {
  auth,
  db,
  isAdmin,
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "./firebase.js";

const $ = id => document.getElementById(id);
let teams = [];
let currentUser = null;

const esc = s => String(s ?? "").replace(/[&<>'"]/g, c => ({
  "&":"&amp;",
  "<":"&lt;",
  ">":"&gt;",
  "'":"&#39;",
  '"':"&quot;"
}[c]));

function renderAuth() {
  if (isAdmin(currentUser)) {
    $("authBox").innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <strong>Admin mode চালু</strong>
        <button id="logoutBtn">Logout</button>
      </div>`;
    $("logoutBtn").onclick = () => signOut(auth);
  } else {
    $("authBox").innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input id="adminEmail" type="email"
          placeholder="Admin email"
          value="vcajofficial@gmail.com">
        <input id="adminPassword" type="password"
          placeholder="Password">
        <button id="loginBtn">Admin Login</button>
        <span id="loginMsg"></span>
      </div>`;
    $("loginBtn").onclick = login;
  }
}

async function login() {
  const email = $("adminEmail").value.trim();
  const password = $("adminPassword").value;

  if (!email || !password) {
    $("loginMsg").textContent = "Email ও password দিন।";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    $("loginMsg").textContent = "";
  } catch (e) {
    $("loginMsg").textContent = "Login হয়নি। Password যাচাই করুন।";
  }
}

async function load() {
  const s = await getDocs(collection(db, "teams"));

  teams = s.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (a.name || "").localeCompare(b.name || ""));

  render();
}

function render() {
  const admin = isAdmin(currentUser);

  $("teams").innerHTML =
    teams.map(x => `
      <div class="card team">
        <h2>${esc(x.name || x.id)}</h2>
        <p>${esc(x.shortName || "")}</p>
        <p>${x.playersCount || 0} players</p>

        ${admin ? `
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
            <button data-edit="${esc(x.id)}">Edit</button>
            <button data-delete="${esc(x.id)}">Delete</button>
          </div>
        ` : ""}
      </div>
    `).join("") || "<p>Firebase-এ team data যোগ করুন।</p>";

  document.querySelectorAll("[data-edit]")
    .forEach(b => b.onclick = () => editTeam(b.dataset.edit));

  document.querySelectorAll("[data-delete]")
    .forEach(b => b.onclick = () => removeTeam(b.dataset.delete));
}

async function editTeam(id) {
  const t = teams.find(x => x.id === id);

  if (!t || !isAdmin(currentUser)) return;

  const name = prompt(
    "দলের নতুন নাম লিখুন:",
    t.name || ""
  );

  if (name === null) return;

  const shortName = prompt(
    "দলের নতুন Short Name লিখুন:",
    t.shortName || ""
  );

  if (shortName === null) return;

  if (!name.trim()) {
    alert("দলের নাম খালি রাখা যাবে না।");
    return;
  }

  await updateDoc(doc(db, "teams", id), {
    name: name.trim(),
    shortName: shortName.trim()
  });

  const ps = await getDocs(collection(db, "players"));

  await Promise.all(
    ps.docs
      .filter(p => p.data().teamId === id)
      .map(p =>
        updateDoc(
          doc(db, "players", p.id),
          { teamName: name.trim() }
        )
      )
  );

  await load();

  alert("দলের নাম আপডেট হয়েছে।");
}

async function removeTeam(id) {
  const t = teams.find(x => x.id === id);

  if (!t || !isAdmin(currentUser)) return;

  if (Number(t.playersCount || 0) > 0) {
    alert(
      "এই দলে খেলোয়াড় আছে। আগে খেলোয়াড়গুলো সরান/অন্য দলে দিন, তারপর দল Delete করুন।"
    );
    return;
  }

  if (!confirm(
    `“${t.name || id}” দলটি Delete করতে চান? এটি স্থায়ীভাবে মুছে যাবে।`
  )) return;

  await deleteDoc(doc(db, "teams", id));

  await load();
}

$("refresh").onclick = load;

onAuthStateChanged(auth, u => {
  currentUser = u;
  renderAuth();
  render();
});

load();
