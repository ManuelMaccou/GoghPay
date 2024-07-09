"use client"

import React, { useState } from 'react';
import { ConnectedWallet, usePrivy } from "@privy-io/react-auth";
import { useBalance } from '../contexts/BalanceContext';
import { Box, Card, Flex, Text, Badge, Button, Spinner, Dialog, IconButton, Separator, VisuallyHidden, Link } from '@radix-ui/themes';
import { AvatarIcon, Cross2Icon, HamburgerMenuIcon } from '@radix-ui/react-icons';
import Login from './Login';
import { User } from '../types/types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightFromBracket, faEnvelope, faMoneyBillTransfer, faPlus, faSackDollar } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';
import styles from './styles.module.css'




interface HeaderProps {
  embeddedWallet: ConnectedWallet | null;
  authenticated: boolean;
  currentUser?: User;
  walletForPurchase?: string | null;
}

export const Header: React.FC<HeaderProps> = ({ embeddedWallet, authenticated, currentUser, walletForPurchase }) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  const { user, ready, login, logout} = usePrivy();
  const { balance, isBalanceLoading } = useBalance();

  const router = useRouter();

  return (
    <Box width={'100%'}>
      <Flex justify={'between'} direction={'row'} pb={'4'}>
        {authenticated ? (
          <>
            {!isBalanceLoading ? (
              <Badge size={'3'}>Balance: ${balance}</Badge>
            ) : (
              <Badge size={'3'}>
                Balance: 
                <Spinner />
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
                            <Button variant='ghost' size={'4'} style={{color: 'black', width: '100%', justifyContent: 'start'}} onClick={() => router.push(`mailto:support@ongogh.com`)}>Contact us</Button>
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
                      <Login />
                    </Dialog.Close>
                  </Flex>
              </Dialog.Content>
            </Dialog.Root>
          </>
        ) : (
          <Login />
        )}
      </Flex>
    </Box>
  );
};