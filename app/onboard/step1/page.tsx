'use client'

import { useRouter } from 'next/navigation';
import { useMerchant } from '@/app/contexts/MerchantContext';
import { Avatar, Button, Callout, Flex, Heading, Link, Text, TextField } from "@radix-ui/themes";
import { getAccessToken, usePrivy } from '@privy-io/react-auth';
import * as Sentry from '@sentry/nextjs';
import UploadImage from '@/app/components/UploadImage';
import { useEffect, useState } from 'react';
import { ArrowRightIcon, InfoCircledIcon } from '@radix-ui/react-icons';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function Step1() {
  const router = useRouter();
  const { merchant, setMerchant } = useMerchant();
  const { user } = usePrivy();

  const [newMerchantName, setNewMerchantName] = useState<string | null>(null);
  const [isLogoUploaded, setIsLogoUploaded] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorMessageWithLogin, setErrorMessageWithLogin] = useState<boolean>(false);

  useEffect(() => {
    if (merchant?.name) {
      setNewMerchantName(merchant.name);
    }
  }, [merchant?.name]);

  const handleMerchantNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMerchantName(e.target.value);
  };

  const handleFinishStep1 = async () => {
    if (!merchant) {
      console.error("No merchant data available");
      setErrorMessageWithLogin(true);
      return;
    }

    if (!isLogoUploaded && !merchant.branding?.logo) {
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
          onboardingStep: 1,
        }),
      });

      if (response.ok) {
        const updatedMerchant = await response.json();
        setMerchant(updatedMerchant.merchant);
        console.log("updated merchant:", updatedMerchant.merchant);
        router.push('/onboard/step2');
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
      <Heading size={{ initial: "5", md: "8" }} align={'center'}>Branding</Heading>
      <Flex direction={'column'} justify={'center'} gap={'5'} width={{initial: '100%', md: '500px'}} style={{ alignSelf: 'center'}}>
        <Text align={'left'} mb={'-3'}>Business name</Text>
        <TextField.Root
          size={'3'}
          placeholder="Your business name"

          type="text"
          value={newMerchantName || ''}
          onChange={handleMerchantNameChange}
          required
        >
        </TextField.Root>
        {merchant ? (
          <>
            <Text mb={'-3'} align={'left'}>Your logo</Text>
            {merchant.branding?.logo ? (
              <Flex direction={'row'} align={'center'} gap={'5'}>
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
                <Avatar
                  size={'7'}
                  src={merchant.branding.logo}
                  fallback=""
                />
              </Flex>
            ) : (
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
            )}
          </>
        ) : (
          <Button loading></Button>
        )}
      </Flex>
      
      <Flex direction={'column'} align={'end'} justify={'end'} width={'100%'}>
        <Button
          disabled={!merchant || (!isLogoUploaded && !merchant.branding?.logo) || !newMerchantName}
          size={'4'}
          variant='ghost'
          style={{ width: '250px', cursor: !merchant || !isLogoUploaded || !newMerchantName ? 'default' : 'pointer', fontWeight: 'bold' }}
          onClick={handleFinishStep1}
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
      {errorMessageWithLogin && (
        <Callout.Root color='red' mx={'4'}>
          <Callout.Icon>
            <InfoCircledIcon />
          </Callout.Icon>
          <Callout.Text>
            An unexpected error happened. Please {" "} <Link href="/">log in and try again.</Link>
          </Callout.Text>
        </Callout.Root>
      )}
      
    </Flex>
  );
}