import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import User from '@/app/models/User';

export async function GET(req: NextRequest) {
  try {

    /*
    const userIdFromToken = req.headers.get('x-user-id');

    if (!userIdFromToken) {
      return NextResponse.json({ message: "Unauthorized" }, {status: 401});
    }
    */

    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const emailAddress = searchParams.get('address');
    console.log('email address in /by-email route:', emailAddress);

    const user = await User.findOne({ email: emailAddress });
    console.log('found user is by-email route:', user);

    if (!user) {
      return NextResponse.json({ message: "User not found" }, {status: 404});
    }
    return NextResponse.json(user, {status: 200});
  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}