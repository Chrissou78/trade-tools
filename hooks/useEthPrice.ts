// hooks/useEthPrice.ts
"use client";
import { useEffect, useState } from "react";

export function useEthPrice(pollMs = 30_000): number | null {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    const fetchPrice = async () => {
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
        const data = await res.json();
        if (active) setPrice(data.ethereum.usd);
      } catch (err) {
        console.error("Failed to fetch ETH price:", err);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, pollMs);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [pollMs]);

  return price;
}
