import { NextRequest, NextResponse } from 'next/server';
import Merchant from '@/app/models/Merchant';
import connectToDatabase from '@/app/utils/mongodb';

type Params = {
  userId: string
}

export async function GET(request: Request, context: { params: Params }) {
  try {
    await connectToDatabase();
    const user_Id = context.params.userId
    console.log("user ID to validate:", user_Id);
    const merchant = await Merchant.findOne({ privyId: user_Id });

    if (!merchant) {
      console.log("merchant not found");
      return NextResponse.json({ message: "Merchant not found." }, {status:404});
    }
    
    console.log("Merchant found:", merchant);
    return NextResponse.json(merchant, { status: 200 });
  } catch (error) {
    console.error("Error fetching merchant:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}