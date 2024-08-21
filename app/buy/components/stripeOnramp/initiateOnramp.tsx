import { useEffect, useState } from 'react';
import { loadStripeOnramp } from '@stripe/crypto';
import { CryptoElements, OnrampElement } from './stripeCryptoElements';

const stripeOnrampPromise = loadStripeOnramp(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type StripeOnrampProps = {
  clientSecret: string;
};

const InitiateOnramp = ({ clientSecret }: StripeOnrampProps) => {
  return (
    <CryptoElements stripeOnramp={stripeOnrampPromise}>
      <OnrampElement clientSecret={clientSecret} />
    </CryptoElements>
  );
};

export default InitiateOnramp;
