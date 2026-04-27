# Dispute Resolver (GenLayer + Next.js)

A production-ready decentralized app for submitting disputes, receiving AI-generated verdicts on GenLayer, and tracking dispute history from a connected wallet.

## Live project links

- **Live app:** https://dispute-resolver-genlayer.vercel.app
- **Demo video:** https://youtube.com/shorts/Q1v8xL8kEds?si=R3YWM9rNtN-xtQaJ
- **Studio contract link:** https://studio.genlayer.com/?import-contract=0xF38D2ED80643F8d8B47973F2789ef04F7259b86e

## What this app does

This app lets users:

1. Connect a MetaMask wallet.
2. Switch to the GenLayer Studio network (chain `61999`).
3. Submit a dispute with:
   - a **claim**
   - supporting **evidence**
4. Wait for transaction states:
   - **submitted**
   - **ACCEPTED**
   - **FINALIZED**
5. Read disputes from the contract:
   - latest dispute
   - dispute by ID
   - all disputes owned by the connected wallet

---

## End-to-end architecture

### 1) Frontend (Next.js / React)

The UI in `app/page.tsx` includes:

- wallet connection + network status
- submit dispute form
- transaction status stepper
- latest dispute + dispute lookup by ID
- per-wallet dashboard

Wallet/network state is managed in `app/wallet-provider.tsx`.

### 2) GenLayer JS integration (`lib/genlayer.ts`)

This app uses the official `genlayer-js` SDK:

- `readContract(...)` for view methods
- `writeContract(...)` for `submit_dispute`
- `waitForTransactionReceipt(...)` for ACCEPTED/FINALIZED tracking

It also centralizes network constants, contract address, and dispute payload normalization.

### 3) Smart contract (`contracts/ai_dispute_resolver-genlayer.py`)

The contract:

- validates claim/evidence (required, max 800 chars)
- uses GenLayer AI prompt execution to generate verdict + reason
- stores disputes and owner mapping onchain
- provides read methods for latest dispute, by ID, and per-user dispute lists

---

## Contract + network details

- **RPC:** `https://studio.genlayer.com/api`
- **Chain ID:** `61999`
- **Network:** GenLayer Studio
- **Contract address:** `0xF38D2ED80643F8d8B47973F2789ef04F7259b86e`

### Integrated contract methods

- `submit_dispute(claim: str, evidence: str)`
- `get_dispute(dispute_id: u64)`
- `get_latest_dispute()`
- `get_my_disputes(user: str)`
- `get_my_dispute_ids(user: str)`

---

## Local development

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Open: `http://localhost:3000`

### Validate

```bash
npm run lint
npm run typecheck
npm run build
```

---

## Assets

Brand assets are stored under `public/assets/`.

- `public/assets/genlayer/`
- `public/assets/logos/`
- `public/assets/images/`
- `public/assets/og/`
