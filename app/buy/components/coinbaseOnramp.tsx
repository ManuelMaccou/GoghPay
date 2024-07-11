import { useEffect, useRef, useState, useCallback } from 'react';
import { initOnRamp, CBPayInstanceType } from '@coinbase/cbpay-js';
import Image from "next/image";
import styles from '../styles.module.css';
import { Button, Reset } from '@radix-ui/themes';
import { useRouter } from 'next/navigation';

type InitOnRampOptions = Parameters<typeof initOnRamp>[0];

type CoinbaseButtonProps = {
  destinationWalletAddress: string;
  price: number;
  redirectURL: string;
};

type BuyWithCoinbaseButtonProps = {
  onPress: () => void;
  isLoading: boolean;
};

export function BuyWithCoinbaseButton({ onPress, isLoading }: BuyWithCoinbaseButtonProps) {
  return (
    <Reset>
      <Button variant='ghost' loading={isLoading} className={styles.cbButton} onClick={onPress}>
        <Image
          src={`/buttons/button-cbPay-normal-continue.png`}
          alt={"coinbase pay button"}
          width={200}
          height={40}
          style={{
            maxWidth: "100%",
            height: "auto"
          }}
        />
      </Button>
    </Reset>
  );
}

export function CoinbaseButton({ destinationWalletAddress, price, redirectURL }: CoinbaseButtonProps) {
  const [isReady, setIsReady] = useState(false);
  const [onrampInstance, setOnrampInstance] = useState<CBPayInstanceType | null>(null);
  const router = useRouter();
  
  const onrampAmount = price === 0 ? 0 : price + 1;
  const onrampInstanceRef = useRef<CBPayInstanceType | null>(null);

  const initOnRampCallback = useCallback(() => {
    const options: InitOnRampOptions = {
      appId: process.env.NEXT_PUBLIC_COINBASE_APP_ID!,
      widgetParameters: {
        addresses: { [destinationWalletAddress]: ['base'] },
        assets: ['USDC'],
        presetCryptoAmount: onrampAmount,
        defaultNetwork: 'base',
        defaultExperience: 'buy',
      },
      onSuccess: () => {
        router.replace(redirectURL);
      },
      experienceLoggedIn: 'new_tab',
    };

    initOnRamp(options, (error, instance) => {
      if (instance) {
        onrampInstanceRef.current = instance;
        setOnrampInstance(instance);
        setIsReady(true);
      }
      if (error) {
        console.error('Error initializing Coinbase Onramp:', error);
      }
    });

    return () => {
      onrampInstanceRef.current?.destroy();
    };
  }, [destinationWalletAddress, onrampAmount, redirectURL, router]);

  useEffect(() => {
    initOnRampCallback();
  }, [initOnRampCallback]);

  const handleOnPress = () => {
    onrampInstance?.open();
  };

  return (
    <BuyWithCoinbaseButton onPress={handleOnPress} isLoading={!isReady} />
  );
}
