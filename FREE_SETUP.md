# VIVEKANANDA CRICKET ASSOCIATION OF JELIAKHALI — ₹0 Hosting/Software Setup

## যা লাগবে
- GitHub Free account
- Firebase Spark / no-cost project
- একটি admin email/password

## যা লাগবে না
- VPS/server
- paid hosting
- paid API
- Cloud Functions
- SMS gateway
- payment gateway

## Recommended deployment
GitHub Pages → static HTML/CSS/JS → Firebase Authentication + Firestore.

সব tournament logic client-side হওয়ায় Cloud Functions না থাকলেও:
- innings change
- target chase
- Super Over
- match winner
- bracket progression
- records
- awards

চলবে।

## Cost control
প্রতি বলের live match document update করা হয়, সঙ্গে event log রাখা হয়। Player career aggregate প্রতি বলের বদলে match শেষ হওয়ার সময় একবার লেখা হয়। এতে Firestore write usage কম থাকে।

## Free-tier সতর্কতা
Free quota-এর মধ্যে থাকার জন্য একই match বহু device-এ একসঙ্গে scoring করা উচিত নয়। Public viewer অনেক device-এ থাকলে Firestore read usage বাড়তে পারে। Firebase Console-এর Usage/Quotas নিয়মিত দেখুন।
