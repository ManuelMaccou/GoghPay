"use client"

import React from 'react';
import { ConnectedWallet, useLogout, usePrivy } from "@privy-io/react-auth";
import { useBalance } from '../contexts/BalanceContext';
import { Box, Card, Flex, Text, Badge, Button, Spinner, Dialog, IconButton, Separator, VisuallyHidden, Link } from '@radix-ui/themes';
import { AvatarIcon, Cross2Icon, HamburgerMenuIcon } from '@radix-ui/react-icons';
import { User } from '../types/types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightFromBracket, faEnvelope, faGear, faFile, faMoneyBillTransfer, faPlus, faSackDollar } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';
import styles from './styles.module.css'

//


interface HeaderProps {
  merchant: boolean | undefined;
  embeddedWallet: ConnectedWallet | null;
  authenticated: boolean;
  currentUser?: User;
  walletForPurchase?: string | null;
  setCurrentUser: (user: User) => void;
  setWalletForPurchase: (wallet: string | null) => void;
}

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export const Header: React.FC<HeaderProps> = ({ merchant, embeddedWallet, authenticated, currentUser, walletForPurchase, setCurrentUser, setWalletForPurchase }) => {
  const { user, ready } = usePrivy();
  const { balance, isBalanceLoading } = useBalance();
  const router = useRouter();

  const { logout } = useLogout ({
    onSuccess: async () => {
      router.push('/');
    }
  })

  return (
    <Box width={'100%'}>
      <Flex justify={'between'} direction={'row'} pb={'4'}>
        {authenticated && (
          <>
          {!merchant ? (
            !isBalanceLoading ? (
              <Badge size={'3'}>USDC Balance: ${balance.toFixed(2)}</Badge>
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
                        <Flex direction={'column'} gap={'3'}>
                          <Flex direction={'row'} gap="3" align="center" justify={'end'}>
                            <AvatarIcon />
                            <Box>
                              <Text as="div" size="2" color="gray">
                                {user?.email?.address || user?.google?.name}
                              </Text>
                            </Box>
                          </Flex>
                          <Dialog.Root>
                              <Dialog.Trigger>
                                <Button variant="ghost">Show address</Button>
                              </Dialog.Trigger>
                              <Dialog.Content size={'3'} maxWidth={'300px'}>
                                <Text as="p" trim="both" size="1">
                                  {currentUser?.smartAccountAddress}
                                </Text>
                              </Dialog.Content>
                            </Dialog.Root>
                        </Flex>
                      </Card>
                    ) : (
                      !embeddedWallet && authenticated && (
                        <Card variant="ghost" mb={'3'}>
                          <Flex direction={'column'} gap={'3'}>
                            <Flex direction={'row'} gap="3" align="center" justify={'end'}>
                              <AvatarIcon />
                              <Box>
                                <Text as="div" size="2" color="gray">
                                  {walletForPurchase?.slice(0, 6)}
                                </Text>
                              </Box>
                            </Flex>
                            <Dialog.Root>
                              <Dialog.Trigger>
                                <Button variant="ghost">Show address</Button>
                              </Dialog.Trigger>
                              <Dialog.Content size={'3'} maxWidth={'300px'}>
                                <Text as="p" trim="both" size="1">
                                  {walletForPurchase}
                                </Text>
                              </Dialog.Content>
                            </Dialog.Root>
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
                            <FontAwesomeIcon style={{padding: '20px'}} icon={faFile} />
                            <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => router.push(`/account/taxes`)}>Taxes</Button>
                          </Flex>
                          <Separator size={'4'} />
                          <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                            <FontAwesomeIcon style={{padding: '20px'}} icon={faMoneyBillTransfer} />
                            <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => router.push(`/account/transfer`)}>Transfer funds</Button>
                          </Flex>
                          <Separator size={'4'} />
                          <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                            <FontAwesomeIcon style={{padding: '20px'}} icon={faGear} />
                            <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => router.push(`/account/integrations`)}>Integrations</Button>
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
                          <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => router.push(`/account/transfer`)}>Transfer funds</Button>
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
        )}
      </Flex>
  </Box>
  );
};