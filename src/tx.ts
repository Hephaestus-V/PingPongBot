import { Contract, Wallet, TransactionResponse, JsonRpcProvider } from 'ethers';
import { computeFees } from './fees.js';
import { logger } from './logger.js';

export async function submitPongTx(
  contract: Contract,
  wallet: Wallet,
  pingTxHash: string,
  nonce: number
): Promise<TransactionResponse> {
  const provider = wallet.provider;
  if (!provider || !(provider instanceof JsonRpcProvider)) {
    throw new Error('Wallet has no JsonRpcProvider');
  }

  const { maxFeePerGas, maxPriorityFeePerGas } = await computeFees(provider);

  const tx = await contract.pong(pingTxHash, {
    nonce,
    maxFeePerGas,
    maxPriorityFeePerGas
  });

  logger.info(
    {
      txHash: tx.hash,
      nonce,
      pingTxHash,
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString()
    },
    'Submitted pong transaction'
  );

  return tx;
}

export async function replacePongTx(
  contract: Contract,
  wallet: Wallet,
  pingTxHash: string,
  nonce: number,
  priorMaxFee: bigint,
  priorMaxPrio: bigint
): Promise<TransactionResponse> {
  const provider = wallet.provider;
  if (!provider || !(provider instanceof JsonRpcProvider)) {
    throw new Error('Wallet has no JsonRpcProvider');
  }

  const { maxFeePerGas, maxPriorityFeePerGas } = await computeFees(provider, {
    maxFee: priorMaxFee,
    maxPrio: priorMaxPrio
  });

  const tx = await contract.pong(pingTxHash, {
    nonce,
    maxFeePerGas,
    maxPriorityFeePerGas
  });

  logger.warn(
    {
      oldNonce: nonce,
      newTxHash: tx.hash,
      pingTxHash,
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString()
    },
    'Replaced stuck transaction'
  );

  return tx;
}

