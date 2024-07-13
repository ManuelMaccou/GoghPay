"use client"

import React, { useState } from 'react';
import { ConnectedWallet, getEmbeddedConnectedWallet, useLogin, useLogout, usePrivy, useWallets } from "@privy-io/react-auth";
import { useBalance } from '../contexts/BalanceContext';
import { Box, Card, Flex, Text, Badge, Button, Spinner, Dialog, IconButton, Separator, VisuallyHidden, Link } from '@radix-ui/themes';
import { AvatarIcon, Cross2Icon, HamburgerMenuIcon } from '@radix-ui/react-icons';
import { User } from '../types/types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightFromBracket, faEnvelope, faMoneyBillTransfer, faPlus, faSackDollar } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';
import styles from './styles.module.css'
import { Chain, createPublicClient, createWalletClient, custom, encodeFunctionData, http, parseAbiItem } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { ENTRYPOINT_ADDRESS_V07, walletClientToSmartAccountSigner } from 'permissionless';
import { createPimlicoBundlerClient } from 'permissionless/clients/pimlico';
import { pimlicoPaymasterActions } from 'permissionless/actions/pimlico';
import { signerToSafeSmartAccount } from 'permissionless/accounts';
import axios from 'axios';
import { createSmartAccount } from '../utils/createSmartAccount';




