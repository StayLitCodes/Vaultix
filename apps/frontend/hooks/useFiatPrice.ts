import { useState, useEffect } from 'react';

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd,eur,ngn,kes,ghs,zar';

// Cache in memory
let cache: { data: any; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 1000; // 60 seconds

export const useFiatPrice = () => {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
          setPrices(cache.data);
          setLoading(false);
          return;
        }

        const res = await fetch(COINGECKO_URL);
        if (!res.ok) {
          throw new Error('Rate limit or error');
        }
        const data = await res.json();
        const priceData = data.stellar || {};
        
        cache = { data: priceData, timestamp: Date.now() };
        setPrices(priceData);
      } catch (err) {
        console.error('Error fetching fiat prices:', err);
        // Fallback to 0 if rate limited or error
        if (cache) {
          setPrices(cache.data); // Use stale cache if available
        } else {
          setPrices({ usd: 0, eur: 0, ngn: 0, kes: 0, ghs: 0, zar: 0 });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
  }, []);

  return { prices, loading };
};
