// Fetch all rewards specific to a customer

import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import { UserReward } from '@/app/models/UserReward';
import { UserReward as UserRewardType, Merchant as MerchantType } from '@/app/types/types';
import Merchant from '@/app/models/Merchant';

export async function GET (request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const privyId = searchParams.get('privyId');
  const customerId = searchParams.get('customerId')

  console.log('customerId:', customerId)

  try {
    if (!customerId) {
      console.error('Missing customerId data from the query params.');
      return NextResponse.json({ message: "Bad Request. Missing params" }, { status: 400 });
    }

    const userIdFromToken = request.headers.get('x-user-id');
    if (!userIdFromToken || userIdFromToken !== privyId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const customerObjectId = new mongoose.Types.ObjectId(customerId);

    const userRewards: UserRewardType[] = await UserReward.find({
      customerId: customerObjectId,
    }).lean();

    if (!userRewards || userRewards.length === 0) {
      return NextResponse.json(null, { status: 204 });
    }

    const rewardsWithMerchantData = await Promise.all(userRewards.map(async (reward) => {
      // Use `lean<MerchantType>()` to ensure TypeScript knows the structure of the returned object
      const merchant = await Merchant.findById(reward.merchantId)
        .select('branding.logo branding.primary_color branding.secondary_color name')
        .lean<MerchantType>();  
    
      return {
        ...reward,
        merchantLogo: merchant?.branding?.logo || null,
        merchantName: merchant?.name || null,
        merchantPrimaryColor: merchant?.branding?.primary_color || '#000000',
        merchantSecondaryColor: merchant?.branding?.secondary_color || '#FFFFFF',
      };
    }));
 
    return NextResponse.json(rewardsWithMerchantData, { status: 200 });
  } catch (error) {
    console.error('Error fetching user reward or merchant data:', error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}