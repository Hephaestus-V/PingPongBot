import { JsonRpcProvider, TransactionReceipt } from 'ethers';
import { config } from './config.js';

export type TxStatus = 'confirmed' | 'pending' | 'stuck';

export interface TxCheckResult {
  status: TxStatus;
  receipt?: TransactionReceipt;
}

export async function checkTxStatus(
  provider: JsonRpcProvider,
  txHash: string,
  sentAtBlock: number
): Promise<TxCheckResult> {
  const receipt = await provider.getTransactionReceipt(txHash);

  if (receipt && receipt.status !== null) {
    return { status: 'confirmed', receipt };
  }

  const currentBlock = await provider.getBlockNumber();
  const blocksWaiting = currentBlock - sentAtBlock;

  if (blocksWaiting >= config.stuckBlocks) {
    return { status: 'stuck' };
  }

  return { status: 'pending' };
}

