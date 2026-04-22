import { decodeAbiParameters, encodeFunctionData, hexToString, parseAbi, type Address, type Hex } from "viem";

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

const ABI = parseAbi([
  "function submit_dispute(string claim, string evidence)",
  "function get_latest_dispute() view",
  "function get_dispute(uint64 dispute_id) view",
  "function get_my_disputes(string user) view",
  "function get_my_dispute_ids(string user) view"
]);
type ContractFunctionName = "get_latest_dispute" | "get_dispute" | "get_my_disputes" | "get_my_dispute_ids";

type RpcRequest = { jsonrpc: "2.0"; id: number; method: string; params?: unknown[] };

type RpcResult<T> = { jsonrpc: "2.0"; id: number; result?: T; error?: { code: number; message: string } };

export type Dispute = {
  id: bigint;
  submitter: string;
  claim: string;
  evidence: string;
  verdict: string;
  reason: string;
};

export type TxStatus = "idle" | "submitted" | "accepted" | "finalized" | "failed";

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

function parseJsonCandidate(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }

  return null;
}

function parseGenLayerViewResult(data: Hex): unknown {
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

  throw new Error(`GenLayer view decode mismatch. Raw response: ${data.slice(0, 66)}...`);
}

export class GenlayerClient {
  constructor(private readonly endpoint: string) {}

  private async rpc<T>(method: string, params: unknown[] = []): Promise<T> {
    const body: RpcRequest = { jsonrpc: "2.0", id: Date.now(), method, params };
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`RPC ${method} failed with HTTP ${response.status}.`);
    }

    const json = (await response.json()) as RpcResult<T>;
    if (json.error) {
      throw new Error(`${method}: ${json.error.message}`);
    }

    if (json.result === undefined) {
      throw new Error(`${method}: empty result.`);
    }

    return json.result;
  }

  private async callRaw(functionName: ContractFunctionName, args: unknown[] = []): Promise<Hex> {
    const data = encodeFunctionData({ abi: ABI, functionName, args: args as never });
    const result = await this.rpc<Hex>("eth_call", [{ to: CONTRACT_ADDRESS, data }, "latest"]);
    return result;
  }

  async getLatestDispute(): Promise<Dispute | null> {
    const result = parseGenLayerViewResult(await this.callRaw("get_latest_dispute"));
    if (!result || (typeof result === "object" && !Array.isArray(result) && Object.keys(result as Record<string, unknown>).length === 0)) {
      return null;
    }
    return toDispute(result);
  }

  async getDispute(id: bigint): Promise<Dispute | null> {
    const result = parseGenLayerViewResult(await this.callRaw("get_dispute", [id]));
    if (!result) return null;
    return toDispute(result);
  }

  async getMyDisputes(address: Address): Promise<Dispute[]> {
    const result = parseGenLayerViewResult(await this.callRaw("get_my_disputes", [address]));
    if (!Array.isArray(result)) return [];
    return result.map((item) => toDispute(item));
  }

  async getMyDisputeIds(address: Address): Promise<bigint[]> {
    const result = parseGenLayerViewResult(await this.callRaw("get_my_dispute_ids", [address]));
    if (!Array.isArray(result)) return [];
    return result.map(normalizeBigInt);
  }

  async submitDispute(ethereum: EthereumProvider, from: Address, claim: string, evidence: string): Promise<Hex> {
    const data = encodeFunctionData({
      abi: ABI,
      functionName: "submit_dispute",
      args: [claim, evidence]
    });

    const txHash = (await ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from,
          to: CONTRACT_ADDRESS,
          data,
          value: "0x0"
        }
      ]
    })) as Hex;

    return txHash;
  }

  async getTransactionReceipt(hash: Hex) {
    return this.rpc<Record<string, unknown> | null>("eth_getTransactionReceipt", [hash]);
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

export const genlayerClient = new GenlayerClient(GENLAYER_CHAIN.rpcUrl);
