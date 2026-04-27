import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import twilio from 'twilio';

// Initialize Firebase Admin
admin.initializeApp();

// Twilio credentials (stored as environment variables)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'ACeea4d7156d894707d88e948f2b62982c';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'ad5d3f0d2990432d43b05fd24240d47d';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+19782131205';

// Initialize Twilio client
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/**
 * Cloud Function: Send SMS to emergency contact
 * Triggered when a ride starts
 */
export const sendEmergencyContactSMS = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const {
    emergencyContactPhone,
    pickupAddress,
    destinationAddress,
    driverName,
    driverPhone,
    passengerName,
  } = data;

  // Validate required fields
  if (!emergencyContactPhone || !pickupAddress || !destinationAddress || !driverName || !driverPhone || !passengerName) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }

  try {
    // Format the SMS message
    const messageBody = formatEmergencyContactMessage(
      passengerName,
      pickupAddress,
      destinationAddress,
      driverName,
      driverPhone
    );

    // Send SMS via Twilio
    const message = await twilioClient.messages.create({
      from: TWILIO_PHONE_NUMBER,
      to: emergencyContactPhone,
      body: messageBody,
    });

    // Log the SMS in Firestore for audit purposes
    await admin.firestore().collection('emergency_sms_logs').add({
      userId: context.auth.uid,
      passengerName,
      emergencyContactPhone,
      driverName,
      driverPhone,
      messageId: message.sid,
      status: message.status,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      pickupAddress,
      destinationAddress,
    });

    return {
      success: true,
      messageId: message.sid,
      status: message.status,
    };
  } catch (error) {
    console.error('Error sending SMS:', error);

    // Log the error
    await admin.firestore().collection('emergency_sms_errors').add({
      userId: context.auth.uid,
      error: error instanceof Error ? error.message : 'Unknown error',
      erroredAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    throw new functions.https.HttpsError('internal', 'Failed to send SMS to emergency contact');
  }
});

/**
 * Cloud Function: Listen to ride status changes and send SMS when ride starts
 */
export const onRideStarted = functions.firestore
  .document('rides/{rideId}')
  .onUpdate(async (change, context) => {
    const previousRide = change.before.data();
    const currentRide = change.after.data();

    // Check if ride status changed to 'ongoing'
    if (previousRide.status !== 'ongoing' && currentRide.status === 'ongoing') {
      try {
        // Get passenger profile
        const passengerDoc = await admin.firestore().collection('users').doc(currentRide.passengerId).get();
        const passengerProfile = passengerDoc.data();

        // Check if emergency contact exists
        if (!passengerProfile?.emergencyContact?.phone) {
          console.log('No emergency contact found for passenger:', currentRide.passengerId);
          return;
        }

        // Get driver profile
        const driverDoc = await admin.firestore().collection('users').doc(currentRide.riderId).get();
        const driverProfile = driverDoc.data();

        if (!driverProfile) {
          console.log('Driver profile not found:', currentRide.riderId);
          return;
        }

        // Send SMS via Twilio
        const messageBody = formatEmergencyContactMessage(
          passengerProfile.name,
          currentRide.pickup.address,
          currentRide.destination.address,
          driverProfile.name,
          driverProfile.phoneNumber || driverProfile.phone || 'N/A'
        );

        const message = await twilioClient.messages.create({
          from: TWILIO_PHONE_NUMBER,
          to: passengerProfile.emergencyContact.phone,
          body: messageBody,
        });

        // Log successful SMS
        await admin.firestore().collection('emergency_sms_logs').add({
          userId: currentRide.passengerId,
          rideId: context.params.rideId,
          passengerName: passengerProfile.name,
          emergencyContactPhone: passengerProfile.emergencyContact.phone,
          driverName: driverProfile.name,
          driverPhone: driverProfile.phoneNumber || driverProfile.phone,
          messageId: message.sid,
          status: message.status,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          pickupAddress: currentRide.pickup.address,
          destinationAddress: currentRide.destination.address,
          triggerType: 'automatic',
        });

        console.log('Emergency contact SMS sent successfully:', message.sid);
      } catch (error) {
        console.error('Error in onRideStarted:', error);

        // Log the error
        await admin.firestore().collection('emergency_sms_errors').add({
          rideId: context.params.rideId,
          userId: currentRide.passengerId,
          error: error instanceof Error ? error.message : 'Unknown error',
          erroredAt: admin.firestore.FieldValue.serverTimestamp(),
          triggerType: 'automatic',
        });
      }
    }
  });

/**
 * Helper function to format SMS message
 */
function formatEmergencyContactMessage(
  passengerName: string,
  pickupAddress: string,
  destinationAddress: string,
  driverName: string,
  driverPhone: string
): string {
  return `🚗 EMERGENCY ALERT: ${passengerName} is on a ride.
📍 From: ${pickupAddress}
📍 To: ${destinationAddress}
👤 Driver: ${driverName}
📞 Driver Phone: ${driverPhone}
⏰ Time: ${new Date().toLocaleString()}

If you don't recognize this activity, contact authorities immediately.`;
}
