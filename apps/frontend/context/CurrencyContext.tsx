'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type CurrencyType = 'usd' | 'eur' | 'ngn' | 'kes' | 'ghs' | 'zar';

interface CurrencyContextProps {
  currency: CurrencyType;
  setCurrency: (currency: CurrencyType) => void;
  showFiat: boolean;
  setShowFiat: (show: boolean) => void;
}

const CurrencyContext = createContext<CurrencyContextProps | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrencyState] = useState<CurrencyType>('usd');
  const [showFiat, setShowFiatState] = useState<boolean>(false);
  const [isClient, setIsClient] = useState(false);

  // Load from local storage
  useEffect(() => {
    setIsClient(true);
    const storedCurrency = localStorage.getItem('preferredCurrency') as CurrencyType;
    if (storedCurrency) {
      setCurrencyState(storedCurrency);
    }
    const storedShowFiat = localStorage.getItem('showFiat');
    if (storedShowFiat !== null) {
      setShowFiatState(storedShowFiat === 'true');
    }
  }, []);

  const setCurrency = (curr: CurrencyType) => {
    setCurrencyState(curr);
    localStorage.setItem('preferredCurrency', curr);
  };

  const setShowFiat = (show: boolean) => {
    setShowFiatState(show);
    localStorage.setItem('showFiat', String(show));
  };

  if (!isClient) return null; // Avoid hydration mismatch

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, showFiat, setShowFiat }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
