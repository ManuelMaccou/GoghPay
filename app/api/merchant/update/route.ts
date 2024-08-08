import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import Merchant from '@/app/models/Merchant';

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

    const allowedFields = ['walletAddress', 'square_location_id' , 'square_access_token', 'square_location_name'];
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

    // Find the merchant by privyId and update the specified fields
    const updatedMerchant = await Merchant.findOneAndUpdate(
      { privyId: privyId },
      { $set: fieldsToUpdate },
      { new: true }  // Returns the updated document
    );

    // Check if the merchant was found and updated
    if (!updatedMerchant) {
      return NextResponse.json({ message: "Merchant not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Merchant updated successfully", merchant: updatedMerchant }, { status: 200 });
  } catch (error) {
    console.error('Error updating merchant:', error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
