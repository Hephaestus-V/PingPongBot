import { JsonRpcProvider } from 'ethers';
import { logger } from './logger.js';
import { config } from './config.js';
import { PING_TOPIC } from './topics.js';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface LogEvent {
  address: string;
  blockHash: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  topics: readonly string[];
  data: string;
}

export async function getLogs(
  provider: JsonRpcProvider,
  fromBlock: number,
  toBlock: number
): Promise<LogEvent[]> {
  const filter = {
    address: config.contractAddress,
    topics: [PING_TOPIC],
    fromBlock,
    toBlock
  };

  let attempt = 0;
  const maxAttempts = 10;

  while (attempt < maxAttempts) {
    try {
      const logs = await provider.getLogs(filter);
      return logs.map(log => ({
        address: log.address.toLowerCase(),
        blockHash: log.blockHash,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.index,
        topics: log.topics,
        data: log.data
      }));
    } catch (err: any) {
      attempt++;
      const waitTime = Math.min(15000, 1000 * Math.pow(2, attempt)) + Math.floor(Math.random() * 500);
      
      logger.warn(
        {
          fromBlock,
          toBlock,
          attempt,
          maxAttempts,
          error: err?.message || String(err)
        },
        'getLogs failed, retrying'
      );
      
      if (attempt >= maxAttempts) {
        throw new Error(`getLogs failed after ${maxAttempts} attempts: ${err?.message}`);
      }
      
      await sleep(waitTime);
    }
  }

  return [];
}

export function sortLogs(logs: LogEvent[]): void {
  logs.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) {
      return a.blockNumber - b.blockNumber;
    }
    return a.logIndex - b.logIndex;
  });
}

