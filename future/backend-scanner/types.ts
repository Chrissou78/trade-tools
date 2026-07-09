// scanner/types.ts
export interface DetectedLaunch {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  tokenAddress: string;
  deployer: string;
  wethAddress: string;
  poolAddress?: string;
  feeTier?: number;
}
