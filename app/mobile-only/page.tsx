"use client"

import { Flex, Text } from '@radix-ui/themes';
import React, { useEffect, useState } from 'react';


export default function MobileOnly() {

  return (
    <Text size={'5'}>
      Thanks for checking out Gogh Pay! This app only works on mobile. Please open this page on a mobile device.
    </Text>
  );
};
