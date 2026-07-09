// lib/rules/evaluator.ts
import { EntryConditions, SellTrigger, Position } from "./types";

export interface EntryEvaluation {
  shouldEnter: boolean;
  reason: string;
}

// Runs once per detected launch, against the pool state right after
// detection (which reflects the dev/first buyer's buy, per what we
// confirmed earlier — the raw floor state is gone by the time you see it).
export function evaluateEntry(
  conditions: EntryConditions,
  currentMcUsd: number,
  liquidityL: number
): EntryEvaluation {
  if (!conditions.enabled) {
    return { shouldEnter: false, reason: "Scanner entry rules disabled." };
  }
  if (currentMcUsd > conditions.maxMarketCapAfterFirstBuyUsd) {
    return {
      shouldEnter: false,
      reason: `MC after first buy ($${currentMcUsd.toFixed(0)}) exceeds risk cap ($${conditions.maxMarketCapAfterFirstBuyUsd}).`,
    };
  }
  if (liquidityL < conditions.minLiquidity) {
    return {
      shouldEnter: false,
      reason: `Liquidity (${liquidityL.toFixed(0)}) below minimum threshold — possible thin/trap LP.`,
    };
  }
  return { shouldEnter: true, reason: "All entry conditions met." };
}

export interface SellEvaluation {
  shouldSell: boolean;
  triggerId?: string;
  exitPercentage?: number;
  reason?: string;
}

export function evaluateSellTriggers(position: Position, currentMcUsd: number): SellEvaluation {
  const peakMc = Math.max(position.peakMcUsd, currentMcUsd);

  for (const trigger of position.sellTriggers) {
    switch (trigger.type) {
      case "take_profit_mc_multiple": {
        const multiple = currentMcUsd / position.entryMcUsd;
        if (multiple >= trigger.value) {
          return {
            shouldSell: true,
            triggerId: trigger.id,
            exitPercentage: trigger.exitPercentage,
            reason: `Take-profit: ${multiple.toFixed(2)}x entry MC — selling ${trigger.exitPercentage}%.`,
          };
        }
        break;
      }
      case "stop_loss_mc_drop_pct": {
        const dropPct = ((position.entryMcUsd - currentMcUsd) / position.entryMcUsd) * 100;
        if (dropPct >= trigger.value) {
          return { shouldSell: true, triggerId: trigger.id, exitPercentage: trigger.exitPercentage, reason: `Stop-loss: down ${dropPct.toFixed(1)}%.` };
        }
        break;
      }
      case "trailing_stop_pct": {
        const dropFromPeak = ((peakMc - currentMcUsd) / peakMc) * 100;
        if (dropFromPeak >= trigger.value) {
          return { shouldSell: true, triggerId: trigger.id, exitPercentage: trigger.exitPercentage, reason: `Trailing stop: down ${dropFromPeak.toFixed(1)}% from peak.` };
        }
        break;
      }
      case "graduation_reached": {
        if (currentMcUsd >= trigger.value) {
          return { shouldSell: true, triggerId: trigger.id, exitPercentage: trigger.exitPercentage, reason: "Graduation reached." };
        }
        break;
      }
    }
  }

  return { shouldSell: false };
}
