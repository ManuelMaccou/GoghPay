'use client';

import {PrivyProvider} from '@privy-io/react-auth';
import {base, baseSepolia} from 'viem/chains';

export default function PrivyUserProvider({children}: {children: React.ReactNode}) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || ''}
      config={{
        defaultChain: base,
        supportedChains: [baseSepolia, base],
        appearance: {
          theme: 'light',
          accentColor: '#676FFF',
          logo: '/logos/gogh_logo_black.svg',
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}