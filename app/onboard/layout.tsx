// If gmail, set "type" param to "google". Dont include "email" param.
// If other, set "type" param to "email". Include "email" param with their address.

'use client';

import { useMerchant } from "../contexts/MerchantContext";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { Button, Flex, Heading, Link, Spinner, Text } from "@radix-ui/themes";
import axios from "axios";
import { useEffect, useState } from "react";
import React from "react";
import { useUser } from "../contexts/UserContext";
import { useSearchParams } from "next/navigation";
import { ContactMethod } from "../types/types";

export default function OnboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ready, authenticated } = usePrivy();
  const { merchant, isFetchingMerchant } = useMerchant();
  const { appUser, setAppUser } = useUser();

  const [defaultEmail, setDefaultEmail] = useState<string>('');
  const [defaultLoginMethod, setDefaultLoginMethod] = useState<LoginMethod>('google');


  const searchParams = useSearchParams();

  type LoginMethod = "google" | "sms" | "email" | "farcaster" | "discord" | "twitter" | "github" | "spotify" | "instagram" | "tiktok" | "linkedin" | "apple" | "telegram" | "wallet";


  function isValidLoginMethod(method: string): method is LoginMethod {
    return [
      "google", "sms", "email", "farcaster", "discord", "twitter", "github",
      "spotify", "instagram", "tiktok", "linkedin", "apple", "telegram", "wallet"
    ].includes(method);
  }

  useEffect(() => {
    console.log('merchant:', merchant)
    console.log('default email:', defaultEmail)
    console.log('default login method:', defaultLoginMethod)
  }, [merchant, defaultEmail, defaultLoginMethod]);

  
  useEffect(() => {
    const emailParam = searchParams.get('email');
    const emailTypeParam = searchParams.get('type');

    if (emailParam) {
      setDefaultEmail(emailParam);
    }

    if (emailTypeParam && isValidLoginMethod(emailTypeParam)) {
      setDefaultLoginMethod(emailTypeParam as LoginMethod);
    }
  }, [searchParams]);

  const { login } = useLogin({
    onError: (error) => {
        console.error("Privy login error:", error);
    },
  });

  console.log('appUser:', appUser);

  const handleLogin = () => {
    login({
      prefill: {type: 'email', value: defaultEmail},
      loginMethods: [defaultLoginMethod],
      disableSignup: true 
    });
  };

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
              <Button onClick={handleLogin}>
                Log In
              </Button>
            </Flex>
        ) : <Spinner /> }
      </Flex>
    </Flex>
  );
}
