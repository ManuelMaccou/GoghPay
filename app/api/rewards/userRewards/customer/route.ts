import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import { UserReward } from '@/app/models/UserReward';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const privyId = searchParams.get('privyId');
  const customerId = searchParams.get('customerId');

  if (!privyId) {
    console.error('Missing privyId data from the request params.');
    return NextResponse.json({ message: "Bad Request. Missing params" }, { status: 400 });
  }

  if (!customerId) {
    console.error('Missing customerId data from the query params.');
    return NextResponse.json({ message: "Bad Request. Missing params" }, { status: 400 });
  }

  const userIdFromToken = request.headers.get('x-user-id');

  if (!userIdFromToken || userIdFromToken !== privyId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  try {

    const customerObjectId = new mongoose.Types.ObjectId(customerId);

    // Aggregation pipeline to join UserReward with Merchant data
    const rewardsWithMerchantData = await UserReward.aggregate([
      { $match: { customerId: customerObjectId } }, // Match rewards by customerId
      {
        $lookup: {
          from: 'merchants', // The collection name in MongoDB
          localField: 'merchantId', // The field in UserReward that references Merchant
          foreignField: '_id', // The field in Merchant that is referenced
          as: 'merchantInfo', // The name of the array field where the merchant data will be stored
        }
      },
      { $unwind: '$merchantInfo' }, // Flatten the merchantInfo array to a single object
      // Optionally, project to include only necessary fields from UserReward and Merchant
      {
        $project: {
          _id: 1,
          customerId: 1,
          merchantId: 1,
          points: 1,
          createdAt: 1,
          'merchantInfo.branding.logo': 1, // Only include specific fields from Merchant
          'merchantInfo.branding.primary_color': 1,
          'merchantInfo.branding.secondary_color': 1,
          'merchantInfo.name': 1,
        }
      }
    ]);

    if (!rewardsWithMerchantData || rewardsWithMerchantData.length === 0) {
      return new Response(null, { status: 204 });
    }

    return NextResponse.json(rewardsWithMerchantData, { status: 200 });

  } catch (error) {
    console.error('Error fetching user reward or merchant data:', error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
