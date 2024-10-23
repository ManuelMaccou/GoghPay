import { NextResponse } from "next/server";
import * as Sentry from '@sentry/nextjs';
import twilioClient from "@/app/lib/twilio";

export async function POST(request: Request) {
  try {
    const requestBody = await request.text();
    const params = new URLSearchParams(requestBody);
    const to = params.get("to");
    const body = params.get("body");
    const privyId = params.get("privyId");

    const userIdFromToken = request.headers.get('x-user-id');
    const serverAuthentication = request.headers.get('authorization');


    if (serverAuthentication === `Bearer ${process.env.SERVER_AUTH}`) {
      console.log("Request authenticated from the server.");
    } else {
      if (!privyId) {
        return NextResponse.json({ message: "Missing required field: privyId" }, { status: 400 });
      }

      if (!userIdFromToken || userIdFromToken !== privyId) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }
    }


    if (!to) {
      Sentry.captureMessage("Invalid request: Missing 'to' parameter.");
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (!body) {
      Sentry.captureMessage("Invalid request: Missing 'body' parameter.");
      return NextResponse.json({ success: true }, { status: 200 });
    }


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
    Sentry.captureException(error);
    console.error("Silent general error:", error);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
