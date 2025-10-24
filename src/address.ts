import { Wallet } from 'ethers';
import { config } from './config.js';

const wallet = new Wallet(config.privateKey);
console.log('Bot address:', wallet.address);

