import { auth, signInWithEmailAndPassword } from "./firebase.js";

const $ = (id) => document.getElementById(id);

// ADMIN LOGIN
$("homeAdminLogin").onclick = async () => {
  const email = $("homeAdminEmail").value.trim();
  const password = $("homeAdminPassword").value;

  $("homeAdminMsg").textContent = "Login হচ্ছে...";

  try {
    await signInWithEmailAndPassword(auth, email, password);

    $("homeAdminMsg").textContent = "Login সফল। Admin Panel খুলছে...";

    window.location.href = "scorer.html";

  } catch (error) {
    console.error(error);

    $("homeAdminMsg").textContent =
      "ERROR: " + error.code + " — " + error.message;
  }
};


// MEMBER LOGIN
$("homeMemberLogin").onclick = async () => {
  const phone = $("homeMemberPhone").value.trim();
  const password = $("homeMemberPassword").value;

  if (phone.replace(/\D/g, "").length < 10) {
    $("homeMemberMsg").textContent = "সঠিক Mobile Number দিন।";
    return;
  }

  $("homeMemberMsg").textContent = "Login হচ্ছে...";

  const authEmail =
    "m" +
    phone.replace(/\D/g, "") +
    "@member.vcajcricket.com";

  try {
    await signInWithEmailAndPassword(
      auth,
      authEmail,
      password
    );

    $("homeMemberMsg").textContent =
      "Login সফল। Member Panel খুলছে...";

    window.location.href = "member-panel.html";

  } catch (error) {
    console.error(error);

    $("homeMemberMsg").textContent =
      "ERROR: " + error.code + " — " + error.message;
  }
};
