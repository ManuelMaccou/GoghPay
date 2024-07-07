// components/Header.tsx
import React, { useState, useEffect } from 'react';
import { AvatarIcon } from '@radix-ui/react-icons';
import { Badge, Box, Button, Card, Flex, Heading, Spinner, Text } from '@radix-ui/themes';

interface HeaderProps {
  authenticated: boolean;
  embeddedWallet?: boolean;
  user?: {
    email?: { address?: string };
    google?: { name?: string };
  };
  walletForPurchase?: string;
  logout: () => void;
}

const Header = ({
  authenticated,
  embeddedWallet,
  user,
  walletForPurchase,
  logout
}: HeaderProps) => {
  const [balance, setBalance] = useState<number>(0);
  const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!walletForPurchase || !authenticated) {
        return;
      }
      setIsBalanceLoading(true);
      try {
        const response = await fetch(`/api/crypto/get-usdc-balance?address=${walletForPurchase}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error('Failed to fetch balance');
        }
        setBalance(data.balance);
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
      setIsBalanceLoading(false);
    };

    fetchBalance();
  }, [walletForPurchase, authenticated]);

  return (
    <Box width={'100%'}>
      {embeddedWallet && authenticated ? (
        <Card variant="ghost" mb={'3'}>
          <Flex gap="3" align="center" justify={'end'}>
            <AvatarIcon />
            <Text as="div" size="2" color="gray">{user?.email?.address || user?.google?.name}</Text>
          </Flex>
        </Card>
      ) : (
        !embeddedWallet && authenticated && (
          <Card variant="ghost" mb={'3'}>
            <Flex gap="3" align="center" justify={'end'}>
              <AvatarIcon />
              <Text as="div" size="2" color="gray">{walletForPurchase?.slice(0, 6)}</Text>
            </Flex>
          </Card>
        )
      )}
      <Flex justify={'between'} direction={'row'} pb={'9'}>
        {authenticated && (
          <>
            {!isBalanceLoading ? (
              <Badge size={'3'}>Balance: ${balance}</Badge>
            ) : (
              <Badge size={'3'}>
                Balance: 
                <Spinner />
              </Badge>
            )}
            <Button variant='outline' onClick={logout}>
              Log out
            </Button>
          </>
        )}
      </Flex>
      <Heading size={'7'} align={'center'}>Confirm details</Heading>
    </Box>
  );
};

export default Header;
