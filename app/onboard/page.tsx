'use client'

import { useRouter } from 'next/navigation';
import { useMerchant } from '@/app/contexts/MerchantContext';
import { Button, Callout, Flex, Heading, Text } from "@radix-ui/themes";
import { getAccessToken, usePrivy } from '@privy-io/react-auth';
import * as Sentry from '@sentry/nextjs';
import { useState } from 'react';
import { InfoCircledIcon } from '@radix-ui/react-icons';

export default function Step1() {
  const router = useRouter();
  const { merchant, setMerchant } = useMerchant();
  const { user } = usePrivy();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUpdateOnboardingStep = async () => {
    console.log(merchant)
    if (!merchant) {
      console.error("No merchant data available");
      setErrorMessage('An unexpected error happened.');
      return;
    }
    router.push('/onboard/step1');
  }

  return (
    <Flex direction={'column'} justify={'center'} maxWidth={'500px'} gap={'4'}>
      <Heading align={'center'}>Get ready to Gogh!</Heading>
      <Text align={'center'}>We&apos;re excited to welcome you to the family of Gogh small businesses. To help you get started, we will guide you through connecting your Square account, integrating Venmo and Zelle, and creating your first rewards.</Text>
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