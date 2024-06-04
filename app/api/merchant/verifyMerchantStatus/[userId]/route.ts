import { NextRequest, NextResponse } from 'next/server';
import Merchant from '@/app/models/Merchant';
import connectToDatabase from '@/app/utils/mongodb';

type Params = {
  userId: string
}

export async function GET(req: Request, context: { params: Params }) {
  const privyId = req.headers.get('x-user-id');
  const userId = context.params.userId;

  console.log('privyID:', privyId)
  console.log('User ID:', userId)

  if (!privyId) {
    return NextResponse.json({ error: 'User ID not provided during auth middleware' }, { status: 401 });
  }

  if (userId !== privyId) {
    return NextResponse.json({ error: 'Unauthorized user' }, { status: 403 });
  }
  try {
    await connectToDatabase();
    
    console.log("userID:", userId);
    const merchant = await Merchant.findOne({ privyId: userId });
    console.log("merchant:", merchant);

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