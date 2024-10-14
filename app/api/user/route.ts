
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import User from '@/app/models/User';

export async function POST(req: NextRequest) {
  try {
    const userData = await req.json();
    console.log("user data:", userData);

    if (!userData) {
      console.error('Missing user data from the request body.')
      return NextResponse.json({ message: "Bad Request" }, { status: 400 });
    }

    /*
    const userIdFromToken = req.headers.get('x-user-id');

    if (!userIdFromToken) {
      return NextResponse.json({ message: "Unauthorized" }, {status: 401});
    }
    */

    await connectToDatabase();
    try {
      const user = new User({
        privyId: userData?.privyId,
        walletAddress: userData?.walletAddress,
        email: userData?.email,
        phone: userData?.phone,
        smartAccountAddress: userData?.smartAccountAddress,
        creationType: userData?.creationType,
      });
      await user.save();

      return NextResponse.json({ user, message: "User created successfully" }, { status: 201 });
    } catch (saveError) {
      console.error('Error saving new user:', saveError);
      return NextResponse.json({ message: "Error saving new user" }, { status: 500 });
    }
  } catch (error) {
    console.error('Error handling Privy login:', error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}