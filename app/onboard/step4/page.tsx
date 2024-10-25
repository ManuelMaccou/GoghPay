'use client'

import { useRouter } from 'next/navigation';
import { useMerchant } from '@/app/contexts/MerchantContext';
import { Button, Callout, Checkbox, Flex, Heading, Link, Separator, Text, TextField } from "@radix-ui/themes";
import { getAccessToken, usePrivy } from '@privy-io/react-auth';
import * as Sentry from '@sentry/nextjs';
import { useEffect, useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { Tax } from '@/app/types/types';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function Step4() {
  const router = useRouter();
  const { merchant, setMerchant } = useMerchant();
  const { user } = usePrivy();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorMessageWithLogin, setErrorMessageWithLogin] = useState<boolean>(false);
  const [taxAmount, setTaxAmount] = useState<number | null>(null);
  const [taxes, setTaxes] = useState<Tax[] | null>(null);
  const [isChecked, setIsChecked] = useState<boolean>(false);
  const [taxesUpdated, setTaxesUpdated] = useState<boolean>(false);

  const handleTaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedRate = validateAndFormatRate(e.target.value);
    if (formattedRate) {
      setTaxAmount(parseFloat(formattedRate));
      setErrorMessage(null);
    } else {
      setTaxAmount(null);
      setErrorMessage("Please enter a valid tax percentage (e.g., 9.5).");
    }
  };

  const handleAddTax = async (newTax: { rate: string }) => {
    if (!merchant) return;

    if(!newTax.rate) {
      setErrorMessage('Please enter a valid tax rate.');
      return;
    }

    const accessToken = await getAccessToken();

    const updatedTaxes = [
      ...(taxes?.map((tax: Tax) => ({
        ...tax,
        default: false, // Set all existing taxes to non-default
      })) || []), // Fallback to an empty array if taxes is null or undefined
      { name: 'Default', rate: newTax.rate, default: true }, // Add the new tax and set it as the default
    ];

    try {
      const response = await fetch(`/api/merchant/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          privyId: user?.id,
          taxes: updatedTaxes,
        }),
      });

      if (response.ok) {
        const updatedMerchant = await response.json();
        setMerchant(updatedMerchant.merchant);
        setTaxes(updatedMerchant.merchant.taxes);
        setTaxesUpdated(true);
      } else {
        const errorText = await response.text();
        console.error("Failed to fetch merchant", response.statusText, errorText);
        Sentry.captureMessage(`Failed to fetch merchant: ${response.statusText}, ${errorText}`);
        setErrorMessage("Failed to update tax information. Please try again.");
      }
    } catch (error) {
      Sentry.captureException(error);
      if (isError(error)) {
        console.error('Error updating merchant taxes:', error.message);
        setErrorMessage('There was an error. Please try again.');
      } else {
        console.error('An unexpected error occurred:', error);
        setErrorMessage('There was an error. Please try again.');
      }
    }
  };

  const handleCheckBoxChange = (checked: boolean | 'indeterminate') => {
    setIsChecked(checked === true);
  };

  const handleFinishStep4 = async () => {
    if (!merchant) {
      console.error("No merchant data available");
      setErrorMessageWithLogin(true);
      return;
    }

    if (!isChecked && (!merchant.taxes || merchant.taxes.length === 0)) {
      setErrorMessage("Please add sales tax or opt out. You can change this later.");
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
          onboardingStep: 4,
        }),
      });

      if (response.ok) {
        const updatedMerchant = await response.json();
        setMerchant(updatedMerchant.merchant);
        router.push('/onboard/step5');
      } else {
        console.error('Failed to update merchant', response.statusText);
        setErrorMessage(`An unexpected error happened. Please try again later: ${response.statusText}`);
        Sentry.captureException(new Error(`Failed to update merchant: ${response.statusText} (Status: ${response.status})`));
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

  const validateAndFormatRate = (rate: string): string => { 
    const validRate = rate.match(/^\d+(\.\d{0,2})?$/);
    if (validRate && parseFloat(validRate[0]) < 100) {
      return validRate[0];
    }
    return '';
  };

  useEffect(() => {
    if (merchant && merchant.status === "onboarding" && (merchant.onboardingStep ?? 0) < 3) {
      const timer = setTimeout(() => {
        router.push(`/onboard/step${merchant.onboardingStep || '1'}`);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [merchant, router]);

  useEffect(() => {
    if (merchant && merchant.taxes) {
      setTaxes(merchant.taxes);
    }
  }, [merchant]);

  useEffect(() => {
    if (merchant?.name) {
      setTaxAmount(merchant.taxes?.find(tax => tax.default === true)?.rate || null);
    }
  }, [merchant?.name, merchant?.taxes]);

  if (merchant && merchant.status === "onboarding" && (merchant.onboardingStep ?? 0) < 3) {
    return (
      <Flex direction={'column'} justify={{initial: 'start', sm: 'between'}} width={'100%'} flexGrow={'1'} py={'9'} gap={{initial: '9', sm:'0'}}>
        <Heading size={{ initial: "5", sm: "8" }} align={'center'}>Configure sales tax</Heading>
        <Flex direction={'column'} justify={'center'} gap={'5'} width={{initial: '100%', sm: '500px'}} style={{ alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto'}}>
          <Text style={{marginTop: 'auto', marginBottom: 'auto'}}>Please complete the previous onboarding steps before proceeding.</Text>
          <Text>Redirecting...</Text>
        </Flex>
      </Flex>
    )
  }

  return (
    <Flex direction={'column'} justify={{initial: 'start', sm: 'between'}} width={'100%'} flexGrow={'1'} py={'9'} gap={{initial: '9', sm:'0'}}>
      <Heading size={{ initial: "5", sm: "8" }} align={'center'}>Configure sales tax</Heading>
      <Flex direction={'column'} justify={'center'} gap={'5'} width={{initial: '100%', sm: '500px'}} style={{ alignSelf: 'center'}}>
        <Text>
          For credit card payments, we will use your tax settings from Square. 
          If you would like us to calculate sales tax for Venmo, Zelle, 
          and cash payments, enter the amount here. You change this later.
        </Text>
        <Text align={'left'} mb={'-3'}>Tax percentage</Text>
        <Flex direction={'column'} gap={'2'}>
          <Flex direction={'row'} gap={'2'}>
            <TextField.Root
              size={'3'}
              placeholder="9.5"
              type="number"
              value={taxAmount !== null ? taxAmount.toString() : 'Enter amount'}
              onChange={handleTaxChange}
              required
            >
            <TextField.Slot side='right'>
              <Text>%</Text>
            </TextField.Slot>
            </TextField.Root>
            <Button
              size={'3'}
              onClick={() => {
                if (taxAmount !== null) {
                  handleAddTax({ rate: taxAmount.toString() });
                }
              }}
            >
              Confirm
            </Button>
          </Flex>
          {(taxesUpdated || (merchant?.taxes?.find(tax => tax.default === true)?.rate)) && (
            <Callout.Root color='green' size={'1'} style={{padding: '10px', width: 'max-content'}}>
              <Callout.Text>
                Tax set to {taxAmount}%
              </Callout.Text>
            </Callout.Root>
          )}
          
        </Flex>
        <Separator size={'4'} />
        <Text as="label" size="3">
          <Flex direction={'row'} gap="2">
            <Checkbox
              onCheckedChange={handleCheckBoxChange} 
              checked={isChecked}
            />
            I opt out of collecting sales tax.
          </Flex>
        </Text>
      </Flex>
      
      <Flex direction={'row'} justify={'between'} mx={'4'}>
        <Button
          disabled={!merchant}
          size={'4'}
          variant='ghost'
          style={{ fontWeight: 'bold' }}
          onClick={() => router.push('/onboard/step3')}
        >
          <ArrowLeftIcon height={'20'} width={'20'} />
          Back
        </Button>
        <Button
          disabled={!merchant || (!taxes?.length && !isChecked)}
          size={'4'}
          variant='ghost'
          style={{ cursor: !merchant?.taxes && !isChecked ? 'default' : 'pointer', fontWeight: 'bold' }}
          onClick={handleFinishStep4}
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