'use client';

import { useMerchant } from "../contexts/MerchantContext";
import { usePrivy } from "@privy-io/react-auth";
import { Button, Flex, Heading, Link, Spinner, Text } from "@radix-ui/themes";
import { useEffect } from "react";
import React from "react";

export default function OnboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ready, authenticated } = usePrivy();
  const { merchant, isFetchingMerchant } = useMerchant();

  useEffect(() => {
    console.log('merchant:', merchant)
  }, [merchant]);

  return (
    <Flex
      direction={{ initial: "column", sm: "row" }}
      position="relative"
      minHeight="100vh"
      width="100%"
      style={{
        background: "linear-gradient(to bottom, #45484d 0%,#000000 100%)",
      }}
    >
      <Flex
        direction="row"
        justify="center"
        align="center"
        px="4"
        width={{ initial: "100%", sm: "30%" }}
        height={{ initial: "120px", sm: "100vh" }}
        style={{ textAlign: 'center' }}
      >
        <Heading size="8" align={"center"} style={{ color: "white" }}>
          Welcome to Gogh
        </Heading>
      </Flex>
      <Flex
        direction={"column"}
        justify={"center"}
        align={"center"}
        px={"4"}
        flexGrow={"1"}
        style={{
          background: "white",
        }}
      >
        {ready && authenticated ? (

          isFetchingMerchant ? (
            <Spinner />
          ) : merchant ? (
            children
          ) : (
            <Flex direction="column" align="center" gap={'4'}>
            <Heading>Welcome to Gogh!</Heading>
            <Text>
              To join the Gogh family of small businesses, please reach out. We
              would love to hear from you.
            </Text>
            <Button asChild>
              <Link
                href="mailto:hello@ongogh.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Contact Us
              </Link>
            </Button>
          </Flex>
          )
        ) : ready && !authenticated ? (
          <Flex direction="column" align="center" gap={'4'}>
              <Heading>Welcome to Gogh!</Heading>
              <Text>
                To continue, please log in.
              </Text>
              <Button asChild>
                <Link href="/">Log in</Link>
              </Button>
            </Flex>
        ) : <Spinner /> }
      </Flex>
    </Flex>
  );
}
