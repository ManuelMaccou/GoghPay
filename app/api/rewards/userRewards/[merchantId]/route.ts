import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import { UserReward } from '@/app/models/UserReward';
import Merchant from '@/app/models/Merchant';

export async function GET(request: NextRequest, props: { params: Promise<{ merchantId: string }> }) {
  const params = await props.params;
  const searchParams = request.nextUrl.searchParams;
  const customerId = searchParams.get('customerId');
  const privyId = searchParams.get('privyId');
  const code = searchParams.get('code');

  try {
    const merchantId = params.merchantId;

    if (!merchantId) {
      console.error('Missing merchantId data from the request params.');
      return NextResponse.json({ message: 'Bad Request. Missing params' }, { status: 400 });
    }

    const userIdFromToken = request.headers.get('x-user-id');

    if (!userIdFromToken || userIdFromToken !== privyId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!customerId) {
      return NextResponse.json({ message: 'Bad Request. Missing customerId' }, { status: 400 });
    }

    await connectToDatabase();

    // Convert the IDs to Mongoose ObjectId format
    const customerObjectId = new mongoose.Types.ObjectId(customerId);
    const merchantObjectId = new mongoose.Types.ObjectId(merchantId);

    // Fetch the merchant to validate the code
    const merchant = await Merchant.findById(merchantObjectId);

    if (!merchant) {
      return NextResponse.json({ message: 'Merchant not found' }, { status: 404 });
    }

    // Query the UserReward collection to find if a relationship already exists
    const userReward = await UserReward.findOne({
      customerId: customerObjectId,
      merchantId: merchantObjectId,
    });

    if (!userReward) {
      // No existing relationship found
      return new NextResponse(null, { status: 204 });
    }

    // If the code exists and matches the merchant's code, update lastVisit
    if (code && code === merchant.code) {
      userReward.lastVisit = new Date(); // Update the lastVisit field
      await userReward.save(); // Save the updated record
    }

    // Always return the UserReward, regardless of whether lastVisit was updated or not
    return NextResponse.json(userReward, { status: 200 });
  } catch (error) {
    console.error('Error fetching user reward:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}