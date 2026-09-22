import {
  auth,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "./firebase.js";

const $ = (id) => document.getElementById(id);

const ADMIN_EMAIL = "vcajofficial@gmail.com";

// ================================
// ADMIN LOGIN
// ================================
const adminButton = $("homeAdminLogin");

if (adminButton) {
  adminButton.addEventListener("click", async () => {

    const email = $("homeAdminEmail").value.trim().toLowerCase();
    const password = $("homeAdminPassword").value;

    const msg = $("homeAdminMsg");

    if (!email) {
      msg.textContent = "❌ Admin Email দিন।";
      return;
    }

    if (!password) {
      msg.textContent = "❌ Password দিন।";
      return;
    }

    msg.textContent = "⏳ Firebase থেকে যাচাই করা হচ্ছে...";
    adminButton.disabled = true;

    try {

      // Firebase Authentication
      const credential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      const user = credential.user;

      console.log("Firebase User:", user);
      console.log("Firebase UID:", user.uid);
      console.log("Firebase Email:", user.email);

      // Admin email verification
      if (
        !user.email ||
        user.email.toLowerCase() !== ADMIN_EMAIL
      ) {

        await auth.signOut();

        msg.textContent =
          "❌ এই account-এর Admin permission নেই।";

        adminButton.disabled = false;
        return;
      }

      msg.textContent =
        "✅ Admin Login সফল। Admin Panel খুলছে...";

      // Small delay so message is visible
      setTimeout(() => {
        window.location.href = "scorer.html";
      }, 500);

    } catch (error) {

      console.error("ADMIN LOGIN ERROR:", error);

      let message = "";

      switch (error.code) {

        case "auth/invalid-credential":
          message =
            "❌ Email অথবা Password ভুল। Firebase Authentication-এ account/password পরীক্ষা করুন।";
          break;

        case "auth/wrong-password":
          message =
            "❌ Password ভুল। Firebase Console থেকে password reset করুন।";
          break;

        case "auth/user-not-found":
          message =
            "❌ এই Email-এর Firebase account নেই। Authentication → Users থেকে account তৈরি করুন।";
          break;

        case "auth/invalid-email":
          message =
            "❌ Email address সঠিক নয়।";
          break;

        case "auth/user-disabled":
          message =
            "❌ এই Firebase user account disabled করা আছে।";
          break;

        case "auth/too-many-requests":
          message =
            "❌ অনেকবার ভুল login হয়েছে। কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন।";
          break;

        case "auth/network-request-failed":
          message =
            "❌ Internet/Firebase network connection সমস্যা।";
          break;

        case "auth/operation-not-allowed":
          message =
            "❌ Firebase Authentication-এ Email/Password provider চালু নেই।";
          break;

        default:
          message =
            "❌ Login Error: " +
            error.code +
            "\n" +
            error.message;
      }

      msg.textContent = message;

      adminButton.disabled = false;
    }
  });
}


// ================================
// MEMBER LOGIN
// ================================
const memberButton = $("homeMemberLogin");

if (memberButton) {

  memberButton.addEventListener("click", async () => {

    const phone =
      $("homeMemberPhone").value.trim();

    const password =
      $("homeMemberPassword").value;

    const msg =
      $("homeMemberMsg");

    if (phone.replace(/\D/g, "").length < 10) {
      msg.textContent =
        "❌ সঠিক Mobile Number দিন।";
      return;
    }

    if (!password) {
      msg.textContent =
        "❌ Password দিন।";
      return;
    }

    msg.textContent =
      "⏳ Member Login হচ্ছে...";

    memberButton.disabled = true;

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

      msg.textContent =
        "✅ Login সফল। Member Panel খুলছে...";

      setTimeout(() => {
        window.location.href =
          "member-panel.html";
      }, 500);

    } catch (error) {

      console.error(
        "MEMBER LOGIN ERROR:",
        error
      );

      msg.textContent =
        "❌ " +
        error.code +
        " — " +
        error.message;

      memberButton.disabled = false;
    }
  });
}
