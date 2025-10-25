import { JsonRpcProvider, Contract, Wallet } from 'ethers';
import { BotState, markProcessed, wasProcessed, writeState } from './state.js';
import { LogEvent } from './scanner.js';
import { submitPongTx, replacePongTx } from './tx.js';
import { checkTxStatus } from './pending.js';
import { config } from './config.js';
import { logger } from './logger.js';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForPendingTx(
  provider: JsonRpcProvider,
  contract: Contract,
  wallet: Wallet,
  state: BotState
): Promise<BotState> {
  if (!state.pendingTx) return state;

  const p = state.pendingTx;

  while (true) {
    const { status, receipt } = await checkTxStatus(provider, p.txHash, p.sentAtBlock);

    if (status === 'confirmed') {
      if (receipt && receipt.status === 1) {
        markProcessed(state, p.pingKey);
        logger.info(
          {
            txHash: p.txHash,
            blockNumber: receipt.blockNumber,
            pingKey: p.pingKey
          },
          'Pong confirmed'
        );
      } else {
        logger.warn({ txHash: p.txHash, pingKey: p.pingKey }, 'Pong reverted, marking as handled');
        markProcessed(state, p.pingKey);
      }

      state.pendingTx = undefined;
      return state;
    }

    if (status === 'stuck') {
      if (p.replacements >= config.maxReplacementsPerTx) {
        logger.error(
          {
            txHash: p.txHash,
            pingKey: p.pingKey,
            replacements: p.replacements
          },
          'Max replacements reached, abandoning transaction'
        );
        markProcessed(state, p.pingKey);
        state.pendingTx = undefined;
        return state;
      }

      let tx;
      try {
        tx = await replacePongTx(
          contract,
          wallet,
          p.pongArg,
          p.nonce,
          BigInt(p.maxFeePerGas),
          BigInt(p.maxPriorityFeePerGas)
        );
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.includes('already known')) {
          logger.warn({ err: msg, txHash: p.txHash, nonce: p.nonce }, 'Replacement broadcast already known; will keep waiting');
          await sleep(2000);
          continue;
        }
        if (msg.includes('nonce has already been used') || msg.includes('nonce too low')) {
          try {
            const latestNonce = await wallet.getNonce('latest');
            if (latestNonce > p.nonce) {
              markProcessed(state, p.pingKey);
              logger.info({ nonce: p.nonce, latestNonce }, 'Pending nonce already used; assuming pong mined');
              state.pendingTx = undefined;
              return state;
            }
          } catch (e: any) {
            logger.warn({ err: e?.message || String(e) }, 'Failed to check latest nonce after NONCE_EXPIRED');
          }
        }
        logger.warn({ err: msg, nonce: p.nonce }, 'Replacement broadcast failed; will retry on next check');
        await sleep(2000);
        continue;
      }

      const currentBlock = await provider.getBlockNumber();

      state.pendingTx = {
        nonce: p.nonce,
        txHash: tx.hash,
        pingKey: p.pingKey,
        sentAtBlock: currentBlock,
        maxFeePerGas: tx.maxFeePerGas!.toString(),
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas!.toString(),
        replacements: p.replacements + 1,
        pongArg: p.pongArg
      };

      await writeState(state);
    }

    await sleep(2000);
  }
}

export async function handlePing(
  provider: JsonRpcProvider,
  contract: Contract,
  wallet: Wallet,
  state: BotState,
  log: LogEvent
): Promise<BotState> {
  const key = `${log.blockHash}:${log.logIndex}`;

  if (wasProcessed(state, key)) {
    return state;
  }

  const isAfterCursor =
    log.blockNumber > state.lastProcessedBlock ||
    (log.blockNumber === state.lastProcessedBlock && log.logIndex > state.lastProcessedLogIndex);

  if (!isAfterCursor) {
    return state;
  }

  logger.info(
    {
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
      txHash: log.transactionHash
    },
    'Processing Ping event'
  );

  if (state.pendingTx) {
    state = await waitForPendingTx(provider, contract, wallet, state);
    if (wasProcessed(state, key)) {
      return state;
    }
  }

  const nonce = await wallet.getNonce('pending');
  const tx = await submitPongTx(contract, wallet, log.transactionHash, nonce);

  const currentBlock = await provider.getBlockNumber();

  state.pendingTx = {
    nonce,
    txHash: tx.hash,
    pingKey: key,
    sentAtBlock: currentBlock,
    maxFeePerGas: tx.maxFeePerGas!.toString(),
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas!.toString(),
    replacements: 0,
    pongArg: log.transactionHash
  };

  await writeState(state);

  state = await waitForPendingTx(provider, contract, wallet, state);

  state.lastProcessedBlock = log.blockNumber;
  state.lastProcessedLogIndex = log.logIndex;

  return state;
}
