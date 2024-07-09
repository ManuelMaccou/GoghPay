import { AlertDialog, Button, Flex } from '@radix-ui/themes';
import React, { useEffect, useState } from 'react';
import Login from './Login';


interface NoWalletForPurchaseErrorProps {
  condition: boolean;
}

const NoWalletForPurchaseError: React.FC<NoWalletForPurchaseErrorProps> = ({ condition }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (condition) {
      setOpen(true);
    }
  }, [condition]);

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger>
        <button style={{ display: 'none' }}>Trigger</button>
      </AlertDialog.Trigger>
      <AlertDialog.Content>
        <AlertDialog.Title>Error</AlertDialog.Title>
        <AlertDialog.Description>
          There was an error when fetching account details.
          Please log out and try again.
        </AlertDialog.Description>

        <Flex gap="3" mt="4" justify="center">
          <AlertDialog.Action>
            <Login />
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
};

export default NoWalletForPurchaseError;
