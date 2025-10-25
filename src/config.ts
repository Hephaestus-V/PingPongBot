import 'dotenv/config';

export interface Config {
  rpcUrl: string;
  privateKey: string;
  contractAddress: string;
  startBlock: number;
  confirmations: number;
  batchSize: number;
  sleepMs: number;
  dataDir: string;
  stuckBlocks: number;
  priorityFeeGwei: string;
  maxReplacementsPerTx: number;
  recentSetSize: number;
}

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string): number {
  const value = getEnv(key);
  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return num;
}

function getEnvWithDefault(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvNumberWithDefault(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return num;
}

export const config: Config = {
  rpcUrl: getEnv('RPC_URL'),
  privateKey: getEnv('PRIVATE_KEY'),
  contractAddress: getEnvWithDefault(
    'CONTRACT_ADDRESS',
    '0xa7f42ff7433cb268dd7d59be62b00c30ded28d3d'
  ).toLowerCase(),
  startBlock: getEnvNumber('START_BLOCK'),
  confirmations: getEnvNumberWithDefault('CONFIRMATIONS', 3),
  batchSize: getEnvNumberWithDefault('BATCH_SIZE', 2000),
  sleepMs: getEnvNumberWithDefault('SLEEP_MS', 5000),
  dataDir: getEnvWithDefault('DATA_DIR', './data'),
  stuckBlocks: getEnvNumberWithDefault('STUCK_BLOCKS', 12),
  priorityFeeGwei: getEnvWithDefault('PRIORITY_FEE_GWEI', '2.0'),
  maxReplacementsPerTx: getEnvNumberWithDefault('MAX_REPLACEMENTS_PER_TX', 6),
  recentSetSize: getEnvNumberWithDefault('RECENT_SET_SIZE', 5000),
};
