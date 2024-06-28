import Subscription from "@/app/models/Subscription";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { checkoutUser, merchantId } = await req.json();
  console.log('checkoutUser:', checkoutUser);

  try {
    const subscription = new Subscription({
      merchantId: merchantId,
      buyerId: checkoutUser.user._id,
    });
    await subscription.save();

    return NextResponse.json({ message: 'Subcriber saved successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error saving subsriber:', error);
    return NextResponse.json({ error: 'Error saving subscriber' }, { status: 500 });
  }
}
