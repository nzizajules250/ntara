/**
 * Twilio SMS Integration for Emergency Contact Notifications
 */

/**
 * Send SMS to emergency contact with ride details
 * This function calls a Firebase Cloud Function backend to send SMS via Twilio
 */
export async function sendEmergencyContactSMS(
  emergencyContactPhone: string,
  pickupAddress: string,
  destinationAddress: string,
  driverName: string,
  driverPhone: string,
  passengerName: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Call Firebase Cloud Function
    const response = await fetch(
      'https://us-central1-your-project.cloudfunctions.net/sendEmergencyContactSMS',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emergencyContactPhone,
          pickupAddress,
          destinationAddress,
          driverName,
          driverPhone,
          passengerName,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send SMS');
    }

    return {
      success: true,
      messageId: data.messageId,
    };
  } catch (error) {
    console.error('Error sending emergency contact SMS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Format the SMS message for emergency contact
 */
export function formatEmergencyContactMessage(
  passengerName: string,
  pickupAddress: string,
  destinationAddress: string,
  driverName: string,
  driverPhone: string
): string {
  return `🚗 EMERGENCY: ${passengerName} is on a ride with driver ${driverName}.
📍 From: ${pickupAddress}
📍 To: ${destinationAddress}
📞 Driver: ${driverPhone}
⏰ Time: ${new Date().toLocaleTimeString()}`;
}
