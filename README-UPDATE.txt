VCAJ Team Registration Fix — Minimum Entry Fee ₹2,000

What is fixed:
1. Entry Fee minimum payment = ₹2,000.
2. Live due calculation: Entry Fee ₹3,501 - paid; Kasanmani ₹1,500 - paid; Total Due = both dues.
3. Firebase import no longer depends on writeBatch; it uses addDoc/setDoc already exported by the existing firebase.js.
4. Receipt verification record is saved to receiptVerifications.

Upload:
- Replace team-registration.js
- If using receipt verification, replace/publish firestore.rules from this package.
- team-registration.html can also be replaced, but its form is unchanged.
