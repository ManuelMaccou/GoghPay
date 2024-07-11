import '@radix-ui/themes/styles.css';
import { Theme, ThemePanel } from '@radix-ui/themes'
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import UserProvider from './providers/userProvider';
import { BalanceProvider } from './contexts/BalanceContext';
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';

config.autoAddCss = false; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gogh Pay",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <BalanceProvider>
          <UserProvider>
            <Theme accentColor="indigo" grayColor="slate" radius="medium" scaling="100%" appearance='light' panelBackground='translucent'>
              {children}
              
            </Theme>
          </UserProvider>
        </BalanceProvider>
      </body>
    </html>
  );
}
