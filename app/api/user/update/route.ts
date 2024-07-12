import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import User from '@/app/models/User';

export async function PATCH(req: NextRequest) {
  try {
    const { privyId, ...updateFields } = await req.json();
    const userIdFromToken = req.headers.get('x-user-id');

    if (!privyId) {
      return NextResponse.json({ message: "Missing required field: privyId" }, { status: 400 });
    }

    if (!userIdFromToken || userIdFromToken !== privyId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Validate that there are fields to update
    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ message: "No fields to update" }, { status: 400 });
    }

    const allowedFields = ['coinbaseAddress', 'smartAccountAddress'];
    const fieldsToUpdate: { [key: string]: any } = {};
    Object.keys(updateFields).forEach((key) => {
      if (allowedFields.includes(key)) {
        fieldsToUpdate[key] = updateFields[key];
      }
    });

    if (Object.keys(fieldsToUpdate).length === 0) {
      return NextResponse.json({ message: "No valid fields to update" }, { status: 400 });
    }

    await connectToDatabase();

    // Find the user by privyId and update the specified fields
    const updatedUser = await User.findOneAndUpdate(
      { privyId: privyId },
      { $set: fieldsToUpdate },
      { new: true }  // Returns the updated document
    );

    // Check if the user was found and updated
    if (!updatedUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "User updated successfully", user: updatedUser }, { status: 200 });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
