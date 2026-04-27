# Emergency Contact SMS Feature

## 📱 Overview

The SWIFTRIDE app now includes an automatic emergency contact notification system that sends SMS messages to a designated emergency contact when a passenger starts a ride. This feature enhances passenger safety by keeping a trusted person informed about:

- **Pickup Location** - Where the passenger is being picked up from
- **Destination Address** - Where the passenger is going
- **Driver Name** - Who is driving the passenger
- **Driver Phone Number** - Direct contact to reach the driver
- **Timestamp** - When the ride started

## 🎯 Key Features

### 1. **Emergency Contact Management**
- **UI Location**: Profile → Edit Profile → Emergency Contact section
- **Fields**: Name and Phone Number
- **Storage**: Stored securely in Firestore under user profile
- **Validation**: Phone numbers must include country code (e.g., +250 for Rwanda)

### 2. **Automatic SMS Sending**
- **Trigger**: When passenger confirms to start a ride
- **Recipient**: Emergency contact phone number
- **Content**: Formatted message with all ride details
- **Logging**: All SMS activity logged in Firestore for audit trail

### 3. **User Notifications**
- Users see in-app notification confirming SMS was sent
- Safety alert appears in notification center
- No sensitive data shown in notifications

## 🚀 How to Set Up

### For Administrators/Developers:

#### Step 1: Get Twilio Credentials
1. Create account at https://www.twilio.com
2. Get:
   - Account SID
   - Auth Token
   - Phone Number (buy from Twilio)

#### Step 2: Configure Cloud Functions
```bash
cd functions
npm install
```

Add environment variables in `functions/.env.local`:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

#### Step 3: Deploy Cloud Functions
```bash
firebase deploy --only functions
```

### For End Users:

1. Open your profile (Profile tab)
2. Click "Edit Profile"
3. Scroll to "Emergency Contact" section (red heart icon)
4. Click "Edit" button
5. Enter:
   - **Contact Name**: Who this person is (e.g., "Mom", "Sister")
   - **Phone Number**: Full international format (e.g., +250788000000)
6. Click "Save Contact"

## 📨 What the SMS Looks Like

```
🚗 EMERGENCY ALERT: John Doe is on a ride.
📍 From: Kimironko, Kigali
📍 To: Kicukiro, Kigali
👤 Driver: Jane Smith
📞 Driver Phone: +250788123456
⏰ Time: 2024-04-27 14:30:00

If you don't recognize this activity, contact authorities immediately.
```

## 🔐 Security & Privacy

### Data Protection:
- **Encrypted Transmission**: All SMS sent via Twilio's secure infrastructure
- **Firestore Security Rules**: Only the user can view their own emergency contact
- **Phone Validation**: Must include country code to prevent errors
- **Audit Logging**: All SMS logged with timestamps and status

### What's NOT Shared:
- Emergency contact email is never shared
- Real-time location tracking is not included in SMS
- Ride fare information is private
- Passenger's home address if different from pickup

## 📊 Firestore Collections

### emergency_sms_logs
Stores successful SMS deliveries:
```javascript
{
  userId: "abc123",
  rideId: "ride_xyz",
  passengerName: "John Doe",
  emergencyContactPhone: "+250788000000",
  driverName: "Jane Smith",
  driverPhone: "+250788123456",
  messageId: "SM1234567890abcdef",
  status: "sent",
  sentAt: Timestamp,
  pickupAddress: "Kimironko, Kigali",
  destinationAddress: "Kicukiro, Kigali",
  triggerType: "automatic" // or "manual"
}
```

### emergency_sms_errors
Stores failed SMS attempts for debugging:
```javascript
{
  userId: "abc123",
  rideId: "ride_xyz",
  error: "Invalid phone number",
  erroredAt: Timestamp,
  triggerType: "automatic"
}
```

## 💰 Costs

### Twilio Pricing:
- **Free Trial**: $15 credits (good for testing)
- **Ongoing**: ~$0.15 per SMS to Rwanda (varies by country)
- **Monthly Estimate**: 
  - 100 rides/month: ~$15
  - 1,000 rides/month: ~$150
  - 10,000 rides/month: ~$1,500

### Firebase Cloud Functions:
- **Included**: 2 million invocations/month in free tier
- **No additional cost** for this feature in free tier

## ⚠️ Important Notes

### Phone Number Format:
- **MUST** include country code
- **CORRECT**: +250788000000
- **WRONG**: 0788000000 or 788000000
- **WRONG**: +250 788 000 000 (with spaces)

### Test with Your Phone:
1. Add your own number as emergency contact
2. Request a test ride
3. Confirm to start the ride
4. You should receive SMS in seconds

