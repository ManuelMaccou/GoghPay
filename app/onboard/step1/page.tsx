'use client'

import { useRouter } from 'next/navigation';
import { useMerchant } from '@/app/contexts/MerchantContext';
import { Button, Flex, Heading, Text } from "@radix-ui/themes";
import { getAccessToken, usePrivy } from '@privy-io/react-auth';
import * as Sentry from '@sentry/nextjs';

export default function Step1() {
  const router = useRouter();
  const { merchant, setMerchant } = useMerchant();
  const {user} = usePrivy();

  const handleUpdateOnboardingStep = async () => {
    console.log(merchant)
    if (!merchant) {
      console.error("No merchant data available");
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
          onboardingStep: 1,
        }),
      });

      if (response.ok) {
        const updatedMerchant = await response.json();
        setMerchant(updatedMerchant.merchant);
        console.log("updated merchant:", updatedMerchant.merchant);
      } else (
        console.error('Failed to update merchant', response.statusText)
      )
    } catch (error) {
      console.error('Error updating merchant:', error);
      Sentry.captureException(error);
    } finally {
      router.push('/onboard/step2');
    }
  };

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
    </Flex>
  );
}