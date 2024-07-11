
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import User from '@/app/models/User';


export async function PATCH(req: NextRequest) {
  const { coinbaseAddress, privyId } = await req.json();
  const userIdFromToken = req.headers.get('x-user-id');

  console.log("Updating coinbaseAddress for user:", privyId);
  console.log("Address:", coinbaseAddress);

  if (!userIdFromToken || userIdFromToken !== privyId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  try {
    // Find the user by privyId and update the coinbaseAddress
    const updatedUser = await User.findOneAndUpdate(
      { privyId: privyId },
      { $set: { coinbaseAddress: coinbaseAddress } },
      { new: true }  // Returns the updated document
    );

    // Check if the user was found and updated
    if (!updatedUser) {
      return new NextResponse(JSON.stringify({ message: "User not found" }), { status: 404 });
    }

    return new NextResponse(JSON.stringify({ message: "Address updated successfully", user: updatedUser }), { status: 200 });
  } catch (error) {
    console.error('Error updating user:', error);
    return new NextResponse(JSON.stringify({ message: "Server error" }), { status: 500 });
  }
}