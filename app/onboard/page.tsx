// If gmail, set "type" param to "google". Dont include "email" param.
// If other, set "type" param to "email". Include "email" param with their address.

'use client'

import { useRouter, useSearchParams } from 'next/navigation';
import { useMerchant } from '@/app/contexts/MerchantContext';
import { Button, Callout, Flex, Heading, Link, Spinner, Text } from "@radix-ui/themes";
import { getAccessToken, useLogin, usePrivy } from '@privy-io/react-auth';
import * as Sentry from '@sentry/nextjs';
import { Suspense, useEffect, useState } from 'react';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { MerchantTier } from '../types/types';

function OnboardContent() {
  const router = useRouter();
  const { merchant, setMerchant, isFetchingMerchant } = useMerchant();
  const { ready, authenticated, user } = usePrivy();

  const searchParams = useSearchParams();
  const { login } = useLogin({
    onError: (error) => {
      console.error("Privy login error:", error);
    },
  });

  type LoginMethod = "google" | "sms" | "email" | "farcaster" | "discord" | "twitter" | "github" | "spotify" | "instagram" | "tiktok" | "linkedin" | "apple" | "telegram" | "wallet";

  const [defaultEmail, setDefaultEmail] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [privyLoginMethods, setPrivyLoginMethods] = useState<LoginMethod[]>(['google', 'email']);


  const handleUpdateOnboardingStep = async () => {
    if (!merchant) {
      console.error("No merchant data available");
      setErrorMessage('An unexpected error happened.');
      return;
    }
    if (merchant.tier === MerchantTier.paid) {
      router.push('/onboard/step1');
    } else {
      router.push('/onboard/step2');
    }
  }

  const handleLogin = () => {
    login({
      prefill: { type: 'email', value: defaultEmail },
      loginMethods: privyLoginMethods,
      disableSignup: true,
    });
  };

  useEffect(() => {
    const emailParam = searchParams.get('email');
    const emailTypeParam = searchParams.get('type');
  
    if (emailParam) {
      setDefaultEmail(emailParam);
    }
  
    if (emailTypeParam === 'google') {
      setPrivyLoginMethods(['google']);
    } else if (emailTypeParam === 'email') {
      setPrivyLoginMethods(['email']);
    }
  }, [searchParams]);

  if (!ready) {
    return <Spinner />;
  }

  if (!authenticated) {
    return (
      <Flex direction="column" align="center" gap={'4'}>
        <Heading>Welcome to Gogh!</Heading>
        <Text>
          To continue, please log in.
        </Text>
        <Button onClick={handleLogin}>
          Log In
        </Button>
      </Flex>
    );
  }

  if (isFetchingMerchant) {
    return <Spinner />;
  }

  if (!isFetchingMerchant && !merchant) {
    return (
      <Flex direction="column" align="center" gap={'4'}>
        <Heading>Welcome to Gogh!</Heading>
        <Text>
          To join the Gogh family of small businesses, please reach out. We
          would love to hear from you.
        </Text>
        <Button asChild>
          <Link
            href="mailto:hello@ongogh.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact Us
          </Link>
        </Button>
      </Flex>
    );
  }

  return (
    <Flex direction={'column'} justify={'center'} maxWidth={'500px'} gap={'4'}>
      <Heading align={'center'}>Get ready to Gogh!</Heading>
      {merchant?.tier === MerchantTier.paid ? (
        <Text align={'center'}>
          We&apos;re excited to welcome you to the family of Gogh small
          businesses. To help you get started, we will guide you through
          connecting your Square account, integrating Venmo and Zelle, and
          creating your first rewards.
        </Text>
      ) : (
        <Text align={'center'}>
          We&apos;re excited to welcome you to the family of Gogh small
          businesses. To help you get started, we will guide you through
          connecting your Square account, Zelle, and Venmo.
        </Text>
      )}
      <Button
        style={{ width: '250px', alignSelf: 'center', cursor: 'pointer' }}
        onClick={handleUpdateOnboardingStep}
      >
        Get started
      </Button>
      {errorMessage && (
        <Callout.Root color='red' mx={'4'}>
          <Callout.Icon>
            <InfoCircledIcon />
          </Callout.Icon>
          <Callout.Text>
            {errorMessage}
          </Callout.Text>
        </Callout.Root>
      )}
    </Flex>
  );
}

export default function Onboard() {
  return (
    <Suspense fallback={<Spinner />}>
      <OnboardContent />
    </Suspense>
  );
}