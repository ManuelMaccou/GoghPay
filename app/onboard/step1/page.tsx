'use client'

import { useRouter } from 'next/navigation';
import { useMerchant } from '@/app/contexts/MerchantContext';
import { Avatar, Button, Callout, Flex, Heading, Link, RadioCards, Separator, Text, TextField } from "@radix-ui/themes";
import { getAccessToken, usePrivy } from '@privy-io/react-auth';
import * as Sentry from '@sentry/nextjs';
import UploadImage from '@/app/components/UploadImage';
import { useEffect, useState } from 'react';
import { ArrowRightIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faPhone } from '@fortawesome/free-solid-svg-icons';
import { ContactMethod, MerchantTier } from '@/app/types/types';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function Step1() {
  const router = useRouter();
  const { merchant, setMerchant } = useMerchant();
  const { user } = usePrivy();

  const [newMerchantName, setNewMerchantName] = useState<string | null>(null);
  const [preferredContactMethod, setPreferredContactMethod] = useState<ContactMethod | null>(null);
  const [isLogoUploaded, setIsLogoUploaded] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorMessageWithLogin, setErrorMessageWithLogin] = useState<boolean>(false);

  useEffect(() => {
    if (merchant?.name) {
      setNewMerchantName(merchant.name);
    }
  }, [merchant?.name]);

  useEffect(() => {
    if (merchant?.preferredContactMethod)
      setPreferredContactMethod(merchant.preferredContactMethod)
  }, [merchant?.preferredContactMethod])

  const handleMerchantNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMerchantName(e.target.value);
  };

  const handleRadioCardChange = (value: string) => {
    if (value === 'phone') {
      setPreferredContactMethod(ContactMethod.Phone)
    } else if (value === 'email') {
      setPreferredContactMethod(ContactMethod.Email)
    } else if (value === 'either') {
      setPreferredContactMethod(ContactMethod.Either)
    }
  };

  useEffect(() => {
    console.log('preferred:', preferredContactMethod)
  }, [preferredContactMethod])

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

    if (!preferredContactMethod) {
      setErrorMessage("Please select a preferred contact method.")
      return;
    }

    const accessToken = await getAccessToken();

    try {
      console.log('preferred contact:', preferredContactMethod)
      const response = await fetch(`/api/merchant/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          privyId: user?.id,
          name: newMerchantName,
          preferredContactMethod,
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
        Sentry.captureException(new Error(`Failed to update merchant: ${response.statusText} (Status: ${response.status})`));
        setErrorMessage('An unexpected error happened. Please try again later.');
      }
    } catch (error) {
      console.error('Error updating merchant:', error);
      Sentry.captureException(error);
      setErrorMessage('An unexpected error happened. Please try again later.');
      Sentry.captureException(error);
    
      if (isError(error)) {
        console.error(error.message);
      }
    }
  };

  useEffect(() => {
    if ( merchant && merchant?.tier !== MerchantTier.paid) {
      const timer = setTimeout(() => {
        router.push(`/sell`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [merchant])

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

  return (
    <Flex direction={'column'} justify={{initial: 'start', sm: 'between'}} width={'100%'} flexGrow={'1'} py={'9'} gap={{initial: '9', sm:'0'}}>
      <Heading size={{ initial: "5", sm: "8" }} align={'center'}>Branding and Communications</Heading>
      <Flex direction={'column'} justify={'center'} gap={'5'} width={{initial: '100%', sm: '500px'}} style={{ alignSelf: 'center'}}>
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
                <Flex direction={'column'} align={'center'} p={'7'} flexGrow={'1'} style={{border: '1px dashed black'}}>
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
        <Flex direction={'column'} gap={'3'}>
          <Text align={'left'}>Which would you like to collect from your customers?</Text>
          <RadioCards.Root defaultValue={merchant ? merchant.preferredContactMethod : 'phone'}  columns={{ initial: '1', sm: '3' }} onValueChange={handleRadioCardChange}>
            <RadioCards.Item value="phone">
              <Flex direction="row" width="100%" gap={'4'} align={'center'} height={'35px'}>
                <FontAwesomeIcon icon={faPhone} />
                <Text>Phone number</Text>
              </Flex>
            </RadioCards.Item>
            <RadioCards.Item value="email">
              <Flex direction="row" width="100%" gap={'4'} align={'center'} height={'35px'}>
                <FontAwesomeIcon icon={faEnvelope} />
                <Text>Email address</Text>
              </Flex>
            </RadioCards.Item>
            <RadioCards.Item value="either">
              <Flex direction="row" width="100%" gap={'4'} align={'center'} height={'35px'}>
                <Flex direction={'row'} gap={'3'} justify={'center'} align={'center'}>
                  <FontAwesomeIcon icon={faPhone} />
                  <Text weight={'bold'} size={'4'}>/</Text>
                  <FontAwesomeIcon icon={faEnvelope} />
                </Flex>
                <Text>Either</Text>
              </Flex>
            </RadioCards.Item>
          </RadioCards.Root>
        </Flex>
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

      <Flex direction={'column'} align={{initial: 'center', sm: 'end'}} justify={'end'} width={'100%'}>
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
      
    </Flex>
  );
}