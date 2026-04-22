import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import type { Abi } from "viem";
import { defineChain } from "viem";

export const genlayerChain = defineChain({
  id: 61999,
  name: "GenLayer",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ["https://studio.genlayer.com/api"]
    }
  }
});

export const CONTRACT_ADDRESS = "0xF38D2ED80643F8d8B47973F2789ef04F7259b86e" as const;

export const disputeResolverAbi = [
  {
    type: "function",
    name: "submit_dispute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "claim", type: "string" },
      { name: "evidence", type: "string" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "get_dispute",
    stateMutability: "view",
    inputs: [{ name: "dispute_id", type: "uint64" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint64" },
          { name: "submitter", type: "address" },
          { name: "claim", type: "string" },
          { name: "evidence", type: "string" },
          { name: "verdict", type: "string" },
          { name: "reason", type: "string" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "get_latest_dispute",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint64" },
          { name: "submitter", type: "address" },
          { name: "claim", type: "string" },
          { name: "evidence", type: "string" },
          { name: "verdict", type: "string" },
          { name: "reason", type: "string" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "get_my_disputes_self",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint64" },
          { name: "submitter", type: "address" },
          { name: "claim", type: "string" },
          { name: "evidence", type: "string" },
          { name: "verdict", type: "string" },
          { name: "reason", type: "string" }
        ]
      }
    ]
  }
] as const satisfies Abi;

export const wagmiConfig = createConfig({
  chains: [genlayerChain],
  connectors: [injected({ target: "metaMask" })],
  transports: {
    [genlayerChain.id]: http(genlayerChain.rpcUrls.default.http[0])
  }
});

type Dispute = {
  id: bigint;
  submitter: string;
  claim: string;
  evidence: string;
  verdict: string;
  reason: string;
};

type UnknownTuple = readonly [unknown, unknown, unknown, unknown, unknown, unknown];

function isDisputeTuple(value: unknown): value is UnknownTuple {
  return Array.isArray(value) && value.length >= 6;
}

export function toDisputeTuple(value: unknown): Dispute | null {
  if (!isDisputeTuple(value)) {
    return null;
  }

  const [id, submitter, claim, evidence, verdict, reason] = value;

  return {
    id: typeof id === "bigint" ? id : BigInt(0),
    submitter: typeof submitter === "string" ? submitter : "",
    claim: typeof claim === "string" ? claim : "",
    evidence: typeof evidence === "string" ? evidence : "",
    verdict: typeof verdict === "string" ? verdict : "",
    reason: typeof reason === "string" ? reason : ""
  };
}

export function toDisputeArray(value: unknown): Dispute[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => toDisputeTuple(entry)).filter((entry): entry is Dispute => entry !== null);
}
