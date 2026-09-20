VCAJ Team Registration update

Files:
1. team-registration.html -> replace existing team-registration.html
2. team-registration.js -> replace existing team-registration.js
3. team-registrations-admin.html -> new admin registration list page
4. team-registrations-admin.js -> new admin registration list logic
5. firestore.rules -> replace existing Firestore rules
6. storage.rules -> publish in Firebase Storage > Rules

Important:
- The updated JS expects Firebase Storage to use the same initialized Firebase app.
- It imports firebase-storage/firebase-app version 12.1.0 from the Google CDN. If firebase.js in the repository uses a different Firebase SDK major version, change both CDN URLs to the same version used by firebase.js.
- Admin email is vcajofficial@gmail.com, matching the current Firestore rules.
- Add a link to team-registrations-admin.html from the Admin panel if desired.
- Receipt files are stored as private Storage objects; the admin page obtains a temporary download URL only after Admin authentication.
