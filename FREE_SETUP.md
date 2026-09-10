# Free Member Setup

No SMS/OTP is used. Firebase Email/Password Authentication is used with a phone-derived internal auth email. Each member receives a unique initial password: first 4 alphabetic characters of their contact email + @ + last 4 digits of their mobile number. On first login, the member must change the password. Password changes use Firebase Authentication and do not require paid SMS.
