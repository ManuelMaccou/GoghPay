'use client';

import SquarePaymentButton from '../components/SquarePaymentButton';
import { useRouter } from 'next/navigation';

export default function SquarePaymentPage() {
  const router = useRouter();
  const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/square/pos/callback`;
  const squareClientId = process.env.NEXT_PUBLIC_SQUARE_APP_ID!;
  

  return (
    <SquarePaymentButton
      amount={500} // Example amount in cents
      currency="USD"
      callbackUrl={callbackUrl}
      clientId={squareClientId}
      notes="Thank you for your purchase!"
    />
  );
}
