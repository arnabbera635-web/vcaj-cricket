VCAJ AWARDS FILES

Upload these files to the same GitHub Pages folder as firebase.js:
1. awards.html
2. awards.js

Important:
- The page uses the existing Firebase collections: players, matches/{matchId}/events, and awards.
- It requires the existing firebase.js exports: auth, db, isAdmin, collection, doc, getDoc, getDocs, setDoc, deleteDoc, onAuthStateChanged, signOut.
- Saved awards are written to Firestore collection: awards.
- Each saved award has public:true so the public panel can display only selected winners.
- Firestore Rules must allow public read of awards and admin-only create/update/delete. Do not make awards writable by the public.

The public home page still needs its Awards section wired to collection("awards") if that section is not already present.
