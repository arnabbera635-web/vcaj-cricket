import {
  auth,
  signInWithEmailAndPassword
} from "./firebase.js";

const $ = (id) => document.getElementById(id);

function show(id, message) {
  const el = $(id);
  if (el) el.textContent = message;
}

const phoneToAuthEmail = (phone) =>
  `m${String(phone || "").replace(/\D/g, "")}@member.vcajcricket.com`;

// ===============================
// ADMIN LOGIN
// ===============================
const adminButton = $("homeAdminLogin");

if (adminButton) {
  adminButton.addEventListener("click", async () => {

    const email = $("homeAdminEmail")?.value.trim();
    const password = $("homeAdminPassword")?.value || "";

    show("homeAdminMsg", "");

    if (!email) {
      show("homeAdminMsg", "Admin Email দিন।");
      return;
    }

    if (!password) {
      show("homeAdminMsg", "Admin Password দিন।");
      return;
    }

    adminButton.disabled = true;
    adminButton.textContent = "Login হচ্ছে...";

    try {

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      show("homeAdminMsg", "Login সফল। Admin Panel খোলা হচ্ছে...");

      setTimeout(() => {
        window.location.href = "scorer.html";
      }, 300);

    } catch (error) {

      console.error("ADMIN LOGIN ERROR:", error);

      let message = "Admin Login ব্যর্থ।";

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        message = "Email অথবা Password ভুল।";
      } else if (error.code === "auth/invalid-email") {
        message = "Admin Email সঠিক নয়।";
      } else if (error.code === "auth/too-many-requests") {
        message = "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
      } else if (error.message) {
        message = "Login Error: " + error.message;
      }

      show("homeAdminMsg", message);

    } finally {

      adminButton.disabled = false;
      adminButton.textContent = "Admin Login";

    }
  });
}


// ===============================
// MEMBER LOGIN
// ===============================
const memberButton = $("homeMemberLogin");

if (memberButton) {
  memberButton.addEventListener("click", async () => {

    const phone = $("homeMemberPhone")?.value.trim();
    const password = $("homeMemberPassword")?.value || "";

    show("homeMemberMsg", "");

    const cleanPhone = String(phone || "").replace(/\D/g, "");

    if (cleanPhone.length < 10) {
      show("homeMemberMsg", "সঠিক Mobile Number দিন।");
      return;
    }

    if (!password) {
      show("homeMemberMsg", "Member Password দিন।");
      return;
    }

    memberButton.disabled = true;
    memberButton.textContent = "Login হচ্ছে...";

    try {

      await signInWithEmailAndPassword(
        auth,
        phoneToAuthEmail(cleanPhone),
        password
      );

      show("homeMemberMsg", "Login সফল। Member Panel খোলা হচ্ছে...");

      setTimeout(() => {
        window.location.href = "member-panel.html";
      }, 300);

    } catch (error) {

      console.error("MEMBER LOGIN ERROR:", error);

      let message = "Member Login ব্যর্থ।";

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        message = "Mobile Number অথবা Password ভুল।";
      } else if (error.code === "auth/too-many-requests") {
        message = "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
      } else if (error.message) {
        message = "Login Error: " + error.message;
      }

      show("homeMemberMsg", message);

    } finally {

      memberButton.disabled = false;
      memberButton.textContent = "Member Login";

    }
  });
}
