import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import Merchant from '@/app/models/Merchant';


type Params = {
  privyId: string
}

export async function GET(request: Request, context: { params: Promise<Params> }) {
  await connectToDatabase();
  const privyId = (await context.params).privyId
  const merchant = await Merchant.findOne({ privyId: privyId });

  if (!merchant) {
    console.log("merchant not found");
    return NextResponse.json({ message: "Merchant not found." }, {status:404});
  }
  return NextResponse.json(merchant);
}
