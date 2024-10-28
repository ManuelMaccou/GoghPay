'use client';

import { Flex, Heading } from "@radix-ui/themes";
import React from "react";

export default function OnboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {

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
        {children}
      </Flex>
    </Flex>
  );
}