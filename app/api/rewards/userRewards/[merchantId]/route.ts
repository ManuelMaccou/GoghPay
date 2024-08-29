// Fetch rewards specific to a merchant

import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import { UserReward } from '@/app/models/UserReward';

export async function GET (request: NextRequest,
  { params }: { params: { merchantId: string } }) {
    const searchParams = request.nextUrl.searchParams;
    const currentUserId = searchParams.get('currentUserId');
    const privyId = searchParams.get('privyId');


  try {
    const merchantId = params.merchantId

    if (!merchantId) {
      console.error('Missing merchantId data from the request params.');
      return NextResponse.json({ message: "Bad Request. Missing params" }, { status: 400 });
    }

    const userIdFromToken = request.headers.get('x-user-id');
    console.log('userId from token:', userIdFromToken);
    console.log('privyId:', privyId);

    if (!userIdFromToken || userIdFromToken !== privyId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!currentUserId) {
      // Check if currentUserId is null or undefined
      return NextResponse.json({ message: "Bad Request. Missing currentUserId" }, { status: 400 });
    }

    await connectToDatabase();
    
     // Convert the IDs to Mongoose ObjectId format
     const userId = new mongoose.Types.ObjectId(currentUserId);
     const merchantObjectId = new mongoose.Types.ObjectId(merchantId);
 
     // Query the UserReward collection to find if a relationship already exists
     const userReward = await UserReward.findOne({
       userId: userId,
       merchantId: merchantObjectId,
     });
 
     if (userReward) {
       // Relationship exists, return the existing user reward record
       return NextResponse.json(userReward, { status: 200 });
     } else {
       // No existing relationship found
       return NextResponse.json({ message: "No existing reward relationship found" }, { status: 404 });
     }
   } catch (error) {
     console.error('Error fetching user reward:', error);
     return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
   }
 }