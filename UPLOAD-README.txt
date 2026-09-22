VCAJ ADMIN SPLIT — VERIFIED PACKAGE

This package was checked against the current VCAJ registration form and the supplied scorer.js structure.

IMPORTANT
1. Keep your existing firebase-config.js unchanged.
2. Upload/replace the files in this package in the repository root.
3. Do NOT delete your existing public pages such as team-registration.html, live.html, bracket.html, matches.html, players.html, records.html, season-awards.html unless you intentionally replace them separately.
4. Publish firestore.rules in Firebase Console -> Firestore Database -> Rules. Uploading the rules file to GitHub does NOT publish Firebase rules.
5. Hard refresh the site after upload (or wait for GitHub Pages deployment).

ADMIN PAGES
- admin.html — admin dashboard
- scorer.html — match setup + live scoring only
- team-registrations.html — registration applications, details, Verify, Reject
- players.html — teams and players
- awards.html — player/tournament awards
- accounts.html — accounting summary
- members.html — member management

TEAM REGISTRATION VERIFICATION
The admin registration page reads the same `teamRegistrations` collection used by the current public registration form.
It supports the actual current fields: season, teamName, whatsapp, contact, email, location, rulesAccepted, feeAcknowledged, stayRequired, notes, status, submittedAt.
If older/newer records also contain payment fields such as entryFee, kasanmani, totalPaid, totalDue, paymentHistory, verificationCode, they remain visible in Details and compatible status/receipt verification is retained.

SUPER OVER FIXES
- 6 legal balls OR 2 wickets ends each Super Over innings.
- Chasing side wins immediately after passing the target.
- If Super Over scores tie, another Super Over can be started.
- Multiple Super Over rounds retain their history.
- Match/player statistics are not deliberately double-counted by finalization.

SECURITY
Each admin page waits for the admin authentication guard before loading its Firestore data.
The Firestore rules preserve member/member-account/tournament-account access patterns and add the awards and receipt-verification collections.
