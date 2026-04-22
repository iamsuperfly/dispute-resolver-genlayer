import { encodeFunctionData, decodeFunctionResult, parseAbi, type Address, type Hex } from "viem";

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
  "function get_latest_dispute() view returns ((uint64 id, string submitter, string claim, string evidence, string verdict, string reason))",
  "function get_dispute(uint64 dispute_id) view returns ((uint64 id, string submitter, string claim, string evidence, string verdict, string reason))",
  "function get_my_disputes(string user) view returns ((uint64 id, string submitter, string claim, string evidence, string verdict, string reason)[])",
  "function get_my_dispute_ids(string user) view returns (uint64[])"
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

function toDispute(value: unknown): Dispute {
  if (!Array.isArray(value)) {
    throw new Error("Unexpected dispute payload from contract.");
  }

  return {
    id: BigInt(value[0] as bigint | number | string),
    submitter: String(value[1] ?? ""),
    claim: String(value[2] ?? ""),
    evidence: String(value[3] ?? ""),
    verdict: String(value[4] ?? ""),
    reason: String(value[5] ?? "")
  };
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
    const result = await this.callRaw("get_latest_dispute");
    if (result === "0x") return null;
    return toDispute(decodeFunctionResult({ abi: ABI, functionName: "get_latest_dispute", data: result }));
  }

  async getDispute(id: bigint): Promise<Dispute | null> {
    const result = await this.callRaw("get_dispute", [id]);
    if (result === "0x") return null;
    return toDispute(decodeFunctionResult({ abi: ABI, functionName: "get_dispute", data: result }));
  }

  async getMyDisputes(address: Address): Promise<Dispute[]> {
    const result = await this.callRaw("get_my_disputes", [address]);
    const decoded = decodeFunctionResult({ abi: ABI, functionName: "get_my_disputes", data: result });
    return (decoded as unknown[]).map((item) => toDispute(item));
  }

  async getMyDisputeIds(address: Address): Promise<bigint[]> {
    const result = await this.callRaw("get_my_dispute_ids", [address]);
    const decoded = decodeFunctionResult({ abi: ABI, functionName: "get_my_dispute_ids", data: result });
    return decoded as bigint[];
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