interface HeaderProps {
  merchant: boolean | undefined;
  embeddedWallet: ConnectedWallet | null;
  authenticated: boolean;
  currentUser?: User;
  walletForPurchase?: string | null;
}

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export const Header: React.FC<HeaderProps> = ({ merchant, embeddedWallet, authenticated, currentUser, walletForPurchase }) => {
  const { user, ready } = usePrivy();
  const { balance, isBalanceLoading } = useBalance();
  const {wallets} = useWallets();
  const router = useRouter();

  const wallet = wallets[0];
  const chainId = wallet?.chainId;
  const chainIdNum = process.env.NEXT_PUBLIC_DEFAULT_CHAINID ? Number(process.env.NEXT_PUBLIC_DEFAULT_CHAINID) : null;

  const { logout } = useLogout ({
    onSuccess: async () => {
      router.push('/');
    }
  })
  
  const { login } = useLogin({
    onComplete: async (user, isNewUser) => {
      console.log('login successful');
      console.log("embedded wallet object before function:", embeddedWallet);

      let smartAccountAddress;

      if (isNewUser) {
        if (embeddedWallet) {
          smartAccountAddress = await createSmartAccount(embeddedWallet);
        };
        
        try {
          console.log('smart account address during login:', smartAccountAddress);
          const userPayload = {
            privyId: user.id,
            walletAddress: user.wallet?.address,
            email: user.email?.address || user.google?.email,
            creationType: 'privy',
            smartAccountAddress: smartAccountAddress,
          };

          const response = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user`, userPayload);
          console.log('New user created:', response.data);
        } catch (error: unknown) {
          if (axios.isAxiosError(error)) {
              console.error('Error fetching user details:', error.response?.data?.message || error.message);
          } else if (isError(error)) {
              console.error('Unexpected error:', error.message);
          } else {
              console.error('Unknown error:', error);
          }
        }
      }

      if (chainIdNum !== null && chainId !== `eip155:${chainIdNum}`) {
        try {
          await wallet.switchChain(chainIdNum);
        } catch (error: unknown) {
          console.error('Error switching chain:', error);
      
          if (typeof error === 'object' && error !== null && 'code' in error) {
            const errorCode = (error as { code: number }).code;
            if (errorCode === 4001) {
              alert('You need to switch networks to proceed.');
            } else {
              alert('Failed to switch the network. Please try again.');
            }
          } else {
            console.log('An unexpected error occurred.');
          }
          return;
        }
      };
    },
    onError: (error) => {
        console.error("Privy login error:", error);
    },
  });

  return (
    <Box width={'100%'}>
      <Flex justify={'between'} direction={'row'} pb={'4'}>
        {authenticated ? (
          <>
          {!merchant ? (
            !isBalanceLoading ? (
              <Badge size={'3'}>USDC Balance: ${balance}</Badge>
            ) : (
              <Badge size={'3'}>
                USDC balance: 
                <Spinner />
              </Badge>
            )
          ) : (
            <Badge size={'3'}>
              <Link href='https://www.coinbase.com/assets' target='_blank' rel='noopener noreferrer'>
                View balance on Coinbase
              </Link>
            </Badge>
          )}
    
            <Dialog.Root>
              <Dialog.Trigger>
                <IconButton variant='ghost'>
                  <HamburgerMenuIcon width={'35px'} height={'35px'} style={{color: 'black'}} />
                </IconButton>
              </Dialog.Trigger>
              <Dialog.Content className={styles.content}>
                
                  <VisuallyHidden>
                    <Dialog.Title>Menu</Dialog.Title>
                  </VisuallyHidden>
                  <Flex direction={'row'} justify={'between'} flexGrow={'1'}>
                    {embeddedWallet && authenticated ? (
                      <Card variant="ghost" mb={'3'}>
                        <Flex gap="3" align="center" justify={'end'}>
                          <AvatarIcon />
                          <Box>
                            <Text as="div" size="2" color="gray">
                              {user?.email?.address || user?.google?.name}
                            </Text>
                          </Box>
                        </Flex>
                      </Card>
                    ) : (
                      !embeddedWallet && authenticated && (
                        <Card variant="ghost" mb={'3'}>
                          <Flex gap="3" align="center" justify={'end'}>
                            <AvatarIcon />
                            <Box>
                              <Text as="div" size="2" color="gray">
                                {walletForPurchase?.slice(0, 6)}
                              </Text>
                            </Box>
                          </Flex>
                        </Card>
                      )
                    )}
                    <Dialog.Close>
                      <IconButton variant='ghost'>
                        <Cross2Icon width={'35px'} height={'35px'} style={{color: 'black'}} />
                      </IconButton>
                    </Dialog.Close>
                  </Flex>
                <VisuallyHidden>
                  <Dialog.Description>
                    Mobile menu
                  </Dialog.Description>
                </VisuallyHidden>
                
                {ready && authenticated && (
                  <Flex direction={'column'} my={'9'}>
                    {currentUser?.merchant ? (
                      <>
                        <Flex direction={'column'} align={'start'}>
                          <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                            <FontAwesomeIcon style={{padding: '20px'}} icon={faPlus} />
                            <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => router.push(`/sell`)}>New Sale</Button>
                          </Flex>
                          <Separator size={'4'} />
                          <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                            <FontAwesomeIcon style={{padding: '20px'}} icon={faSackDollar} />
                            <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => router.push(`/account/sales`)}>Sales</Button>
                          </Flex>
                          <Separator size={'4'} />
                          <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                            <FontAwesomeIcon style={{padding: '20px'}} icon={faMoneyBillTransfer} />
                            <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => router.push(`/account/transfers`)}>Transfer funds</Button>
                          </Flex>
                          <Separator size={'4'} />
                          <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                            <a href="mailto:support@ongogh.com" style={{ width: '100%', display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                              <FontAwesomeIcon style={{ padding: '20px' }} icon={faEnvelope} />
                              <Button variant='ghost' size={'4'} style={{ color: 'black', width: '100%', justifyContent: 'start' }}>Contact us</Button>
                            </a>
                          </Flex>
                        </Flex>
                      </>
                    ) : (
                      <>
                        <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                          <FontAwesomeIcon style={{padding: '20px'}} icon={faArrowRightFromBracket} />
                          <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => router.push(`/account/purchases`)}>Purchases</Button>
                        </Flex>
                        <Separator size={'4'} />
                        <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                          <FontAwesomeIcon style={{padding: '20px'}} icon={faMoneyBillTransfer} />
                          <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => router.push(`/account/transfers`)}>Transfer funds</Button>
                        </Flex>
                        <Separator size={'4'} />
                        <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                          <FontAwesomeIcon style={{padding: '20px'}} icon={faEnvelope} />
                          <Link style={{color: 'black'}}  href='mailto:support@ongogh.com' target='_blank' rel='noopener noreferrer'>
                            Contact us
                          </Link>
                        </Flex>
                      </>
                    )}
                  </Flex>
                  )}
                  <Flex direction={'column'} justify={'between'} align={'center'}>
                    <Dialog.Close>
                      <Flex direction={'column'} justify={'center'} mx={'4'} style={{width: '100%'}}>
                        <Button variant='outline' onClick={logout}>
                          Log out
                        </Button>
                      </Flex>
                    </Dialog.Close>
                  </Flex>
              </Dialog.Content>
            </Dialog.Root>
          </>
        ) : (
          <Flex direction={'column'} justify={'center'} align={'end'} mx={'4'} style={{width: '100%'}}>
            <Button size={'3'} variant='outline' onClick={login}>
              Log in
            </Button>
          </Flex>
        )}
      </Flex>
  </Box>
  );
};