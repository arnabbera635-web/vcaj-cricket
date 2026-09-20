# VCAJ Team Registration — No Storage Version

This version does NOT upload team receipt images/PDFs to Firebase Storage.

After a successful registration:
1. A unique Registration ID is generated.
2. Registration/payment data is saved in Firestore.
3. A formatted Received Copy opens in a new window.
4. The team can choose Print -> Save as PDF.
5. The PDF is saved on their own phone/computer; the website does not store the PDF.

Admin can view registration/payment details and generate the same Received Copy from the admin panel.

Firebase Storage / Blaze plan is NOT required for this version.
