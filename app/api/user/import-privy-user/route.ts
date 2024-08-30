
import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';

export async function POST(req: NextRequest) {
  const privy = new PrivyClient(process.env.NEXT_PUBLIC_PRIVY_APP_ID!, process.env.PRIVY_SECRET!);

  try {
    const userData = await req.json();
    console.log("user data:", userData);

    if (!userData) {
      console.error('Missing user data from the request body.')
      return NextResponse.json({ message: "Bad Request" }, { status: 400 });
    }

    /*
    const userIdFromToken = req.headers.get('x-user-id');

    if (!userIdFromToken) {
      return NextResponse.json({ message: "Unauthorized" }, {status: 401});
    }
    */


    const user = await privy.importUser({
      linkedAccounts: [
        {
          type: 'email',
          address: userData.email,
        },
      ],
      createEmbeddedWallet: true,
    });

    return NextResponse.json({ user, message: "Privy user imported successfully" }, { status: 201 });

  } catch (error) {
    console.error('Error importing Privy user:', error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}