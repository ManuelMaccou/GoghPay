import Subscription from "@/app/models/Subscription";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const merchantId = searchParams.get('merchantId');
  const userId = searchParams.get('userId');

  if (!merchantId || !userId) {
    return NextResponse.json({ error: 'Missing merchantId or userId' }, { status: 400 });
  }

  try {
    // Check if the subscription already exists
    const existingSubscription = await Subscription.findOne({
      merchantId: merchantId,
      buyerId: userId,
    });

    if (existingSubscription) {
      console.log('subscription result in GET:', true);
      return NextResponse.json({ result: existingSubscription.subscriberStatus }, { status: 200 });
    } else {
      return NextResponse.json({ result: 'undefined' }, { status: 200 });
    }
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return NextResponse.json({ error: 'Error checking subscription status' }, { status: 500 });
  }
}
