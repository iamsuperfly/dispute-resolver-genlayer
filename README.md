# GenLayer Dispute Resolver Frontend (Next.js + official GenLayerJS SDK)

Production-ready frontend that talks directly to the deployed GenLayer dispute resolver contract with real wallet interactions (MetaMask), no mocks.

## Contract + network

- **RPC:** `https://studio.genlayer.com/api`
- **Chain ID:** `61999`
- **Contract:** `0xF38D2ED80643F8d8B47973F2789ef04F7259b86e`
- **Contract link:** https://studio.genlayer.com/?import-contract=0xF38D2ED80643F8d8B47973F2789ef04F7259b86e

Integrated methods:
- `submit_dispute(claim: str, evidence: str)` (write)
- `get_my_disputes(user: str)` (view)
- `get_my_dispute_ids(user: str)` (view)
- `get_latest_dispute()` (view)
- `get_dispute(dispute_id: u64)` (view)

## Features implemented

- MetaMask connect/disconnect flow via `wagmi` injected connector.
- Wrong-network detection + one-click switch to GenLayer chain.
- Submit dispute form:
  - claim + evidence inputs
  - max 800 chars each
  - client-side validation
  - transaction lifecycle feedback (pending hash / confirmation / errors)
- Resolution display through dispute lookup (`get_dispute`).
- Latest dispute panel (`get_latest_dispute`).
- Personal dashboard (`get_my_disputes` + `get_my_dispute_ids`) that loads connected account context on demand.
- Robust loading, empty, and error states across reads/writes.

## SDK integration note

This frontend uses the official `genlayer-js` SDK for contract interaction:
- `readContract` for read-only methods (`eth_call`)
- `writeContract` for state-changing methods (`eth_sendTransaction`)
- `waitForTransactionReceipt` for ACCEPTED/FINALIZED status tracking

The app keeps lightweight response normalization for the dispute UI model, but no longer relies on custom raw RPC JSON parsing hacks.

## Local run

### 1) Install dependencies

```bash
npm install
```

### 2) Start local development

```bash
npm run dev
```

Then open `http://localhost:3000`.

### 3) Production build validation

```bash
npm run lint
npm run typecheck
npm run build
```

## Environment/config requirements

This app currently requires **no environment variables** for default operation because RPC, chain ID, and contract address are committed in `lib/genlayer.ts`.

If you want to parameterize for multiple environments later, you can move those constants to `NEXT_PUBLIC_...` vars.

## How to verify real integration

1. Open the app in a browser with MetaMask installed.
2. Connect wallet and switch to chain `61999` when prompted.
3. Submit a dispute with valid claim/evidence.
4. Confirm tx hash appears and then confirmation status.
5. Verify returned disputes through:
   - **Latest Dispute** panel
   - **Resolution Lookup** by ID
   - **My Dashboard** (must reflect connected account only)
6. Cross-check results in GenLayer Studio using the contract link above.

## Deploy on Vercel

1. Import this repository in Vercel.
2. Framework preset: **Next.js**.
3. Build command: `npm run build`.
4. Output: default Next.js output.
5. No mandatory env vars required for current defaults.

## Assets

Brand assets are expected under `public/assets/`.

- `public/assets/genlayer/`
- `public/assets/logos/`
- `public/assets/images/`
- `public/assets/og/`
