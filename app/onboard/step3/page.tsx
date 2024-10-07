'use client'

import { useRouter } from 'next/navigation';
import Image from "next/image";
import { useMerchant } from '@/app/contexts/MerchantContext';
import { Avatar, Button, Callout, Checkbox, Flex, Heading, Link, Separator, Text } from "@radix-ui/themes";
import { getAccessToken, usePrivy } from '@privy-io/react-auth';
import * as Sentry from '@sentry/nextjs';
import { useEffect, useState } from 'react';
import { ArrowRightIcon, InfoCircledIcon } from '@radix-ui/react-icons';

export default function Step3() {
  const router = useRouter();
  const { merchant, setMerchant } = useMerchant();
  const { user } = usePrivy();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChecked, setIsChecked] = useState<boolean>(false);

  const handleCheckBoxChange = (checked: boolean | 'indeterminate') => {
    setIsChecked(checked === true);
  };

  const handleFinishStep3 = async () => {
    console.log(merchant)
    if (!merchant) {
      console.error("No merchant data available");
      return;
    }

    if (!isChecked) {
      setErrorMessage("Please confirm you have the correct Square POS app installed.");
      return;
    }

    const accessToken = await getAccessToken();

    try {
      const response = await fetch(`/api/merchant/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          privyId: user?.id,
          onboardingStep: 3,
        }),
      });

      if (response.ok) {
        const updatedMerchant = await response.json();
        setMerchant(updatedMerchant.merchant);
        console.log("updated merchant:", updatedMerchant.merchant);
        router.push('/onboard/step4');
      } else (
        console.error('Failed to update merchant', response.statusText)
      )
    } catch (error) {
      console.error('An unexpected error happened:', error);
      setErrorMessage('An unexpected error happened. Please try again later.');
      Sentry.captureException(error);
    }
  };

  useEffect(() => {
    if (merchant && merchant.onboardingStep < 2) {
      const timer = setTimeout(() => {
        router.push(`/onboard/step2`);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [merchant, router]);

  if (merchant && merchant.onboardingStep < 2) {
    return (
      <Flex direction={'column'} justify={'between'} width={'100%'} height={'100vh'} py={'9'}>
      <Heading size={{ initial: "5", md: "8" }}>Connect Square</Heading>
      <Flex direction={'column'} justify={'center'} gap={'5'} width={{initial: '100%', md: '500px'}} style={{ alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto'}}>
        <Text style={{marginTop: 'auto', marginBottom: 'auto'}}>Please complete the previous onboarding steps before proceeding.</Text>
        <Text>Redirecting...</Text>
      </Flex>
    </Flex>
    )
  }

  return (
    <Flex direction={'column'} justify={'between'} width={'100%'} height={'100vh'} py={'9'}>
      <Heading size={{ initial: "5", md: "8" }}>Connect Square</Heading>
      <Flex direction={'column'} justify={'center'}  gap={'5'} width={{initial: '100%', md: '500px'}} style={{ alignSelf: 'center'}}>
        <Text>First, let&apos;s confirm you have the right Square POS app installed on your phone. 
          If the icon is grey and looks like the one below, you&apos;re all set. 
          If you have a different app, click the link below to install the correct one. 
          Don&apos;t worry, all of your settings and data will be exactly the same and you wont need to create a new account.</Text>
          <Flex direction={'column'} align={'center'} gap={'5'}>
            <Avatar
            size={'7'}
              src="/logos/squarePosIcon.png"
              fallback="A"
            />
            <Text>Download Square POS</Text>
            <Flex direction={'row'} gap={'4'} align={'center'}>
            <Link href="https://apps.apple.com/us/app/square-point-of-sale-pos/id335393788" target="_blank">iPhone</Link>
            <Separator orientation="vertical" />
            <Link href="https://play.google.com/store/apps/details?id=com.squareup" target="_blank">Android</Link>
            </Flex>
            
          </Flex>
          <Text as="label" size="3">
            <Flex direction={'row'} gap="2">
              <Checkbox
                onCheckedChange={handleCheckBoxChange} 
                checked={isChecked}
                
              />
              I have the correct Square POS app installed.
            </Flex>
          </Text>
        </Flex>
        <Flex direction={'column'} align={'end'} justify={'end'} width={'100%'}>
        <Button
          disabled={!merchant || !isChecked}
          size={'4'}
          variant='ghost'
          style={{ width: '250px', cursor: !merchant || !isChecked ? 'default' : 'pointer', fontWeight: 'bold' }}
            onClick={handleFinishStep3}
          >
            Next
            <ArrowRightIcon height={'20'} width={'20'} />
          </Button>
        </Flex>
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