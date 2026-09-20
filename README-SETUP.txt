# VCAJ Payment Receipt — Free / No Storage
- No receipt image/PDF is uploaded to Firebase.
- Entry Fee minimum ₹500 is mandatory.
- Registration creates a unique Registration ID and 32-hex Verification Code.
- Receipt can be printed/saved locally as PDF.
- Public verification page checks the official verification record in Firestore.
- This makes receipts tamper-evident/officially verifiable, but no browser-only system can make a PDF literally impossible to copy or screenshot.
- No Firebase Storage / Blaze plan is required by this feature.
- Firestore public verification data is intentionally limited to minimum receipt-verification fields.
