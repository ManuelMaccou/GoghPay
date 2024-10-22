import { NextResponse } from "next/server";
import * as Sentry from '@sentry/nextjs';
//import twilioClient from "@/app/lib/twilio";

export async function POST(request: Request) {
  //try {
    // Parse x-www-form-urlencoded data
    const requestBody = await request.text();
    const params = new URLSearchParams(requestBody);
    const to = params.get("to");
    const body = params.get("body");
    const privyId = params.get("privyId");

    const userIdFromToken = request.headers.get('x-user-id');

    if (!privyId || !userIdFromToken || userIdFromToken !== privyId) {
      Sentry.captureMessage(`Invalid request: Unauthorized access. User ID: ${userIdFromToken}, Privy ID: ${privyId}`);
      return NextResponse.json({ success: true }, { status: 200 });
    }


    if (!to) {
      Sentry.captureMessage("Invalid request: Missing 'to' parameter.");
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (!body) {
      Sentry.captureMessage("Invalid request: Missing 'body' parameter.");
      return NextResponse.json({ success: true }, { status: 200 });
    }

    /*
    try {
      await twilioClient.messages.create({
        body,
        from: "+13105939792",
        to,
      });
    } catch (twilioError) {
      Sentry.captureException(twilioError);
      console.error("Silent Twilio error:", twilioError);
    }
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    // Catch any general errors and log them silently
    Sentry.captureException(error);
    console.error("Silent general error:", error);
    // Return a success response even if there's a general server error
    return NextResponse.json({ success: true }, { status: 200 });
  }
    */
}
