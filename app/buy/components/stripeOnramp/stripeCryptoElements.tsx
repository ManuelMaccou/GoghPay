import React, { ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { CryptoElementsContextType } from '@/app/types/types';

const CryptoElementsContext = React.createContext<CryptoElementsContextType | null>(null);

export const CryptoElements = ({
  stripeOnramp,
  children,
}: {
  stripeOnramp: Promise<any>;
  children: ReactNode;
}) => {
  const [ctx, setContext] = useState<CryptoElementsContextType>({ onramp: null });

  useEffect(() => {
    let isMounted = true;

    Promise.resolve(stripeOnramp).then((onramp) => {
      if (onramp && isMounted) {
        setContext((ctx) => (ctx.onramp ? ctx : { onramp }));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [stripeOnramp]);

  return (
    <CryptoElementsContext.Provider value={ctx}>
      {children}
    </CryptoElementsContext.Provider>
  );
};

export const useStripeOnramp = () => {
  const context = useContext(CryptoElementsContext);
  return context?.onramp;
};

export const OnrampElement = ({
  clientSecret,
  appearance,
  ...props
}: {
  clientSecret: string;
  appearance?: object;
}) => {
  const stripeOnramp = useStripeOnramp();
  const onrampElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const containerRef = onrampElementRef.current;
    if (containerRef) {
      containerRef.innerHTML = '';

      if (clientSecret && stripeOnramp) {
        stripeOnramp
          .createSession({
            clientSecret,
            appearance,
          })
          .mount(containerRef);
      }
    }
  }, [clientSecret, appearance, stripeOnramp]);

  return <div {...props} ref={onrampElementRef}></div>;
};
