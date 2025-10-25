import { JsonRpcProvider, Wallet, Contract } from 'ethers';
import { config } from './config.js';

const ABI = [
  'event Ping()',
  'function pong(bytes32 _txHash)'
];

export function createProvider(): JsonRpcProvider {
  return new JsonRpcProvider(config.rpcUrl);
}

export function createWallet(provider: JsonRpcProvider): Wallet {
  return new Wallet(config.privateKey, provider);
}

export function createContract(wallet: Wallet): Contract {
  return new Contract(config.contractAddress, ABI, wallet);
}

