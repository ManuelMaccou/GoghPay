// app/api/merchants/route.ts
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import Merchant from '@/app/models/Merchant';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const merchantData = await req.json();

    if (!merchantData || !merchantData.userId || !merchantData.name) {
      console.error('Missing required merchant data');
      return NextResponse.json({ message: "Bad Request" }, { status: 400 });
    }

    const newMerchant = new Merchant({
      user: merchantData.userId,
      name: merchantData.name,
      status: merchantData.status || 'inactive',
      tier: merchantData.tier || 'free', 
      privyId: merchantData.privyId,
    });

    await newMerchant.save();

    return NextResponse.json({ merchant: newMerchant, message: "Merchant created successfully" }, { status: 201 });
  } catch (error) {
    console.error('Error creating merchant:', error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
