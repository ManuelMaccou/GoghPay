import Subscription from "@/app/models/Subscription";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { checkoutUser, merchantId, subscriberStatus } = await req.json();
  console.log('checkoutUser:', checkoutUser);

  try {
    const subscription = new Subscription({
      merchantId: merchantId,
      buyerId: checkoutUser._id,
      subscriberStatus: subscriberStatus,
    });
    await subscription.save();

    return NextResponse.json({ message: 'Subcriber saved successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error saving subsriber:', error);
    return NextResponse.json({ error: 'Error saving subscriber' }, { status: 500 });
  }
}