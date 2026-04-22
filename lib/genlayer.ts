import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import type { Abi } from "viem";
import { decodeAbiParameters, defineChain, encodeFunctionData, hexToString } from "viem";
import type { PublicClient } from "viem";

export const genlayerChain = defineChain({
  id: 61999,
  name: "GenLayer Studio",
  nativeCurrency: {
    name: "GEN",
    symbol: "GEN",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ["https://studio.genlayer.com/api"]
    }
  }
});

export const CONTRACT_ADDRESS = "0xF38D2ED80643F8d8B47973F2789ef04F7259b86e" as const;

export const disputeResolverWriteAbi = [
  {
    type: "function",
    name: "submit_dispute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "claim", type: "string" },
      { name: "evidence", type: "string" }
    ],
    outputs: []
  }
] as const satisfies Abi;

export const disputeResolverReadAbi = [
  {
    type: "function",
    name: "get_dispute",
    stateMutability: "view",
    inputs: [{ name: "dispute_id", type: "uint64" }],
    outputs: []
  },
  {
    type: "function",
    name: "get_latest_dispute",
    stateMutability: "view",
    inputs: [],
    outputs: []
  },
  {
    type: "function",
    name: "get_my_disputes",
    stateMutability: "view",
    inputs: [{ name: "user", type: "string" }],
    outputs: []
  },
  {
    type: "function",
    name: "get_my_dispute_ids",
    stateMutability: "view",
    inputs: [{ name: "user", type: "string" }],
    outputs: []
  }
] as const satisfies Abi;

export const wagmiConfig = createConfig({
  chains: [genlayerChain],
  connectors: [injected({ target: "metaMask" })],
  transports: {
    [genlayerChain.id]: http(genlayerChain.rpcUrls.default.http[0])
  }
});

export type Dispute = {
  id: bigint;
  submitter: string;
  claim: string;
  evidence: string;
  verdict: string;
  reason: string;
};

function normalizeNumberish(value: unknown): bigint {
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

function parseJsonCandidate(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }

  return null;
}

function parseGenLayerViewResult(data: `0x${string}` | undefined): unknown {
  if (!data || data === "0x") return null;

  const candidates: string[] = [];

  try {
    const [decoded] = decodeAbiParameters([{ type: "string" }], data);
    candidates.push(decoded);
  } catch {
    // not abi-string encoded
  }

  try {
    candidates.push(hexToString(data, { size: undefined }).replace(/\u0000/g, ""));
  } catch {
    // not utf8-hex encoded
  }

  for (const candidate of candidates) {
    try {
      return parseJsonCandidate(candidate);
    } catch {
      // continue
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function toDisputeTuple(value: unknown): Dispute | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    id: normalizeNumberish(value.id),
    submitter: typeof value.submitter === "string" ? value.submitter : "",
    claim: typeof value.claim === "string" ? value.claim : "",
    evidence: typeof value.evidence === "string" ? value.evidence : "",
    verdict: typeof value.verdict === "string" ? value.verdict : "",
    reason: typeof value.reason === "string" ? value.reason : ""
  };
}

export function toDisputeArray(value: unknown): Dispute[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => toDisputeTuple(entry)).filter((entry): entry is Dispute => entry !== null);
}

export function toDisputeIdArray(value: unknown): bigint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeNumberish);
}

export async function callGenLayerView(
  publicClient: PublicClient,
  functionName: "get_dispute" | "get_latest_dispute" | "get_my_disputes" | "get_my_dispute_ids",
  args: unknown[] = []
) {
  const data = encodeFunctionData({
    abi: disputeResolverReadAbi,
    functionName,
    args: args as never
  });

  const response = await publicClient.call({
    to: CONTRACT_ADDRESS,
    data,
    account: undefined
  });

  return parseGenLayerViewResult(response.data);
}
