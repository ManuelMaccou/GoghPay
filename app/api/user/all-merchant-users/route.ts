import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import User from '@/app/models/User';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    
    const allMerchants = await User.find({ merchant: true });

    if (!allMerchants || allMerchants.length === 0) {
      console.log("No merchants found");
      return NextResponse.json({ message: "No merchants found." }, { status: 404 });
    }
    
    return NextResponse.json(allMerchants, { status: 200 });
  } catch (error) {
    console.error("Error fetching all merchants:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}