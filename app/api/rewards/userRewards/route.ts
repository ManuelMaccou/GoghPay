
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import { UserReward } from '@/app/models/UserReward';

export async function POST(req: NextRequest) {
  try {
    const userRewardData = await req.json();
    console.log("user reward data:", userRewardData);

    if (!userRewardData) {
      console.error('Missing user reward data from the request body.')
      return NextResponse.json({ message: "Bad Request" }, { status: 400 });
    }

    const userIdFromToken = req.headers.get('x-user-id');

    if (!userIdFromToken || userIdFromToken !== userRewardData.privyId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Check if the user reward already exists to prevent duplicates
    const existingReward = await UserReward.findOne({
      userId: userRewardData.userId,
      merchantId: userRewardData.merchantId,
    });

    if (existingReward) {
      return NextResponse.json({ message: "Reward already exists" }, { status: 409 });
    }

    const userReward = new UserReward({
      userId: userRewardData.userId,
      merchantId: userRewardData.merchantId,
      totalSpent: userRewardData.totalSpent,
      visitsCount: userRewardData.visitsCount,
      lastVisit: userRewardData.lastVisit,
    });

    await userReward.save();

    return NextResponse.json({ userReward, message: "Reward created successfully" }, { status: 201 });
  } catch (error) {
    console.error('An error occurred:', error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}