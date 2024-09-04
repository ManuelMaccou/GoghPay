// Fetch all checked in customers for the current merchant

import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import { UserReward } from '@/app/models/UserReward';
import User from '@/app/models/User';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const merchantId = searchParams.get('merchantId');
  const privyId = searchParams.get('privyId');

  try {
    if (!privyId) {
      console.error('Missing privyId data from the request params.');
      return NextResponse.json({ message: "Bad Request. Missing params" }, { status: 400 });
    }

    if (!merchantId) {
      console.error('Missing merchantId data from the request params.');
      return NextResponse.json({ message: "Bad Request. Missing params" }, { status: 400 });
    }

    const userIdFromToken = request.headers.get('x-user-id');

    if (!userIdFromToken || userIdFromToken !== privyId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const merchantObjectId = new mongoose.Types.ObjectId(merchantId);

    // Aggregation pipeline to join UserReward with User data
    const rewardsCustomers = await UserReward.aggregate([
      { $match: { merchantId: merchantObjectId } }, // Filter by merchantId
      {
        $lookup: {
          from: 'users', // The collection name in MongoDB
          localField: 'customerId', // The field in UserReward that references User
          foreignField: '_id', // The field in User that is referenced
          as: 'userInfo' // The name of the array field where the user data will be stored
        }
      },
      { $unwind: '$userInfo' }, // Flatten the userInfo array to a single object
      // Optionally, project to include only necessary fields from UserReward and User
      {
        $project: {
          _id: 1,
          merchantId: 1,
          totalSpent: 1,
          visitsCount: 1,
          lastVisit: 1,
          currentTier: 1,
          nextTier: 1,
          'userInfo._id': 1, // Include specific fields from the User document
          'userInfo.name': 1,
          'userInfo.email': 1,
          'userInfo.squareCustomerId': 1,
        }
      },
      { $sort: { lastVisit: -1 } }, // Sort by lastVisit in descending order
      { $limit: 20 }
    ]);

    if (!rewardsCustomers || rewardsCustomers.length === 0) {
      return NextResponse.json({ message: 'No customers found' }, { status: 404 });
    }

    return NextResponse.json(rewardsCustomers, { status: 200 });

  } catch (error) {
    console.error('Error fetching user reward:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}