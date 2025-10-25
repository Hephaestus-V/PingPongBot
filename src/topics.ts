import { keccak256, toUtf8Bytes } from 'ethers';

export const PING_TOPIC = keccak256(toUtf8Bytes('Ping()'));

