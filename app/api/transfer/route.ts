import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import Transfer from '../../models/Transfer';

export async function POST(req: NextRequest) {
  await connectToDatabase();

  try {
    const { privyId, user, amount, fromGoghAddress, toCoinbaseAddress, transactionHash } = await req.json();
    const userIdFromToken = req.headers.get('x-user-id');

     if (!userIdFromToken || userIdFromToken !== privyId) {
      return NextResponse.json({ message: "Unauthorized" }, {status: 401});
    }

    const transfer = new Transfer({
      user,
      amount,
      fromGoghAddress,
      toCoinbaseAddress,
      transactionHash,
    });

    await transfer.save();

    return NextResponse.json({ message: 'Transfer saved successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error saving transfer:', error);
    return NextResponse.json({ error: 'Error saving transfer' }, { status: 500 });
  }
}
