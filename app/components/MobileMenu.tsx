
import React, { useState, ReactNode } from 'react';
import { Button, Text, DropdownMenu, Flex, IconButton, VisuallyHidden, TextField } from '@radix-ui/themes';
import * as Dialog from '@radix-ui/react-dialog';

interface MobileMenuProps {
  walletForPurchase?: string | null;
  children: ReactNode;
}

export default function MobileMenu({ children }: MobileMenuProps) {

  return (
      <>

    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button>Menu</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>Menu</Dialog.Title>
          <Dialog.Description>
            Menu
          </Dialog.Description>
          <Text>Test text</Text>
          {children}
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close asChild>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <Button>Save</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>







        

     
    </>
  );
}