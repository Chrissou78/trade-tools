// lib/wallets/metamaskProvider.ts
interface EIP6963ProviderDetail {
  info: { uuid: string; name: string; rdns: string };
  provider: any;
}

export async function getMetaMaskProvider(timeoutMs = 300): Promise<any> {
  const found: EIP6963ProviderDetail[] = [];
  const handler = (event: any) => found.push(event.detail);

  window.addEventListener("eip6963:announceProvider", handler as any);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  await new Promise((r) => setTimeout(r, timeoutMs));
  window.removeEventListener("eip6963:announceProvider", handler as any);

  const metamask = found.find((p) => p.info.rdns === "io.metamask");
  if (metamask) return metamask.provider;

  // Fallback for wallets that still use the older multi-provider array.
  const eth = (window as any).ethereum;
  if (eth?.providers?.length) {
    const legacyMatch = eth.providers.find((p: any) => p.isMetaMask);
    if (legacyMatch) return legacyMatch;
  }
  if (eth?.isMetaMask) return eth;

  throw new Error("MetaMask not found — if Core Wallet or another extension is installed, this picks MetaMask specifically via EIP-6963.");
}
