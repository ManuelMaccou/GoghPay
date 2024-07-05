import React from 'react';
import { Box, Text } from "@radix-ui/themes";
import { css } from '@stitches/react';

interface NotificationMessageProps {
  message: string;
  type: 'pending' | 'error' | 'success';
}

const notificationBoxStyles = css({
  padding: '16px',
  borderRadius: '8px',
  margin: '16px 0',
  textAlign: 'center',
  variants: {
    type: {
      pending: {
        backgroundColor: 'rgba(29, 132, 226, 0.1)',
        border: '1px solid #1D84E2',
        color: '#1D84E2',
      },
      error: {
        backgroundColor: 'rgba(255, 0, 0, 0.1)',
        border: '1px solid red',
        color: 'red',
      },
      success: {
        backgroundColor: 'rgba(0, 255, 0, 0.1)',
        border: '1px solid green',
        color: 'green',
      },
    },
  },
});

const NotificationMessage: React.FC<NotificationMessageProps> = ({ message, type }) => {
  return (
    <Box className={notificationBoxStyles({ type })}>
      <Text size="5">{message}</Text>
    </Box>
  );
};

export default NotificationMessage;
