'use client'

import { useRouter } from 'next/navigation';
import { useMerchant } from '@/app/contexts/MerchantContext';
import { Button, Callout, Checkbox, Flex, Heading, Link, Separator, Spinner, Table, Text, TextField } from "@radix-ui/themes";
import { getAccessToken, usePrivy } from '@privy-io/react-auth';
import * as Sentry from '@sentry/nextjs';
import { useEffect, useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { User } from '@/app/types/types';
import { useUser } from '@/app/contexts/UserContext';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function NewMerchant() {
  const router = useRouter();
  const { user } = usePrivy();
  const { appUser } = useUser();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [merchantEmail, setMerchantEmail] = useState("");

  const [merchantUsers, setMerchantUsers] = useState<User[]>([]);

  const handleMerchantNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
   setMerchantName(e.target.value)
  };

  const handleMerchantEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMerchantEmail(e.target.value)
  };

  const handleUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserName(e.target.value)
  };

  useEffect(() => {
    const fetchMerchants = async () => {
      try {
        const response = await fetch('/api/user/all-merchant-users');
        if (!response.ok) {
          throw new Error('Failed to fetch merchants');
        }
        const data = await response.json();
        setMerchantUsers(data);
      } catch (error) {
        console.error('Error fetching merchants:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMerchants();
  }, []);

  const fetchMerchants = async () => {
    try {
      const response = await fetch('/api/user/all-merchant-users');
      if (!response.ok) {
        throw new Error('Failed to fetch merchants');
      }
      const data = await response.json();
      setMerchantUsers(data);
    } catch (error) {
      console.error('Error fetching merchants:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleSubmit = async() => {
    const accessToken = await getAccessToken();
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/user/import-privy-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          privyId: user?.id,
          userData: {
            email: merchantEmail,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add Privy user: ${response.statusText}`);
      }

      const newPrivyUser = await response.json();
      console.log('privy user:', newPrivyUser)
      const privyId = newPrivyUser.user.id;

      const userResponse = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privyId,
          email: merchantEmail,
          merchant: true,
          name: userName,
          creationType: 'privy',
        }),
      });

      if (!userResponse.ok) {
        throw new Error('Failed to save user in the database');
      }

      const { user: savedUser } = await userResponse.json();

      const merchantResponse = await fetch('/api/merchant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: savedUser._id,
          name: merchantName,
          status: 'onboarding', 
          tier: 'free',  
          privyId: newPrivyUser.user.id
        }),
      });
      if (!merchantResponse.ok) {
        throw new Error('Failed to save merchant in the database');
      }
  
      const savedMerchant = await merchantResponse.json();
  
      console.log('User and Merchant created successfully:', { savedUser, savedMerchant });
      setSuccessMessage('Merchant setup complete!');
      fetchMerchants;
    } catch (error: any) {
      setErrorMessage(`Failed to complete merchant setup: ${error.message}`);
      console.error(error);
    }
  };

  useEffect(() => {
    if ( appUser && !appUser.admin) {
      const timer = setTimeout(() => {
        router.push(`/`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [appUser])

  if (loading) return <Spinner />;

  if ( appUser && !appUser.admin) {
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
    <Flex direction={'column'} width={'100%'} py={'9'} gap={{initial: '9', sm:'0'}}>
      <Heading size={{ initial: "5", sm: "8" }} align={'center'}>New Merchant</Heading>
      <Flex direction={'column'} width={'90%'} justify={'center'} gap={'5'}  style={{ alignSelf: 'center'}}>
          <Text as='label'>
            Merchant name
          </Text>
          <TextField.Root
            size={'3'}
            value={userName}
            onChange={handleUserNameChange}
            required
          >
          </TextField.Root>
          <Text as='label'>
            Business name
          </Text>
          <TextField.Root
            size={'3'}
            value={merchantName}
            onChange={handleMerchantNameChange}
            required
          >
          </TextField.Root>
          <Text as='label'>
            Email
          </Text>
          <TextField.Root
            size={'3'}
            placeholder='@gmail.com'
            value={merchantEmail}
            onChange={handleMerchantEmailChange}
            required
          >
          </TextField.Root>
          <Button size={'3'} onClick={handleSubmit}>
            Submit
          </Button>
     
       
        {successMessage && (
          <Callout.Root color='green' mx={'4'}>
            <Callout.Icon>
              <InfoCircledIcon />
            </Callout.Icon>
            <Callout.Text>
              {successMessage}
            </Callout.Text>
          </Callout.Root>
        )}

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

        <Heading mt={'5'} size={{ initial: "5", sm: "8" }} align={'center'}>All Merchants</Heading>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>

        <Table.Body>
          {merchantUsers.length > 0 ? (
            merchantUsers
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((merchantUser) => (
              <Table.Row key={merchantUser._id}>
                <Table.RowHeaderCell>{merchantUser.name}</Table.RowHeaderCell>
                <Table.Cell>{merchantUser.email}</Table.Cell>
              </Table.Row>
            ))
          ) : (
            <Table.Row>
              <Table.Cell colSpan={3}>No merchants users found</Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>

    </Flex>
    </Flex>
  );
}