'use client'

import { useRouter } from 'next/navigation';
import { useMerchant } from '@/app/contexts/MerchantContext';
import { Button, Callout, Flex, Heading, Strong, Text } from "@radix-ui/themes";
import { getAccessToken, usePrivy } from '@privy-io/react-auth';
import * as Sentry from '@sentry/nextjs';
import { useEffect, useState } from 'react';
import { ArrowLeftIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { MerchantTier } from '@/app/types/types';

export default function Step6() {
  const router = useRouter();
  const { merchant, setMerchant } = useMerchant();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (merchant && merchant.status === "onboarding" && (merchant.onboardingStep ?? 0) < 5) {
      const timer = setTimeout(() => {
        router.push(merchant.onboardingStep ? `/onboard/step${merchant.onboardingStep}` : '/onboard');
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [merchant, router]);

  useEffect(() => {
    if ( merchant && merchant?.tier !== MerchantTier.paid) {
      const timer = setTimeout(() => {
        router.push(`/sell`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [merchant, router])

  if (merchant && merchant.tier !== MerchantTier.paid) {
    return (
      <Flex direction={'column'} justify={{initial: 'start', sm: 'between'}} width={'100%'} flexGrow={'1'} py={'9'} gap={{initial: '9', sm:'0'}}>
        <Heading size={{ initial: "5", sm: "8" }} align={'center'}>Connect Square</Heading>
        <Flex direction={'column'} justify={'center'} gap={'5'} width={{initial: '100%', sm: '500px'}} style={{ alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto'}}>
          <Text style={{marginTop: 'auto', marginBottom: 'auto'}}>You are not authorized to view this page.</Text>
          <Text>Redirecting...</Text>
        </Flex>
      </Flex>
    )
  }

  if (merchant && merchant.status === "onboarding" && (merchant.onboardingStep ?? 0) < 5) {
    return (
      <Flex direction={'column'} justify={{initial: 'start', sm: 'between'}} width={'100%'} flexGrow={'1'} py={'9'} gap={{initial: '9', sm:'0'}}>
        <Heading size={{ initial: "5", sm: "8" }} align={'center'}>Configure rewards</Heading>
        <Flex direction={'column'} justify={'center'} gap={'5'} width={{initial: '100%', sm: '500px'}} style={{ alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto'}}>
          <Text style={{marginTop: 'auto', marginBottom: 'auto'}}>Please complete the previous onboarding steps before proceeding.</Text>
          <Text>Redirecting...</Text>
        </Flex>
      </Flex>
    )
  }

  return (
    <Flex direction={'column'} justify={'center'} maxWidth={'500px'} gap={'4'}>
      <Heading align={'center'}>Almost done!</Heading>
      <Text align={'center'} style={{marginTop: 'auto', marginBottom: 'auto'}}>
        Next you&apos;ll configure the rewards and discounts you want to share with your most loyal customers. 
        Once you set at least one milestone or welcome reward, you&apos;ll be all set.
      </Text>
      <Text align={'center'}><Strong>Welcome to Gogh!</Strong></Text>
      <Button size={'4'} mt={'5'} onClick={() => router.push('/rewards/manage')}>Configure rewards</Button>
      <Button
        disabled={!merchant}
        size={'4'}
        variant='ghost'
        mt={'4'}
        style={{ fontWeight: 'bold' }}
        onClick={() => router.push('/onboard/step5')}
      >
        <ArrowLeftIcon height={'20'} width={'20'} />
        Back
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