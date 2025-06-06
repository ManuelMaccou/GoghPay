"use client"

import React, { useCallback, useEffect, useState } from 'react';
import { ConnectedWallet, useLogout, usePrivy } from "@privy-io/react-auth";
import { useUser } from '../contexts/UserContext';
import { useBalance } from '../contexts/BalanceContext';
import { Box, Card, Flex, Text, Badge, Button, Spinner, Dialog, IconButton, Separator, VisuallyHidden, Link, SegmentedControl } from '@radix-ui/themes';
import { AvatarIcon, Cross2Icon, HamburgerMenuIcon } from '@radix-ui/react-icons';
import { MerchantTier, User } from '../types/types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightFromBracket, faEnvelope, faGear, faFile, faMoneyBillTransfer, faPlus, faSackDollar, faPiggyBank, faGlobe, faSliders } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation'
import styles from './styles.module.css'
import { useMerchant } from '../contexts/MerchantContext';

interface HeaderProps {
  color?: string | null;
  merchant: boolean | undefined;
  embeddedWallet: ConnectedWallet | null;
  authenticated: boolean;
  currentUser?: User | null;
  walletForPurchase?: string | null;
}

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export const Header: React.FC<HeaderProps> = ({ color, embeddedWallet, authenticated, currentUser, walletForPurchase }) => {
  const { user, ready } = usePrivy();
  const { appUser } = useUser();
  const { merchant } = useMerchant();
  const { balance, isBalanceLoading } = useBalance();
  const router = useRouter();
  const pathname = usePathname()

  const [menuState, setMenuState] = useState<'sales' | 'rewards'>('sales');

  const { logout } = useLogout ({
    onSuccess: async () => {
      router.push('/');
    }
  })

  const navigateTo = (path: string) => {
    if (pathname === path) {
      router.replace(path);
    } else {
      router.push(path);
    }
  };

  const handleSetMenuState = useCallback((value: 'sales' | 'rewards') => {
    setMenuState(value);
  }, []);

  useEffect(() => {
    console.log(menuState);
  }, [menuState]);

  return (
    <Box maxWidth={'100%'}>
      <Flex direction={'row'} justify={'end'}>
        {ready && authenticated && (
          <>
            <Dialog.Root>
              <Dialog.Trigger style={{zIndex: '10'}}>
                <IconButton variant='ghost' style={{ marginLeft: 'auto' }}>
                  <HamburgerMenuIcon width={'35px'} height={'35px'} style={{color: 'white'}} />
                </IconButton>
              </Dialog.Trigger>
              <Dialog.Content className={styles.content}>
                <VisuallyHidden>
                  <Dialog.Title>Menu</Dialog.Title>
                </VisuallyHidden>
                <VisuallyHidden>
                  <Dialog.Description>
                    Menu
                  </Dialog.Description>
                </VisuallyHidden>
                <Flex direction={'row'} justify={'between'} flexGrow={'1'}>
                  {embeddedWallet && authenticated ? (
                    <Card variant="ghost" mb={'3'}>
                      <Flex direction={'column'} gap={'3'}>
                        <Flex direction={'row'} gap="3" align="center" justify={'end'}>
                          <AvatarIcon />
                          <Box>
                            <Text as="div" size="2" color="gray">
                              {appUser?.name || user?.email?.address || user?.google?.name}
                            </Text>
                          </Box>
                        </Flex>
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
                              <VisuallyHidden>
                                <Dialog.Title>
                                  Show address
                                </Dialog.Title>
                              </VisuallyHidden>
                              <VisuallyHidden>
                                <Dialog.Description>
                                  Show address
                                </Dialog.Description>
                              </VisuallyHidden>
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
                {currentUser?.merchant ? (
                  <Flex direction={'column'} my={'9'}>

                    {merchant?.tier === MerchantTier.paid && (
                      <Flex direction={'column'} mb={'5'}>
                        <SegmentedControl.Root 
                          value={menuState}
                          radius="full"
                          onValueChange={(value) => handleSetMenuState(value as 'sales' | 'rewards')}
                        >
                          <SegmentedControl.Item value="sales">Sales</SegmentedControl.Item>
                          <SegmentedControl.Item value="rewards">Rewards</SegmentedControl.Item>
                        </SegmentedControl.Root>
                      </Flex>
                    )}
                    
                    {menuState === 'sales' ? (
                      <>
                        <Flex direction={'column'} align={'start'}>
                          <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                            <FontAwesomeIcon style={{padding: '20px'}} icon={faPlus} />
                            <Dialog.Close>
                              <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => navigateTo(`/sell`)}>New Sale</Button>
                            </Dialog.Close>
                          </Flex>
                          <Separator size={'4'} />
                          <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                            <FontAwesomeIcon style={{padding: '20px'}} icon={faSackDollar} />
                            <Dialog.Close>
                              <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => navigateTo(`/account/sales`)}>Sales</Button>
                            </Dialog.Close>
                          </Flex>
                          <Separator size={'4'} />
                          <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                            <FontAwesomeIcon style={{padding: '20px'}} icon={faFile} />
                            <Dialog.Close>
                              <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => navigateTo(`/account/taxes`)}>Taxes</Button>
                            </Dialog.Close>
                          </Flex>
                          <Separator size={'4'} />
                          <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                            <FontAwesomeIcon style={{padding: '20px'}} icon={faGear} />
                            <Dialog.Close>
                              <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => navigateTo(`/account/integrations`)}>Integrations</Button>
                            </Dialog.Close>
                          </Flex>
                          <Separator size={'4'} />
                          <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                            <a href="mailto:support@ongogh.com" style={{ width: '100%', display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                              <FontAwesomeIcon style={{ padding: '20px' }} icon={faEnvelope} />
                              <Dialog.Close>
                                <Button variant='ghost' size={'4'} style={{ color: 'black', width: '100%', justifyContent: 'start' }}>Contact us</Button>
                              </Dialog.Close>
                            </a>
                          </Flex>
                        </Flex>
                      </>
                    ) : menuState === 'rewards' && (
                      <>
                        <Flex direction={'column'} align={'start'}>
                          <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                            <FontAwesomeIcon style={{padding: '20px'}} icon={faSliders} />
                            <Dialog.Close>
                              <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => navigateTo(`/rewards/manage`)}>Manage rewards</Button>
                            </Dialog.Close>
                          </Flex>
                          <Separator size={'4'} />
                          <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                            <FontAwesomeIcon style={{padding: '20px'}} icon={faGear} />
                            <Dialog.Close>
                              <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => navigateTo(`/account/integrations`)}>Integrations</Button>
                            </Dialog.Close>
                          </Flex>
                          <Separator size={'4'} />
                          <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                            <a href="mailto:support@ongogh.com" style={{ width: '100%', display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                              <FontAwesomeIcon style={{ padding: '20px' }} icon={faEnvelope} />
                              <Dialog.Close>
                                <Button variant='ghost' size={'4'} style={{ color: 'black', width: '100%', justifyContent: 'start' }}>Contact us</Button>
                              </Dialog.Close>
                            </a>
                          </Flex>
                        </Flex>
                      </>
                    )}
                  </Flex>
                ) : (
                  <>
                  <Flex direction={'column'} my={'7'}>
                    <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                      <FontAwesomeIcon style={{padding: '20px'}} icon={faArrowRightFromBracket} />
                      <Dialog.Close>
                        <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => navigateTo(`/account/purchases`)}>Purchases</Button>
                      </Dialog.Close>
                    </Flex>
                    <Separator size={'4'} />
                    <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                      <FontAwesomeIcon style={{padding: '20px'}} icon={faPiggyBank} />
                      <Dialog.Close>
                        <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => navigateTo(`/myrewards`)}>My rewards</Button>
                      </Dialog.Close>
                    </Flex>
                    <Separator size={'4'} />
                    <Flex direction={'row'} align={'center'} justify={'start'} width={'60vw'}>
                      <FontAwesomeIcon style={{padding: '20px'}} icon={faEnvelope} />
                      <Link style={{color: 'black'}}  href='mailto:support@ongogh.com' target='_blank' rel='noopener noreferrer'>
                        Contact us
                      </Link>
                    </Flex>
                  </Flex>
                 
                </>
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