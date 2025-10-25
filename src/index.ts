import { mkdir } from 'fs/promises';
import { logger } from './logger.js';
import { config } from './config.js';
import { readState, writeState, BotState } from './state.js';
import { createProvider, createWallet, createContract } from './provider.js';
import { getLogs, sortLogs } from './scanner.js';
import { handlePing, waitForPendingTx } from './handler.js';

function mask(value: string, visible = 4): string {
  if (value.length <= visible * 2) return `${value.slice(0, 1)}…`;
  return `${value.slice(0, visible)}...${value.slice(-visible)}`;
}

async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  await ensureDir(config.dataDir);

  const provider = createProvider();
  const wallet = createWallet(provider);
  const contract = createContract(wallet);
  let state = await readState();

  logger.info(
    {
      dataDir: config.dataDir,
      privateKey: mask(config.privateKey),
      contractAddress: config.contractAddress,
      startBlock: state.startBlock,
      lastProcessedBlock: state.lastProcessedBlock,
      confirmations: config.confirmations,
      sleepMs: config.sleepMs,
      address: wallet.address,
    },
    'PingPong Bot starting'
  );

  try {
    const [block, network] = await Promise.all([
      provider.getBlockNumber(),
      provider.getNetwork(),
    ]);
    logger.info({ block, chainId: network.chainId, name: network.name }, 'Connected to RPC');
  } catch (err) {
    logger.warn({ err }, 'RPC connectivity failed at startup; will retry in scan loop');
  }

  if (state.pendingTx) {
    logger.info({ pendingTx: state.pendingTx }, 'Resuming pending transaction');
    state = await waitForPendingTx(provider, contract, wallet, state);
    await writeState(state);
  }

  let stopping = false;

  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'Shutting down gracefully');
    setTimeout(async () => {
      await writeState(state);
      process.exit(0);
    }, 500);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  while (!stopping) {
    try {
      state = await scanOnce(provider, contract, wallet, state);
      await writeState(state);
    } catch (err: any) {
      logger.error({ error: err?.message || String(err) }, 'Scan iteration failed');
    }
    await sleep(config.sleepMs);
  }
}

async function scanOnce(
  provider: ReturnType<typeof createProvider>,
  contract: ReturnType<typeof createContract>,
  wallet: ReturnType<typeof createWallet>,
  state: BotState
): Promise<BotState> {
  const latestBlock = await provider.getBlockNumber();
  const toBlock = Math.max(state.startBlock, latestBlock - config.confirmations);
  const fromBlock = Math.max(state.lastProcessedBlock + 1, state.startBlock);

  if (fromBlock > toBlock) {
    logger.debug({ fromBlock, toBlock, latestBlock }, 'No new blocks to scan');
    return state;
  }

  const batchEnd = Math.min(fromBlock + config.batchSize - 1, toBlock);

  logger.info({ fromBlock, toBlock: batchEnd, latestBlock }, 'Scanning batch');

  const logs = await getLogs(provider, fromBlock, batchEnd);
  sortLogs(logs);

  for (const log of logs) {
    if (log.address !== config.contractAddress) continue;

    state = await handlePing(provider, contract, wallet, state, log);
    await writeState(state);
  }

  if (logs.length === 0) {
    state.lastProcessedBlock = batchEnd;
    state.lastProcessedLogIndex = -1;
  }

  logger.info({ processedUpTo: state.lastProcessedBlock }, 'Batch complete');

  return state;
}

void main();

