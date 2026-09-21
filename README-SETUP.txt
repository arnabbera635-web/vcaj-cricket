VCAJ Team Registration — Complete Min ₹2,000 package

এই package-এ:
1. Entry Fee total ₹3,501; minimum payment ₹2,000.
2. Kasanmani total ₹1,500.
3. Live calculation: Entry Due + Kasanmani Due + Total Due.
4. Registration এবং receipt verification একই Firestore batch-এ atomicভাবে save হয়।
5. Receipt PDF browser Print → Save as PDF দিয়ে তৈরি হয়; Firebase Storage ব্যবহার করে না।
6. receiptVerifications collection-এর জন্য complete Firestore Rules included.
7. Rules database level-এ Entry Fee minimum ₹2,000 enforce করে।

GitHub:
- team-registration.html replace
- team-registration.js replace
- verify-receipt.html replace
- verify-receipt.js replace

Firebase:
- Firestore → Rules → পুরোনো rules সম্পূর্ণ Select All/Delete করে এই package-এর firestore.rules পুরোটা paste করুন → Publish.
- পুরোনো rules-এর সঙ্গে নতুন rules মিশিয়ে paste করবেন না।

Expected calculation:
Entry Fee paid ₹2,000 → due ₹1,501
Kasanmani paid ₹0 → due ₹1,500
Total paid ₹2,000 → total due ₹3,001

Important:
এই package Firebase Storage ব্যবহার করে না, তাই receipt upload-এর জন্য Blaze plan প্রয়োজন নেই।
