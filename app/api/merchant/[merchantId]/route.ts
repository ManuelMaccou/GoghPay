import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import Merchant from '@/app/models/Merchant';


type Params = {
  merchantId: string
}

export async function GET(request: Request, context: { params: Params }) {
  await connectToDatabase();
  const merchantId = context.params.merchantId
  const merchant = await Merchant.findOne({ _id: merchantId });

  if (!merchant) {
    console.log("merchant not found");
    return NextResponse.json({ message: "Merchant not found." }, {status:404});
  }

  return NextResponse.json(merchant);
}
