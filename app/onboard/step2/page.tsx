'use client'

import { useRouter } from 'next/navigation';
import { useMerchant } from '@/app/contexts/MerchantContext';
import { Button, Callout, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import { getAccessToken, usePrivy } from '@privy-io/react-auth';
import * as Sentry from '@sentry/nextjs';
import UploadImage from '@/app/components/UploadImage';
import { useEffect, useState } from 'react';
import { ArrowRightIcon, InfoCircledIcon } from '@radix-ui/react-icons';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function Step2() {
  const router = useRouter();
  const { merchant, setMerchant } = useMerchant();
  const { user } = usePrivy();

  const [newMerchantName, setNewMerchantName] = useState<string | null>(null);
  const [isLogoUploaded, setIsLogoUploaded] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (merchant?.name) {
      setNewMerchantName(merchant.name);
    }
  }, [merchant?.name]);

  const handleMerchantNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMerchantName(e.target.value);
  };

  const handleFinishStep2 = async () => {
    if (!merchant) {
      console.error("No merchant data available");
      return;
    }

    if (!isLogoUploaded) {
      setErrorMessage("Please upload a logo first");
      return;
    }

    if (!newMerchantName) {
      setErrorMessage("Please enter a business name");
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
          name: newMerchantName,
          onboardingStep: 2,
        }),
      });

      if (response.ok) {
        const updatedMerchant = await response.json();
        setMerchant(updatedMerchant.merchant);
        console.log("updated merchant:", updatedMerchant.merchant);
        router.push('/onboard/step3');
      } else {
        console.error('Failed to update merchant', response.statusText);
        setErrorMessage('An unexpected error happened. Please try again later.');
      }
    } catch (error) {
      console.error('Error updating merchant:', error);
      setErrorMessage('An unexpected error happened. Please try again later.');
      Sentry.captureException(error);
    
      if (isError(error)) {
        console.error(error.message);
      }
    }
  };

  return (
    <Flex direction={'column'} justify={'between'} width={'100%'} height={'100vh'} py={'9'}>
      <Heading size={{ initial: "5", md: "8" }}>Branding</Heading>
      <Flex direction={'column'} justify={'center'} align={'start'} gap={'5'} style={{width: 'max-content', alignSelf: 'center'}}>
        <Text align={'left'} mb={'-3'}>Business name</Text>
        <TextField.Root
          size={'3'}
          placeholder="Your business name"
          style={{width: '200px'}}
          type="text"
          value={newMerchantName || ''}
          onChange={handleMerchantNameChange}
          required
        >
        </TextField.Root>
        {merchant ? (
          <>
            <Text mb={'-3'} align={'left'}>Your logo</Text>
            <Flex direction={'column'} align={'center'} p={'7'} style={{border: '1px dashed black'}}>
              <UploadImage
                merchantId={merchant._id}
                fieldToUpdate="branding.logo"
                onUploadSuccess={(updatedMerchant) => {
                  setMerchant(updatedMerchant);
                  setIsLogoUploaded(true);
                }}
              />
            </Flex>
           
          </>
        ) : (
          <Button loading></Button>
        )}
      </Flex>
      
      <Flex direction={'column'} align={'end'} justify={'end'} width={'100%'}>
        <Button
          size={'4'}
          variant='ghost'
          style={{ width: '250px', cursor: 'pointer', fontWeight: 'bold' }}
          onClick={handleFinishStep2}
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