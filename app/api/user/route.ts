import { NextApiRequest, NextApiResponse } from 'next';
import User from '@/app/models/User';
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';

export async function GET(req: NextRequest, res: NextResponse) {
  try {
    const userIdFromToken = req.nextUrl.searchParams.get('user');

    if (!userIdFromToken) {
      return NextResponse.json({ message: "Unauthorized" }, {status: 401});
    }

    await connectToDatabase();
    const user = await User.findOne({ privyId: userIdFromToken });
    if (!user) {
      return NextResponse.json({ message: "User not found" }, {status: 404});
  }

    return NextResponse.json({ user }, {status: 200});
  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userData = await req.json();

    if (!userData) {
      console.error('Missing user data from the request body.')
      return
    }
    const userIdFromToken = req.headers.get('x-user-id');
    console.log('userIdFromToken:', userIdFromToken);

    if (!userIdFromToken) {
      return NextResponse.json({ message: "Unauthorized" }, {status: 401});
    }

    await connectToDatabase();
    let user = await User.findOne({ privyId: userIdFromToken });
    if (!user) {
      try {
        user = new User({
          privyId: userData.privyId,
          walletAddress: userData.walletAddress,
        });
        await user.save();

        return NextResponse.json({ user, message: "User created successfully" }, { status: 201 });
      } catch (saveError) {
        if (saveError instanceof Error) {
          console.error('Error saving new user:', saveError.message);
        } else {
          console.error('Unexpected error saving new user:', saveError);
        }
        return NextResponse.json({ message: "Error saving new user" }, { status: 500 });
      }
    } else {
      return NextResponse.json({ user, message: "User already exists" }, { status: 200 });
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Error handling Privy login:', error.message);
    } else {
      console.error('Unexpected error handling Privy login:', error);
    }
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}