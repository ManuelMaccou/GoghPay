'use client';

import {PrivyProvider} from '@privy-io/react-auth';
import {base, baseSepolia} from 'viem/chains';

export default function UserProvider({children}: {children: React.ReactNode}) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
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