### Emergency Contact Requirements:
- Must be a phone number that can receive SMS
- Should be someone the passenger trusts
- Should be someone reachable during day
- International numbers OK (but higher cost)

## 🔧 Troubleshooting

### "SMS not received"
1. Check emergency contact phone is in correct format (+250XXXXXXXXX)
2. Verify Twilio credentials are correct
3. Check Firestore `emergency_sms_errors` collection for error messages
4. Ensure Twilio account has credits remaining

### "Invalid phone number"
- Make sure to include the `+` at the start
- Include country code (250 for Rwanda)
- No spaces, dashes, or parentheses

### "SMS limit error"
- Twilio account may be out of credits
- Add credits at https://www.twilio.com/console/billing/overview

## 📋 Implementation Details

### Component Structure:
```
ProfileView.tsx
├── Emergency Contact Section
│   ├── View Mode (shows current contact)
│   └── Edit Mode (form to add/change contact)

PassengerDashboard.tsx
├── subscribeToUserRides() hook
└── sendEmergencyContactSMS() function
    ├── Fetches driver profile
    └── Calls Cloud Function

functions/src/index.ts
├── sendEmergencyContactSMS() - Callable function
├── onRideStarted() - Trigger function
└── SMS logging functions
```

### Data Flow:
```
Passenger starts ride
        ↓
PassengerDashboard detects status = 'ongoing'
        ↓
Calls sendEmergencyContactSMS()
        ↓
Gets driver profile from Firestore
        ↓
Calls Cloud Function with SMS data
        ↓
Cloud Function calls Twilio API
        ↓
Twilio sends SMS to emergency contact
        ↓
SMS logged in emergency_sms_logs collection
        ↓
Success notification shown to user
```

## 🎨 UI Components

### Emergency Contact Manager (ProfileView.tsx)
- **View Mode**: Shows current emergency contact with status
- **Edit Mode**: Form to add/update emergency contact
- **Validation**: Phone format validation before save
- **Feedback**: Success/error notifications

### Profile Edit Modal
- Accessible from Profile page
- Emergency contact section with red heart icon
- Integrated into existing profile editor

## 📈 Analytics & Monitoring

### Track SMS Performance:
```javascript
// Get SMS sent in last 7 days
const logs = await db.collection('emergency_sms_logs')
  .where('sentAt', '>', new Date(Date.now() - 7 * 24 * 60 * 60000))
  .get();

console.log(`Total SMS sent: ${logs.size}`);
console.log(`Success rate: ${logs.size / totalRides * 100}%`);
```

### Monitor Errors:
```javascript
const errors = await db.collection('emergency_sms_errors')
  .where('erroredAt', '>', new Date(Date.now() - 1 * 24 * 60 * 60000))
  .get();

console.log(`Errors in last 24h: ${errors.size}`);
```

## 🔮 Future Enhancements

1. **Multiple Emergency Contacts** - Add up to 3 contacts
2. **Contact Tiers** - Primary, secondary, tertiary contacts
3. **Notification Preferences** - SMS, Email, Push notifications
4. **Opt-in/Opt-out** - Let users toggle SMS per ride
5. **Real-time Tracking Link** - Include live GPS link in SMS
6. **Two-way Communication** - Emergency contact can reply
7. **WhatsApp Integration** - Send via WhatsApp instead of SMS
8. **Multilingual SMS** - Auto-translate to contact's language
9. **Smart Scheduling** - Don't send SMS during late hours
10. **Ride Sharing** - Share ride link with emergency contact

## ❓ FAQ

**Q: Does the emergency contact get real-time location?**
A: No, only the address and driver name/phone. Real-time tracking could be added in future.

**Q: Can passenger disable SMS for a ride?**
A: Not yet, but this can be added. Currently it's automatic for all rides.

**Q: What if emergency contact number is wrong?**
A: SMS will fail, error logged in Firestore. User will get notification to update contact.

**Q: Can I have multiple emergency contacts?**
A: Currently one. Multiple contacts feature coming soon.

**Q: Does this work internationally?**
A: Yes, but SMS cost increases for international numbers. Check Twilio pricing.

**Q: Is my emergency contact phone number secure?**
A: Yes, stored encrypted in Firestore with security rules.

## 📞 Support

- **Documentation**: See [TWILIO_SETUP.md](./TWILIO_SETUP.md)
- **Twilio Docs**: https://www.twilio.com/docs/sms
- **Firebase Docs**: https://firebase.google.com/docs/functions
- **GitHub Issues**: Report bugs on project repo

---

**Feature Status**: ✅ Production Ready
**Last Updated**: April 2026
**Twilio SDK**: v4.0.0
**Firebase Functions**: Node.js 20
