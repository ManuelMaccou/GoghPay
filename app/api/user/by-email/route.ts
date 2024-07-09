import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import User from '@/app/models/User';

export async function GET(request: NextRequest) {
  await connectToDatabase();
  const searchParams = request.nextUrl.searchParams;
  const emailAddress = searchParams.get('address');
  console.log('email address in /by-email route:', emailAddress);

  /*
  const userIdFromToken = req.headers.get('x-user-id');

  if (!userIdFromToken) {
    return NextResponse.json({ message: "Unauthorized" }, {status: 401});
  }
  */
  
  try {
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