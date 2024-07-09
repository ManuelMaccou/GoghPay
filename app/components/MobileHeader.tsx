import React from 'react';
import { ConnectedWallet, getEmbeddedConnectedWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { Box, Card, Flex, Text, Badge, Button, Spinner } from '@radix-ui/themes';
import { AvatarIcon } from '@radix-ui/react-icons';

interface MobileHeaderProps {
  walletForPurchase?: string | null;
}


export const MobileHeader: React.FC<MobileHeaderProps> = ({ walletForPurchase }) => {
  const {user, authenticated, ready} = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);

  return (
    <Box width={'100%'}>
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
      </Box>
  );
};
