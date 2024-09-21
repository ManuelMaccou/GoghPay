import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { SaleFormData, RewardsTier } from '../types/types';
import { UserReward } from '../models/UserReward';
import Merchant from '../models/Merchant';
import connectToDatabase from './mongodb';


export async function POST(req: NextRequest) {
  try {
    const userIdFromToken = req.headers.get('x-user-id');
    const { body } = await req.json();
    const privyId: string = body.privyId;
    const purchaseData: SaleFormData = body.purchaseData

    if (!privyId) {
      return NextResponse.json({ message: "Missing required field: privyId" }, { status: 400 });
    }

    if (!userIdFromToken || userIdFromToken !== privyId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const userRewardObject = await UserReward.findOne({
      customerId: new mongoose.Types.ObjectId(purchaseData.customer?.userInfo._id),
      merchantId: new mongoose.Types.ObjectId(purchaseData.sellerMerchant?._id)
    });

    if (!userRewardObject) {
      console.error('User reward not found.');
      return;
    }

    const newPurchaseAmount = parseFloat(purchaseData.price || "0");
    if (isNaN(newPurchaseAmount)) {
      console.error("Invalid purchase amount.");
      return;
    }
    
    const totalSpent = (userRewardObject.totalSpent || 0) + newPurchaseAmount;
    const purchaseCount = (userRewardObject.purchaseCount || 0) + 1;

    const merchant = await Merchant.findOne({ _id: userRewardObject.merchantId });
    if (!merchant) {
      console.error('Merchant not found.');
      return;
    }

    const tiers: RewardsTier[] = merchant.rewards?.tiers || [];
    if (!tiers.length) {
      console.log('No tiers configured for the merchant');
      return;
    }

    const sortedTiers = tiers.sort((a, b) => a.milestone - b.milestone);
    let highestTier: RewardsTier | null = null;

    for (const tier of sortedTiers) {
      if (totalSpent >= tier.milestone) {
        highestTier = tier;
      }
    }

    const fieldsToUpdate: { [key: string]: any } = {
      totalSpent: totalSpent,
      purchaseCount: purchaseCount
    };

    if (highestTier && highestTier.discount > (userRewardObject.currentDiscount?.amount || 0)) {
      fieldsToUpdate['currentDiscount.amount'] = highestTier?.discount;
    }

    const updatedUserReward = await UserReward.findOneAndUpdate(
      { _id: userRewardObject._id },
      { $set: fieldsToUpdate },
      { new: true }
    );

    if (!updatedUserReward) {
      return NextResponse.json({ message: "Existing rewards account not found." }, { status: 404 });
    }

    return NextResponse.json({ message: 'User rewards updated successfully', updatedReward: updatedUserReward }, { status: 200 });
  } catch (error) {
    console.error('Error updating rewards:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}