import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import Transaction from '@/app/models/Transaction';
import { startOfDay, addMinutes } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

type Params = {
  merchantId: string;
};

export async function GET(req: NextRequest, context: { params: Promise<Params> }) {
  const merchantId = (await context.params).merchantId;
  await connectToDatabase();

  const now = new Date();
  const pstTimeZone = 'America/Los_Angeles';
  const startOfTodayPST = fromZonedTime(addMinutes(startOfDay(now), 1), pstTimeZone);

  const totalTransactions = await Transaction.find({ 
    merchant: merchantId,
    'payment.status': { $in: ['COMPLETE', 'COMPLETE_OFFLINE'] }
  });

  const todaysTransactions = await Transaction.find({
    merchant: merchantId,
    'payment.status': { $in: ['COMPLETE', 'COMPLETE_OFFLINE'] },
    createdAt: { $gte: startOfTodayPST },
  });

  if (!totalTransactions.length && !todaysTransactions.length) {
    console.log(`No transactions returned for merchant ID: ${merchantId}`);
    return NextResponse.json({ message: "No transactions found." }, { status: 404 });
  }

  return NextResponse.json({ totalTransactions, todaysTransactions }, { status: 200 });
}
