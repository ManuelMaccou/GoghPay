import * as Dialog from '@radix-ui/react-dialog';
import React, { useState, ReactNode } from 'react';
import styles from './styles.module.css'
import { Button, Flex, VisuallyHidden } from '@radix-ui/themes';

interface MobileMenuProps {
  children: ReactNode;  // This type includes anything that can be rendered: numbers, strings, elements or an array (or fragment) containing these types.
}

export default function MobileMenu({ children }: MobileMenuProps) {
  return (
      <Dialog.Root>
          <Dialog.Trigger asChild>
              <Button className={styles.menuTrigger}>Menu</Button>
          </Dialog.Trigger>
          <Dialog.Portal>
              <Dialog.Overlay className={styles.dialogOverlay} />
              <Dialog.Content className={`${styles.dialogContent} ${styles.openDialogContent}`}>
                <VisuallyHidden asChild>
                  <Dialog.Title>Menu</Dialog.Title>
                  </VisuallyHidden> 
                  <VisuallyHidden asChild>
                  <Dialog.Description>Menu</Dialog.Description>
                  </VisuallyHidden>
                  {children}
                  <Dialog.Close asChild>
                    <Flex direction={'column'} align={'end'} justify={'center'} height={'50px'}>
                      <Button size={'4'} variant='ghost'>Close</Button>
                    </Flex>
                  </Dialog.Close>
              </Dialog.Content>
          </Dialog.Portal>
      </Dialog.Root>
  );
}