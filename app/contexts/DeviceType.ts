import { useEffect, useState } from 'react';

export const useDeviceType = () => {
  const [deviceType, setDeviceType] = useState<'iPhone' | 'Android' | 'Unknown'>('Unknown');

  useEffect(() => {
    const userAgent = navigator.userAgent;

    if (/android/i.test(userAgent)) {
      setDeviceType('Android');
    } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
      setDeviceType('iPhone');
    } else {
      setDeviceType('Unknown');
    }
  }, []);

  return deviceType;
};
