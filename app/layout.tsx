import '@radix-ui/themes/styles.css';
import { Theme, ThemePanel } from '@radix-ui/themes'
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PrivyUserProvider from './providers/PrivyUserProvider';
import { UserProvider } from './contexts/UserContext';
import { BalanceProvider } from './contexts/BalanceContext';
import { MerchantProvider } from './contexts/MerchantContext';
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
        <PrivyUserProvider>
          <UserProvider>
            <BalanceProvider>
              <MerchantProvider>
                <Theme accentColor="indigo" grayColor="slate" radius="medium" scaling="100%" appearance='light' panelBackground='translucent'>
                  {children}
                </Theme>
              </MerchantProvider>
            </BalanceProvider>
          </UserProvider>
        </PrivyUserProvider>
      </body>
    </html>
  );
}
