# Twilio Emergency Contact SMS Setup Guide

## Overview
This guide explains how to set up Twilio SMS integration for emergency contact notifications in the SWIFTRIDE app. When a passenger starts a ride, their emergency contact will automatically receive an SMS with:
- Pickup location
- Destination address
- Driver name
- Driver phone number

## Prerequisites
- Twilio Account (Free trial available at https://www.twilio.com)
- Firebase Project with Cloud Functions enabled
- Node.js 18+ and Firebase CLI installed

## Step 1: Create Twilio Account & Get Credentials

1. Go to https://www.twilio.com/console
2. Sign up for a free Twilio account
3. Verify your phone number
4. From the Twilio Console, note down:
   - **Account SID** (visible on Dashboard)
   - **Auth Token** (visible on Dashboard)
   - **Phone Number** (Buy a number from Twilio or use trial credits)

## Step 2: Set Up Firebase Cloud Functions

### 2.1 Install Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### 2.2 Create Functions Directory (Already created at `functions/`)
The functions folder already exists with `package.json` and `src/index.ts`

### 2.3 Install Dependencies
```bash
cd functions
npm install
```

### 2.4 Set Environment Variables
Create a `.env.local` file in the `functions` directory:

```env
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890  # Your Twilio phone number
```

### 2.5 Deploy Cloud Functions
```bash
cd functions
firebase deploy --only functions
```

## Step 3: Configure Emergency Contact in App

### UI for Adding Emergency Contact:
1. Users go to **Profile** → **Edit Profile**
2. Find **Emergency Contact** section (red heart icon)
3. Enter:
   - **Contact Name** (e.g., "Mom", "Brother")
   - **Phone Number** (must be in E.164 format: +250788000000)
4. Click **Save Contact**

The contact is stored in Firestore at:
```
users/{userId}/emergencyContact: {
  name: string,
  phone: string  // E.164 format
}
```

## Step 4: How It Works

### Automatic SMS Sending:
1. Passenger requests a ride
2. Driver accepts the ride
3. **When driver arrives and passenger confirms to start** → SMS sent automatically
4. Emergency contact receives:
   ```
   🚗 EMERGENCY ALERT: John Doe is on a ride.
   📍 From: Kimironko, Kigali
   📍 To: Kicukiro, Kigali
   👤 Driver: Jane Smith
   📞 Driver Phone: +250788123456
   ⏰ Time: 2024-04-27 14:30:00
   
   If you don't recognize this activity, contact authorities immediately.
   ```

### SMS Logs:
All SMS activity is logged in Firestore for audit purposes:
- **Collection**: `emergency_sms_logs`
- **Fields**: `userId`, `rideId`, `messageId`, `status`, `sentAt`

Errors are logged in:
- **Collection**: `emergency_sms_errors`
- **Fields**: `userId`, `error`, `erroredAt`

## Step 5: Cost & Quotas

### Twilio Pricing:
- **Free Trial**: $15 credits (usually covers 30-60 SMS messages)
- **After Trial**: ~$0.0075 per SMS to US, varies by country
- **Rwanda**: ~$0.15 per SMS (check Twilio pricing for exact rates)

### Firebase Cloud Functions:
- **Free Tier**: 2 million invocations/month
- **Always Free**: Invocations up to 125,000/month

## Step 6: Testing

### Test SMS Sending Locally:
```typescript
// In Cloud Functions emulator
firebase emulators:start

// Call function from client:
import { Functions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const sendSMS = httpsCallable(functions, 'sendEmergencyContactSMS');

await sendSMS({
  emergencyContactPhone: '+250788000000',
  pickupAddress: 'Kimironko, Kigali',
  destinationAddress: 'Kicukiro, Kigali',
  driverName: 'John Doe',
  driverPhone: '+250788123456',
  passengerName: 'Jane Smith'
});
```

### Test with Real Twilio:
1. Add your Twilio credentials to `.env.local`
2. Deploy functions: `firebase deploy --only functions`
3. Request a ride in the app
4. Confirm to start the ride
5. Check if emergency contact receives SMS

## Step 7: Troubleshooting

### SMS Not Sending
1. **Check Firestore logs**:
   - Go to Firestore → `emergency_sms_errors` collection
   - Check for error messages

2. **Verify credentials**:
   ```bash
   firebase functions:config:get
   ```

3. **Check Cloud Functions logs**:
   ```bash
   firebase functions:log
   ```

4. **Verify phone format**:
   - Must be in E.164 format: `+250788000000`
   - No spaces or dashes

### "Auth Failed" Error
- Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are correct
- Check Twilio account is active (not suspended)

### "Invalid Phone Number" Error
- Ensure emergency contact phone includes country code: `+250` for Rwanda
- No spaces or special characters except `+`

## Step 8: Security Best Practices

### 1. Firestore Security Rules
Add these rules to protect SMS logs:

```
match /emergency_sms_logs/{document=**} {
  allow read: if request.auth.uid == resource.data.userId;
  allow write: if false; // Only Cloud Functions can write
}

match /emergency_sms_errors/{document=**} {
  allow read: if request.auth.uid != null && request.auth.token.admin == true;
  allow write: if false;
}
```

### 2. Environment Variables
- Never commit `.env.local` to Git
- Use Firebase Secrets Manager for production:
  ```bash
  firebase functions:config:set twilio.sid="YOUR_SID"
  firebase functions:config:set twilio.token="YOUR_TOKEN"
  firebase functions:config:set twilio.phone="+1234567890"
  ```

### 3. Rate Limiting
Implement rate limiting in Cloud Functions to prevent SMS abuse:
```typescript
// Check if user has sent SMS in last 5 minutes
const recentLogs = await db.collection('emergency_sms_logs')
  .where('userId', '==', userId)
  .where('sentAt', '>', new Date(Date.now() - 5 * 60000))
  .limit(1)
  .get();

if (!recentLogs.empty) {
  throw new Error('SMS limit reached. Try again in 5 minutes.');
}
```

## Step 9: Monitoring & Analytics

### Track SMS Metrics:
```typescript
// In Firestore
const logs = await db.collection('emergency_sms_logs')
  .where('sentAt', '>', new Date(Date.now() - 7 * 24 * 60 * 60000)) // Last 7 days
  .get();

console.log(`Total SMS sent: ${logs.size}`);
console.log(`Unique users: ${new Set(logs.docs.map(d => d.data().userId)).size}`);
```

## Step 10: Future Enhancements

1. **Multiple Emergency Contacts**: Support up to 3 contacts
2. **Notification Preferences**: Let users choose SMS/Push/Email
3. **Real-time Location Sharing**: Include live tracking link in SMS
4. **Two-way SMS**: Allow emergency contact to reply
5. **WhatsApp Integration**: Use Twilio WhatsApp API instead of SMS
6. **Multi-language SMS**: Send SMS in user's preferred language

## Support & Troubleshooting

- **Twilio Docs**: https://www.twilio.com/docs/sms
- **Firebase Functions**: https://firebase.google.com/docs/functions
- **Twilio Community**: https://www.twilio.com/community

## Checklist

- [ ] Created Twilio account
- [ ] Got Account SID, Auth Token, Phone Number
- [ ] Set environment variables in `functions/.env.local`
- [ ] Ran `firebase deploy --only functions`
- [ ] Tested SMS sending with test phone number
- [ ] Added emergency contact in user profile
- [ ] Verified SMS received on phone
- [ ] Monitored Firestore logs for errors
- [ ] Set up Firestore security rules
- [ ] Deployed to production

---

**Last Updated**: April 2026
**Twilio SDK Version**: 4.0.0
**Firebase Functions Runtime**: Node.js 20
