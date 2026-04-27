# Emergency Contact SMS - Quick Start Guide

## 🎯 5-Minute Setup

### Step 1: Create Twilio Account (2 min)
1. Go to https://www.twilio.com/console
2. Sign up → Verify your phone number
3. Copy your **Account SID** and **Auth Token** from Dashboard
4. Buy a phone number (or use trial number)

### Step 2: Add Credentials (2 min)
Create file: `functions/.env.local`

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### Step 3: Deploy (1 min)
```bash
cd functions
npm install
firebase deploy --only functions
```

### Step 4: Test
1. Open app → Profile
2. Edit Profile → Emergency Contact section
3. Enter:
   - **Name**: Your name
   - **Phone**: +250XXXXXXXXX (your phone)
4. Save
5. Request a ride → Start ride
6. ✅ You receive SMS!

---

## 📱 For Users

### Adding Emergency Contact
1. **Profile Tab** → Edit Profile
2. Find **Emergency Contact** (red heart icon)
3. Enter name & phone (+250788000000 format)
4. Click **Save**

### What Happens
- When you start a ride
- Your emergency contact gets SMS with:
  - Where you're going FROM
  - Where you're going TO
  - Driver's name & phone
  - Time of ride

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| SMS not sent | Check phone format: +250XXXXXXXXX |
| "Auth Failed" | Verify Account SID & Auth Token |
| "Invalid number" | Include country code & + sign |
| No SMS received | Check Twilio account has credits |

---

## 📊 Monitor

### Check SMS Logs
Go to Firebase Console → Firestore → `emergency_sms_logs`

### View Errors
Firebase Console → Firestore → `emergency_sms_errors`

---

## 💡 Pro Tips

- 📞 Test with your own number first
- 🌍 Include country code (+250 for Rwanda)
- 💰 Twilio free trial: $15 (tests ~100 SMS)
- 🔒 Phone numbers stored securely in Firestore
- ⏱️ SMS sent in <30 seconds

---

## 📚 More Info

- **Full Setup**: See [TWILIO_SETUP.md](./TWILIO_SETUP.md)
- **Features**: See [EMERGENCY_CONTACT_FEATURE.md](./EMERGENCY_CONTACT_FEATURE.md)
- **Implementation**: See [EMERGENCY_CONTACT_IMPLEMENTATION.md](./EMERGENCY_CONTACT_IMPLEMENTATION.md)

---

**Ready to deploy?** Run: `firebase deploy --only functions` 🚀
