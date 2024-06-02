import { NextRequest, NextResponse } from 'next/server';
import Merchant from '@/app/models/Merchant';
import connectToDatabase from '@/app/utils/mongodb';

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
  console.log("merchant:", merchant);

  return NextResponse.json(merchant);
}

export async function POST(request: NextRequest) {
  await connectToDatabase();
  const { merchantId, walletAddress, user } = await request.json();
  const newMerchant = new Merchant({ merchantId, walletAddress, user });
  await newMerchant.save();
  return NextResponse.json(newMerchant);
}
