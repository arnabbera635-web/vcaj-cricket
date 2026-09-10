# Member Account Setup

Member accounts are created with a unique initial password generated as:

`first 4 alphabetic characters of contact email + @ + last 4 digits of mobile`

Example: `muttam495@gmail.com` + `9144966118` -> `mutt@6118`

The initial password is only a first-login password. `mustChangePassword=true` is stored in `memberAccounts/{uid}`. After successful first login, the Member Panel requires the member to choose a new password. Password change uses Firebase Authentication email/password and does not require SMS/OTP billing.

Do not publish a CSV containing passwords. The setup page displays each initial password only to the logged-in Admin during one-time account creation.


## Password/Login Fix
Member Firebase login identity now uses the stable Member ID (for example M001) instead of the old phone-based auth identity. Members can log in using Member ID, registered mobile number, or registered email; all resolve to the same Member-ID-based Firebase account. Existing old phone-based accounts are not used by the new login flow.
