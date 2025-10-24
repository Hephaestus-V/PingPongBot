# PingPong Bot

Ethereum bot that monitors Ping events and responds with pong transactions.

## Setup

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

- `RPC_URL` - Sepolia RPC endpoint
- `PRIVATE_KEY` - Bot wallet private key
- `START_BLOCK` - Block number to start monitoring from

## Usage

```bash
npm run build
npm start
```

## Development

```bash
npm run dev
```