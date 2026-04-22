import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { type Address, type Hex } from "viem";

export const GENLAYER_CHAIN = {
  id: 61999,
  name: "GenLayer Studio",
  rpcUrl: "https://studio.genlayer.com/api",
  currency: {
    name: "GEN",
    symbol: "GEN",
    decimals: 18
  }
} as const;

export const CONTRACT_ADDRESS = "0xF38D2ED80643F8d8B47973F2789ef04F7259b86e" as Address;

export type Dispute = {
  id: bigint;
  submitter: string;
  claim: string;
  evidence: string;
  verdict: string;
  reason: string;
};

export type TxStatus = "idle" | "submitted" | "accepted" | "finalized" | "failed";

type TxConsensusStatus = "ACCEPTED" | "FINALIZED";

function normalizeBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && value.trim()) {
    try {
      return BigInt(value.trim());
    } catch {
      return 0n;
    }
  }
  return 0n;
}

function toDispute(value: unknown): Dispute {
  if (typeof value !== "object" || value === null) {
    throw new Error("Unexpected dispute payload from contract.");
  }

  const payload = value as Record<string, unknown>;

  return {
    id: normalizeBigInt(payload.id),
    submitter: typeof payload.submitter === "string" ? payload.submitter : "",
    claim: typeof payload.claim === "string" ? payload.claim : "",
    evidence: typeof payload.evidence === "string" ? payload.evidence : "",
    verdict: typeof payload.verdict === "string" ? payload.verdict : "",
    reason: typeof payload.reason === "string" ? payload.reason : ""
  };
}

function createGenLayerClient(account?: Address) {
  return createClient({
    chain: studionet,
    endpoint: GENLAYER_CHAIN.rpcUrl,
    ...(account ? { account } : {})
  });
}

export class GenlayerClient {
  async getLatestDispute(): Promise<Dispute | null> {
    const result = await createGenLayerClient().readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_latest_dispute",
      args: []
    });

    if (!result || (typeof result === "object" && !Array.isArray(result) && Object.keys(result as Record<string, unknown>).length === 0)) {
      return null;
    }

    return toDispute(result);
  }

  async getDispute(id: bigint): Promise<Dispute | null> {
    const result = await createGenLayerClient().readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_dispute",
      args: [id]
    });

    if (!result) return null;
    return toDispute(result);
  }

  async getMyDisputes(address: Address): Promise<Dispute[]> {
    const result = await createGenLayerClient(address).readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_my_disputes",
      args: [address]
    });

    if (!Array.isArray(result)) return [];
    return result.map((item) => toDispute(item));
  }

  async getMyDisputeIds(address: Address): Promise<bigint[]> {
    const result = await createGenLayerClient(address).readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_my_dispute_ids",
      args: [address]
    });

    if (!Array.isArray(result)) return [];
    return result.map(normalizeBigInt);
  }

  async submitDispute(_ethereum: EthereumProvider, from: Address, claim: string, evidence: string): Promise<Hex> {
    const txHash = await createGenLayerClient(from).writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "submit_dispute",
      args: [claim, evidence],
      value: 0n
    });

    return txHash as Hex;
  }

  async waitForTransaction(hash: Hex, status: TxConsensusStatus) {
    return createGenLayerClient().waitForTransactionReceipt({
      hash,
      status,
      retries: 60,
      interval: 2000
    });
  }
}

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: "accountsChanged" | "chainChanged", handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: "accountsChanged" | "chainChanged", handler: (...args: unknown[]) => void) => void;
};

export function formatError(error: unknown, fallback: string): string {
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message: string }).message);
  }
  return fallback;
}

export const genlayerClient = new GenlayerClient();
