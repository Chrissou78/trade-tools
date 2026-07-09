// lib/chains/robinhood.ts
export const ROBINHOOD_CHAIN = {
  chainId: "0x1237", // 4663 in hex
  chainName: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
  blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
};

export const ADDRESSES = {
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  swapRouter02: "0xcaf681a66d020601342297493863e78c959e5cb2",
  quoterV2: "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7",
  factory: "0x1f7d7550b1b028f7571e69a784071f0205fd2efa",
};

export async function ensureRobinhoodChain(provider: any) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ROBINHOOD_CHAIN.chainId }],
    });
  } catch (err: any) {
    if (err.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [ROBINHOOD_CHAIN],
      });
    } else {
      throw err;
    }
  }
}
