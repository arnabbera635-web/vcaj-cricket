# Production security notes

- Member list is authenticated-only; public visitors cannot read `memberDirectory`.
- Member private profile is readable only by the member's own Firebase UID or the admin.
- Members cannot write scores, matches, players, teams, awards, or member records.
- Admin writes remain restricted to `vcajofficial@gmail.com`.
- Member seed data and password CSV are intentionally not shipped in the public website package.
- Initial passwords follow the requested formula for compatibility. Members should change them when convenient; the change is optional.
- For stronger protection, enable Firebase email-enumeration protection and a sensible password policy in Authentication settings.
- Do not publish private password CSV files to GitHub.
- Firebase Spark/Firestore free quotas apply; if quotas are exceeded, service usage can be stopped until the quota resets on Spark rather than silently creating a bill.
