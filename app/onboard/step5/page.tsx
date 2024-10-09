'use client'

import { useRouter } from 'next/navigation';
import { useMerchant } from '@/app/contexts/MerchantContext';
import { Avatar, Button, Callout, Checkbox, Flex, Heading, Link, Text, TextField } from "@radix-ui/themes";
import { getAccessToken, usePrivy } from '@privy-io/react-auth';
import * as Sentry from '@sentry/nextjs';
import UploadImage from '@/app/components/UploadImage';
import { useEffect, useState } from 'react';
import { ArrowRightIcon, InfoCircledIcon } from '@radix-ui/react-icons';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function Step5() {
  const router = useRouter();
  const { merchant, setMerchant } = useMerchant();
  const { user } = usePrivy();

  const [newMerchantName, setNewMerchantName] = useState<string | null>(null);
  const [isVenmoQrUploaded, setIsVenmoQrUploaded] = useState<boolean>(false);
  const [isZelleQrUploaded, setIsZelleQrUploaded] = useState<boolean>(false);
  const [isVenmoChecked, setIsVenmoChecked] = useState<boolean>(false);
  const [isZelleChecked, setIsZelleChecked] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorMessageWithLogin, setErrorMessageWithLogin] = useState<boolean>(false);

  useEffect(() => {
    if (merchant?.name) {
      setNewMerchantName(merchant.name);
    }
  }, [merchant?.name]);

  const handleVenmoCheckBoxChange = (checked: boolean | 'indeterminate') => {
    setIsVenmoChecked(checked === true);
  };

  const handleZelleCheckBoxChange = (checked: boolean | 'indeterminate') => {
    setIsZelleChecked(checked === true);
  };


  const handleFinishStep5 = async () => {
    if (!merchant) {
      console.error("No merchant data available");
      setErrorMessageWithLogin(true);
      return;
    }

    if (!isVenmoChecked && !isVenmoQrUploaded && !merchant.paymentMethods?.venmoQrCodeImage) {
      setErrorMessage("Please add your Venmo QR code or confirm you don't accept Venmo payments.");
      return;
    }

    if (!isZelleChecked && !isZelleQrUploaded && !merchant.paymentMethods?.zelleQrCodeImage) {
      setErrorMessage("Please add your Zelle QR code or confirm you don't accept Zelle payments.");
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
          onboardingStep: 5,
        }),
      });

      if (response.ok) {
        const updatedMerchant = await response.json();
        setMerchant(updatedMerchant.merchant);
        console.log("updated merchant:", updatedMerchant.merchant);
        router.push('/onboard/step6');
      } else {
        console.error('Failed to update merchant', response.statusText);
        Sentry.captureException(new Error('Failed to update merchant'));
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

  useEffect(() => {
    if (merchant && merchant.status === "onboarding" && (merchant.onboardingStep ?? 0) < 4) {
      const timer = setTimeout(() => {
        router.push(`/onboard/step${merchant.onboardingStep || '1'}`);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [merchant, router]);

  if (merchant && merchant.status === "onboarding" && (merchant.onboardingStep ?? 0) < 4) {
    return (
      <Flex direction={'column'} justify={{initial: 'start', sm: 'between'}} width={'100%'} flexGrow={'1'} py={'9'} gap={{initial: '9', sm:'0'}}>
        <Heading size={{ initial: "5", sm: "8" }} align={'center'}>Integrate Venmo</Heading>
        <Flex direction={'column'} justify={'center'} gap={'5'} width={{initial: '100%', sm: '500px'}} style={{ alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto'}}>
          <Text style={{marginTop: 'auto', marginBottom: 'auto'}}>Please complete the previous onboarding steps before proceeding.</Text>
          <Text>Redirecting...</Text>
        </Flex>
      </Flex>
    )
  }

  return (
    <Flex direction={'column'} justify={{initial: 'start', sm: 'between'}} width={'100%'} flexGrow={'1'} py={'9'} gap={{initial: '9', sm:'0'}}>
      <Flex direction={'column'} gap={'9'}>
        <Flex direction={'column'} justify={'center'} gap={'5'} width={{initial: '100%', sm: '500px'}} style={{ alignSelf: 'center'}}>
        <Heading size={{ initial: "5", sm: "8" }} align={'center'}>Integrate Venmo</Heading>
          {merchant ? (
           <>
              <Text mb={'-3'} align={'left'}>Take a screenshot of your Venmo QR code and upload it here.</Text>
              {merchant.paymentMethods?.venmoQrCodeImage ? (
                <Flex direction={{initial: 'column', sm: 'row'}} align={'center'} gap={'5'}>
                  <Flex direction={'column'} align={'center'} p={'7'} flexGrow={'1'} style={{border: '1px dashed black'}}>
                    <UploadImage
                      merchantId={merchant._id}
                      fieldToUpdate="paymentMethods.venmoQrCodeImage"
                      crop={true}
                      onUploadSuccess={(updatedMerchant) => {
                        setMerchant(updatedMerchant);
                        setIsVenmoQrUploaded(true);
                      }}
                    />
                  </Flex>
                  <Flex direction={'column'} maxWidth={{initial: 'inherit', sm: '200px'}}>
                    <Callout.Root color='green' mx={'4'}>
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text>
                        Venmo QR code is successfully set.
                      </Callout.Text>
                    </Callout.Root>
                  </Flex>
                </Flex>
              ) : (
                <>
                  <Flex direction={'column'} align={'center'} p={'7'} style={{border: '1px dashed black'}}>
                    <UploadImage
                      merchantId={merchant._id}
                      fieldToUpdate="paymentMethods.venmoQrCodeImage"
                      crop={true}
                      onUploadSuccess={(updatedMerchant) => {
                        setMerchant(updatedMerchant);
                        setIsVenmoQrUploaded(true);
                      }}
                    />
                  </Flex>
                  <Text as="label" size="3">
                    <Flex direction={'row'} gap="2">
                      <Checkbox
                        onCheckedChange={handleVenmoCheckBoxChange} 
                        checked={isVenmoChecked}
                      />
                      I don`&apos;`t accept Venmo payments.
                    </Flex>
                  </Text>
                </>
              )}
            </>
          ) : (
            <Button loading></Button>
          )}
        </Flex>
        <Flex direction={'column'} justify={'center'} gap={'5'} width={{initial: '100%', sm: '500px'}} style={{ alignSelf: 'center'}}>
        <Heading size={{ initial: "5", sm: "8" }} align={'center'}>Integrate Zelle</Heading>
          {merchant ? (
            <>
              <Text mb={'-3'} align={'left'}>Take a screenshot of your Zelle QR code and upload it here.</Text>
              
              {merchant.paymentMethods?.zelleQrCodeImage ? (
                <Flex direction={{initial: 'column', sm: 'row'}} align={'center'} gap={'5'} justify={'between'}>
                  <Flex direction={'column'} align={'center'} p={'7'} flexGrow={'1'} style={{border: '1px dashed black'}}>
                    <UploadImage
                      merchantId={merchant._id}
                      fieldToUpdate="paymentMethods.zelleQrCodeImage"
                      crop={true}
                      onUploadSuccess={(updatedMerchant) => {
                        setMerchant(updatedMerchant);
                        setIsZelleQrUploaded(true);
                      }}
                    />
                  </Flex>
                  <Flex direction={'column'}  maxWidth={{initial: 'inherit', sm: '200px'}}>
                    <Callout.Root color='green' mx={'4'}>
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text>
                        Zelle QR code is successfully set.
                      </Callout.Text>
                    </Callout.Root>
                  </Flex>
                </Flex>
              ) : (
              <>
                <Flex direction={'column'} align={'center'} p={'7'} style={{border: '1px dashed black'}}>
                  <UploadImage
                    merchantId={merchant._id}
                    fieldToUpdate="paymentMethods.zelleQrCodeImage"
                    crop={true}
                    onUploadSuccess={(updatedMerchant) => {
                      setMerchant(updatedMerchant);
                      setIsZelleQrUploaded(true);
                    }}
                  />
                </Flex>
                <Text as="label" size="3">
                  <Flex direction={'row'} gap="2">
                    <Checkbox
                      onCheckedChange={handleZelleCheckBoxChange} 
                      checked={isZelleChecked}
                    />
                    I don`&apos;`t accept Zelle payments.
                  </Flex>
                </Text>
              </>
              )}
            </>
          ) : (
            <Button loading></Button>
          )}
        </Flex>
      </Flex>
      <Flex direction={'column'} align={{initial: 'center', sm: 'end'}} justify={'end'} width={'100%'}>
        <Button
          disabled={!merchant}
          size={'4'}
          variant='ghost'
          style={{ width: '250px', cursor: !merchant ? 'default' : 'pointer', fontWeight: 'bold' }}
          onClick={handleFinishStep5}
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