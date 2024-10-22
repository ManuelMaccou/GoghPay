import twilio from 'twilio';

const accountSid = process.env.TWILIO_SID;
const apiKey = process.env.TWILIO_API_SID;
const apiSecret = process.env.TWILIO_API_SECRET;

const twilioClient = twilio(apiKey, apiSecret, {
  accountSid,
  autoRetry: true,
  maxRetries: 3,
});

export default twilioClient;