import { JsonRpcProvider, Block, parseUnits } from 'ethers';
import { config } from './config.js';

export interface FeeData {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

interface PriorFees {
  maxFee: bigint;
  maxPrio: bigint;
}

function bumpByPercent(value: bigint, percent: number): bigint {
  const multiplier = BigInt(Math.round((100 + percent) * 1000));
  return (value * multiplier) / BigInt(100_000);
}

export async function computeFees(
  provider: JsonRpcProvider,
  prior?: PriorFees
): Promise<FeeData> {
  const block: Block | null = await provider.getBlock('latest');
  const baseFee = block?.baseFeePerGas ?? parseUnits('1', 'gwei');
  
  let maxPriorityFeePerGas = parseUnits(config.priorityFeeGwei.toString(), 'gwei');
  let maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;
  
  if (prior) {
    const minFee = bumpByPercent(prior.maxFee, 12);
    const minPrio = bumpByPercent(prior.maxPrio, 12);
    
    if (maxFeePerGas < minFee) maxFeePerGas = minFee;
    if (maxPriorityFeePerGas < minPrio) maxPriorityFeePerGas = minPrio;
  }
  
  return { maxFeePerGas, maxPriorityFeePerGas };
}

