import connectToDatabase from '@/app/utils/mongodb';
import User from '@/app/models/User';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { privyId: string } }) {
  
  const privyId = params.privyId 
  try {
  
    if (!privyId) {
      return NextResponse.json({ message: "privyId is required" }, {status: 400});
    }

    await connectToDatabase();
   
    const user = await User.findOne({ privyId });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, {status: 404});
  }

    return NextResponse.json({ user }, {status: 200});
  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}