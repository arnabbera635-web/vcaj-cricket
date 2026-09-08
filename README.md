# VCAJ Cricket — Free 16-Team Knockout Tournament Suite

এই package-টি paid hosting, paid API, SMS gateway, Cloud Functions বা payment service ছাড়াই চালানোর জন্য তৈরি।

## Free architecture
- **Frontend/Hosting:** GitHub Pages Free
- **Database:** Firebase Firestore Spark / no-cost tier
- **Login:** Firebase Authentication Email/Password
- **Live score:** Firestore `onSnapshot()`
- **No server bill:** bracket progression, match result, Super Over এবং awards logic browser-side JavaScript-এ
- **No SMS dependency:** receipt/record চাইলে পরে manual share/WhatsApp ব্যবহার করা যাবে

## Tournament features
- 16-team knockout: R16 → QF → SF → Final
- Permanent season records
- Team and Player IDs
- Bracket auto-progression after a completed match
- Match ID and bracket slot tracking
- 1st innings + 2nd innings target chase
- CRR + RRR + target
- Wide, No Ball, Bye, Leg Bye
- Bowled, Caught, LBW, Run Out, Stumped, Hit Wicket, Obstructing, Hit Twice, Timed Out, Retired Out
- Catch / Stumping / Run Out fielder records
- 1-over Super Over for tied matches
- Match result and tournament winner saved automatically
- Ball-by-ball event history
- Undo for the current scoring session
- Career batting, bowling and fielding records
- Awards page
- Public read-only pages
- Admin/scorer authentication

## Firebase free-tier note
এই app কোনো paid Firebase feature প্রয়োজন করে না। Firestore Spark quota-এর মধ্যে usage রাখতে match scoring data-কে event-based রাখা হয়েছে এবং career player statistics match শেষ হওয়ার সময় একবার aggregate করা হয়। খুব বেশি simultaneous tournament বা অতিরিক্ত public traffic হলে Firebase-এর current quota দেখে নিতে হবে।

## Setup
1. Firebase project তৈরি করুন এবং Firestore + Authentication Email/Password চালু করুন।
2. `firebase-config.js`-এ Firebase Web App config দিন।
3. `firestore.rules` Firebase Console-এ publish করুন।
4. GitHub repository-তে সব files root-এ upload করুন।
5. GitHub Pages → Deploy from branch → `main` → `/(root)` নির্বাচন করুন।
6. `bracket.html`-এ 16 seed save করুন।
7. Scorer থেকে অথবা bracket-এর **Open Scorer** link থেকে match শুরু করুন।
8. Bracket Match field-এ সঠিক slot নির্বাচন করুন; match শেষ হলে winner নিজে থেকে bracket-এ যাবে।

## Important
- Firebase Web API key public frontend-এ থাকা স্বাভাবিক; নিরাপত্তা Firestore Rules/Auth দিয়ে করতে হবে।
- Browser key-এ আপনার GitHub Pages domain restriction দেওয়া ভালো।
- Firebase Spark-এর current limits Google/Firebase Console-এ সময়ের সঙ্গে বদলাতে পারে।

## Hat-trick Records
- Bowler Hat-trick: 3 consecutive legal deliveries by the same bowler, all credited wickets.
- Batter Hat-trick: 3 consecutive legal deliveries by the same batter, each hit for 4 or 6.
- Fielder Hat-trick: 3 consecutive dismissals credited to the same fielder.
- Match hat-tricks are saved permanently in the match record and player career counters.
- Public Awards and Records pages display the season/all-time hat-trick records.


## Public Real-Time Live Score
- `live.html` is a public read-only live score panel.
- It listens to `liveMatches` with Firestore `onSnapshot`, so score, wickets, overs, target, CRR/RRR, players, bowler and commentary update automatically without refresh.
- `matches.html` also uses a real-time listener for the match list and links live matches to the public live panel.
