import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import Transfer from '@/app/models/Transfer';

type Params = {
  userId: string;
};

export async function GET(req: NextRequest, context: { params: Params }) {
  const userId = context.params.userId;
  await connectToDatabase();

  const allTransfers = await Transfer.find({ user: userId });

  if (!allTransfers.length) {
    console.log(`No transactions returned for buyer ID: ${userId}`);
    return NextResponse.json({ message: "No transactions found." }, { status: 404 });
  }
  return NextResponse.json({ allTransfers}, { status: 200 });
}
