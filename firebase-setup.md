# Firebase Setup — VCAJ Cricket

1. Firebase Console-এ নতুন project তৈরি করুন।
2. Web App add করুন এবং `firebase-config.js`-এ config বসান।
3. Authentication → Sign-in method → Email/Password চালু করুন।
4. Authentication → Users-এ scorer/admin account তৈরি করুন।
5. `firestore.rules`-এ `YOUR_ADMIN_EMAIL@example.com`-এর জায়গায় admin/scorer email বসিয়ে Rules publish করুন।
6. Firestore Database তৈরি করুন।
7. প্রথমে `teams`, `players`, `members`, `seasons` collection-এ data যোগ করুন। Player document ID স্থায়ী রাখুন, যেমন `player-001`—তাহলে বহু বছরের career record একই player-এর সাথে থাকবে।
8. `scorer.html` খুলে admin login করুন, Match ID দিয়ে Load/Create Match করুন।
9. Scorer-এর প্রতিটি delivery `matches/{matchId}/events`-এ event হিসেবে এবং live state `liveMatches/{matchId}`-এ সংরক্ষিত হয়। Player totals `players/{playerId}`-এ incrementalভাবে update হয়।
10. Public সবাই `index.html` থেকে live score দেখতে পারবে।

## গুরুত্বপূর্ণ
এই V3 starter-এর scoring engine runs/extras/legal balls/strike rotation/wicket/bowler figures/undo-session support করে। Tournament-specific rules, Super Over, tie/no-result, innings switching, automatic winner/bracket advancement এবং সম্পূর্ণ career-stat reconciliation-এর জন্য পরের scoring-engine layer যোগ করা উচিত।
