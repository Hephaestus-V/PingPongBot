import { readFile, writeFile, rename } from 'fs/promises';
import { resolve } from 'path';
import { config } from './config.js';

export interface PendingTx {
  nonce: number;
  txHash: string;
  pingKey: string;
  sentAtBlock: number;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  replacements: number;
  pongArg: string;
}

export interface BotState {
  startBlock: number;
  lastProcessedBlock: number;
  lastProcessedLogIndex: number;
  recentProcessedKeys: string[];
  pendingTx?: PendingTx;
}

const statePath = resolve(config.dataDir, 'state.json');

export async function readState(): Promise<BotState> {
  try {
    const raw = await readFile(statePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      startBlock: config.startBlock,
      lastProcessedBlock: config.startBlock - 1,
      lastProcessedLogIndex: -1,
      recentProcessedKeys: []
    };
  }
}

export async function writeState(state: BotState): Promise<void> {
  const tmp = statePath + '.tmp';
  await writeFile(tmp, JSON.stringify(state, null, 2));
  await rename(tmp, statePath);
}

export function wasProcessed(state: BotState, key: string): boolean {
  return state.recentProcessedKeys.includes(key);
}

export function markProcessed(state: BotState, key: string): void {
  const arr = state.recentProcessedKeys;
  if (arr[arr.length - 1] === key) return;
  
  const idx = arr.indexOf(key);
  if (idx >= 0) arr.splice(idx, 1);
  
  arr.push(key);
  
  if (arr.length > config.recentSetSize) {
    arr.splice(0, arr.length - config.recentSetSize);
  }
}

