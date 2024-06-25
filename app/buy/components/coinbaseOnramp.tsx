import { useEffect, useRef, useState } from 'react';
import { initOnRamp } from '@coinbase/cbpay-js';
import Image from "next/image"
import styles from '../styles.module.css'
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
                }} />
        </Button>
        </Reset>
    );
}

export function CoinbaseButton({ destinationWalletAddress, price, redirectURL }: CoinbaseButtonProps) {
   const [isReady, setIsReady] = useState(false);
   const onrampInstance = useRef<any>();
   const router = useRouter();

   useEffect(() => {
    const options: InitOnRampOptions = {
        appId: process.env.NEXT_PUBLIC_COINBASE_APP_ID!,
        // target: '#cbpay-container',
        widgetParameters: {
            destinationWallets: [{
               address: destinationWalletAddress,
               assets: ['USDC'],
               supportedNetworks: ['base']
            }],
            presetCryptoAmount: price,
            defaultNetwork: 'base',
            defaultExperience: 'buy',
        },
        onSuccess: () => {
            console.log('success');
            console.log('redirectURL in child component:', redirectURL)
            router.push(redirectURL); // Change this to router.refresh when tested
        },
        onExit: () => {
            console.log('exit');
        },
        onEvent: (event) => {
            console.log('event', event);
        },
        experienceLoggedIn: 'popup',
        // experienceLoggedOut: 'popup',
        closeOnExit: false,
        closeOnSuccess: false,

    };
    // instance.destroy() should be called before initOnramp if there is already an instance.
    if (onrampInstance.current) {
        onrampInstance.current.destroy();
     }

     initOnRamp(options, (error, instance) => {
        if (instance) {
            onrampInstance.current = instance;
            setIsReady(true);
        }
        if (error) {
            console.error('Error initializing Coinbase Onramp:', error);
        }
     });
 }, [destinationWalletAddress, price, redirectURL, router])
 
 const handleOnPress = () => {
     onrampInstance.current.open();
 }


 return (
     <BuyWithCoinbaseButton onPress={handleOnPress} isLoading={!isReady} />
 );
}