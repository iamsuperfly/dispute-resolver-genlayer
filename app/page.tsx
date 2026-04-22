"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract
} from "wagmi";

import {
  callGenLayerView,
  CONTRACT_ADDRESS,
  disputeResolverWriteAbi,
  genlayerChain,
  toDisputeArray,
  toDisputeIdArray,
  toDisputeTuple
} from "@/lib/genlayer";

const MAX_CHARS = 800;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatWriteError(error: unknown) {
  if (typeof error !== "object" || !error) {
    return "Transaction failed.";
  }

  const candidate = error as { shortMessage?: string; message?: string };
  return candidate.shortMessage || candidate.message || "Transaction failed.";
}

export default function HomePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: genlayerChain.id });
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, switchChainAsync, isPending: isSwitching } = useSwitchChain();

  const wrongNetwork = isConnected && chainId !== genlayerChain.id;

  const [claim, setClaim] = useState("");
  const [evidence, setEvidence] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const [lookupId, setLookupId] = useState("");
  const [submittedLookupId, setSubmittedLookupId] = useState<bigint | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const enforcementKeyRef = useRef<string | null>(null);

  const {
    writeContract,
    data: txHash,
    error: writeError,
    isPending: isSubmitting
  } = useWriteContract();

  const txReceipt = useWaitForTransactionReceipt({
    chainId: genlayerChain.id,
    hash: txHash,
    query: {
      enabled: !!txHash
    }
  });

  async function loadLatestDispute() {
    if (!publicClient) {
      throw new Error("RPC client not ready.");
    }

    return callGenLayerView(publicClient, "get_latest_dispute");
  }

  async function loadMyDisputes() {
    if (!publicClient || !address) {
      throw new Error("Connect your wallet first.");
    }

    return callGenLayerView(publicClient, "get_my_disputes", [address]);
  }

  async function loadMyDisputeIds() {
    if (!publicClient || !address) {
      throw new Error("Connect your wallet first.");
    }

    return callGenLayerView(publicClient, "get_my_dispute_ids", [address]);
  }

  async function loadDisputeById() {
    if (!publicClient || submittedLookupId === null) {
      throw new Error("Provide a dispute ID first.");
    }

    return callGenLayerView(publicClient, "get_dispute", [submittedLookupId]);
  }

  const latestDisputeQuery = useQuery({
    queryKey: ["latest-dispute"],
    queryFn: loadLatestDispute,
    enabled: false
  });

  const myDisputesQuery = useQuery({
    queryKey: ["my-disputes", address],
    queryFn: loadMyDisputes,
    enabled: false
  });

  const myDisputeIdsQuery = useQuery({
    queryKey: ["my-dispute-ids", address],
    queryFn: loadMyDisputeIds,
    enabled: false
  });

  const lookupDisputeQuery = useQuery({
    queryKey: ["dispute", submittedLookupId?.toString()],
    queryFn: loadDisputeById,
    enabled: false
  });

  const latestDispute = useMemo(() => toDisputeTuple(latestDisputeQuery.data), [latestDisputeQuery.data]);
  const myDisputes = useMemo(() => toDisputeArray(myDisputesQuery.data), [myDisputesQuery.data]);
  const myDisputeIds = useMemo(() => toDisputeIdArray(myDisputeIdsQuery.data), [myDisputeIdsQuery.data]);
  const lookedUpDispute = useMemo(() => toDisputeTuple(lookupDisputeQuery.data), [lookupDisputeQuery.data]);

  const canSubmit = isConnected && !wrongNetwork && !isSubmitting && !txReceipt.isLoading;

  const ensureGenlayerNetwork = useCallback(async () => {
    if (!isConnected) {
      throw new Error("Connect your wallet first.");
    }

    if (chainId === genlayerChain.id) {
      return;
    }

    try {
      if (switchChainAsync) {
        await switchChainAsync({ chainId: genlayerChain.id });
      } else {
        switchChain({ chainId: genlayerChain.id });
      }
      return;
    } catch {
      // fall back to provider RPC methods for wallets that require explicit add/switch flow
    }

    const ethereum = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } })
      .ethereum;

    if (!ethereum) {
      throw new Error("No injected wallet found. Open this app in MetaMask browser.");
    }

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${genlayerChain.id.toString(16)}` }]
      });
      return;
    } catch {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${genlayerChain.id.toString(16)}`,
            chainName: genlayerChain.name,
            nativeCurrency: genlayerChain.nativeCurrency,
            rpcUrls: genlayerChain.rpcUrls.default.http
          }
        ]
      });
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${genlayerChain.id.toString(16)}` }]
      });
    }
  }, [chainId, isConnected, switchChain, switchChainAsync]);

  useEffect(() => {
    if (!isConnected || !wrongNetwork || !address) {
      enforcementKeyRef.current = null;
      return;
    }

    const key = `${address}-${chainId}`;
    if (enforcementKeyRef.current === key) {
      return;
    }

    enforcementKeyRef.current = key;
    setNetworkError(null);
    ensureGenlayerNetwork().catch((error) => {
      setNetworkError(formatWriteError(error));
    });
  }, [address, chainId, ensureGenlayerNetwork, isConnected, wrongNetwork]);

  async function onConnect() {
    setNetworkError(null);

    const connector = connectors[0];
    if (!connector) {
      setNetworkError("No injected connector available.");
      return;
    }

    await connectAsync({ connector });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNetworkError(null);

    const trimmedClaim = claim.trim();
    const trimmedEvidence = evidence.trim();

    if (!address) {
      setFormError("Connect your wallet before submitting.");
      return;
    }

    if (!trimmedClaim || !trimmedEvidence) {
      setFormError("Claim and evidence are both required.");
      return;
    }

    if (trimmedClaim.length > MAX_CHARS || trimmedEvidence.length > MAX_CHARS) {
      setFormError(`Claim and evidence must be at most ${MAX_CHARS} characters each.`);
      return;
    }

    ensureGenlayerNetwork()
      .then(() => {
        writeContract({
          abi: disputeResolverWriteAbi,
          address: CONTRACT_ADDRESS,
          functionName: "submit_dispute",
          args: [trimmedClaim, trimmedEvidence],
          chainId: genlayerChain.id,
          account: address
        });
      })
      .catch((error) => {
        setNetworkError(formatWriteError(error));
      });
  }

  function onLookupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookupError(null);

    const parsed = Number(lookupId);
    if (!lookupId.trim()) {
      setSubmittedLookupId(null);
      setLookupError("Enter a dispute ID to search.");
      return;
    }

    if (!Number.isInteger(parsed) || parsed <= 0) {
      setSubmittedLookupId(null);
      setLookupError("Dispute ID must be a positive integer.");
      return;
    }

    setSubmittedLookupId(BigInt(parsed));
    void lookupDisputeQuery.refetch();
  }

  async function refreshDashboard() {
    if (!isConnected || wrongNetwork) {
      setLookupError(null);
      setNetworkError("Connect on GenLayer Studio to load account reads.");
      return;
    }

    await Promise.all([myDisputesQuery.refetch(), myDisputeIdsQuery.refetch()]);
  }

  return (
    <main className="grid">
      <header className="card">
        <h1>GenLayer AI Dispute Resolver</h1>
        <p>Contract: {CONTRACT_ADDRESS}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span className="badge">Target Chain ID {genlayerChain.id}</span>
          <span className="badge">Connected Chain ID {isConnected ? chainId : "-"}</span>
          <span className="badge">RPC: {genlayerChain.rpcUrls.default.http[0]}</span>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {!isConnected ? (
            <button onClick={() => void onConnect()} disabled={isConnecting || connectors.length === 0} type="button">
              {isConnecting ? "Connecting..." : "Connect MetaMask"}
            </button>
          ) : (
            <>
              <span>Connected as {shortAddress(address ?? "")}</span>
              <button onClick={() => disconnect()} type="button">
                Disconnect
              </button>
            </>
          )}

          {wrongNetwork && (
            <button
              onClick={() => {
                setNetworkError(null);
                ensureGenlayerNetwork().catch((error) => setNetworkError(formatWriteError(error)));
              }}
              disabled={isSwitching}
              type="button"
            >
              {isSwitching ? "Switching..." : "Switch to GenLayer"}
            </button>
          )}
        </div>
        {wrongNetwork && <p className="error">Wrong network. Switch to GenLayer Studio (Chain ID {genlayerChain.id}).</p>}
        {networkError && <p className="error">{networkError}</p>}
      </header>

      <section className="card">
        <h2>Submit Dispute</h2>
        <form className="grid" onSubmit={onSubmit}>
          <div>
            <label htmlFor="claim">Claim ({claim.length}/{MAX_CHARS})</label>
            <textarea
              id="claim"
              maxLength={MAX_CHARS}
              value={claim}
              onChange={(event) => setClaim(event.target.value)}
              placeholder="Describe the claim"
            />
          </div>

          <div>
            <label htmlFor="evidence">Evidence ({evidence.length}/{MAX_CHARS})</label>
            <textarea
              id="evidence"
              maxLength={MAX_CHARS}
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
              placeholder="Provide evidence"
            />
          </div>

          <button type="submit" disabled={!canSubmit}>
            {isSubmitting || txReceipt.isLoading ? "Submitting..." : "Submit Dispute"}
          </button>
        </form>
        {!isConnected && <p>Connect your wallet to submit a real transaction.</p>}
        {isConnected && wrongNetwork && <p className="error">You must switch to Chain ID {genlayerChain.id} before submitting.</p>}
        {formError && <p className="error">{formError}</p>}
        {writeError && <p className="error">{formatWriteError(writeError)}</p>}
        <p>Write status: {txReceipt.isSuccess ? "success" : txReceipt.isError ? "failed" : txReceipt.isLoading ? "pending" : "idle"}</p>
        {txHash && <p>Transaction hash: {txHash}</p>}
        {txReceipt.isSuccess && (
          <p>
            Receipt confirmed at block {txReceipt.data.blockNumber.toString()} with {txReceipt.data.logs.length} logs for contract {CONTRACT_ADDRESS}.
          </p>
        )}
        {txReceipt.isError && <p className="error">Confirmation failed: {txReceipt.error?.message}</p>}
      </section>

      <section className="card">
        <h2>Resolution Lookup (get_dispute)</h2>
        <form style={{ display: "flex", gap: 8 }} onSubmit={onLookupSubmit}>
          <input
            type="number"
            min={1}
            value={lookupId}
            onChange={(event) => setLookupId(event.target.value)}
            placeholder="Dispute ID"
          />
          <button type="submit">Load Dispute</button>
        </form>
        {lookupError && <p className="error">{lookupError}</p>}
        {!submittedLookupId && <p>Enter a positive dispute ID, then click Load Dispute.</p>}
        {lookupDisputeQuery.isFetching && <p>Loading dispute...</p>}
        {submittedLookupId && lookupDisputeQuery.error && <p className="error">{lookupDisputeQuery.error.message}</p>}
        {lookedUpDispute && (
          <DisputeView
            id={lookedUpDispute.id.toString()}
            submitter={lookedUpDispute.submitter}
            claim={lookedUpDispute.claim}
            evidence={lookedUpDispute.evidence}
            verdict={lookedUpDispute.verdict}
            reason={lookedUpDispute.reason}
          />
        )}
      </section>

      <section className="card">
        <h2>Latest Dispute (get_latest_dispute)</h2>
        <button onClick={() => void latestDisputeQuery.refetch()} type="button" style={{ width: "fit-content" }}>
          Refresh Latest Dispute
        </button>
        {latestDisputeQuery.isFetching && <p>Loading latest dispute...</p>}
        {latestDisputeQuery.error && <p className="error">{latestDisputeQuery.error.message}</p>}
        {latestDisputeQuery.isFetched && !latestDispute && <p>No disputes yet.</p>}
        {latestDispute && (
          <DisputeView
            id={latestDispute.id.toString()}
            submitter={latestDispute.submitter}
            claim={latestDispute.claim}
            evidence={latestDispute.evidence}
            verdict={latestDispute.verdict}
            reason={latestDispute.reason}
          />
        )}
      </section>

      <section className="card">
        <h2>My Dashboard (address-based reads)</h2>
        {!isConnected && <p>Connect wallet to load your personal disputes.</p>}
        {isConnected && wrongNetwork && <p className="error">Switch network to load your dashboard.</p>}
        <button onClick={() => void refreshDashboard()} type="button" disabled={!isConnected || wrongNetwork} style={{ width: "fit-content" }}>
          Load My Disputes
        </button>
        {myDisputesQuery.isFetching && <p>Loading your disputes...</p>}
        {myDisputesQuery.error && <p className="error">{myDisputesQuery.error.message}</p>}
        {myDisputeIdsQuery.error && <p className="error">{myDisputeIdsQuery.error.message}</p>}
        {isConnected && !wrongNetwork && myDisputeIds.length > 0 && <p>Your dispute IDs: {myDisputeIds.map((id) => id.toString()).join(", ")}</p>}
        {isConnected && !wrongNetwork && myDisputesQuery.isFetched && myDisputes.length === 0 && <p>You have not submitted disputes yet.</p>}
        <div className="grid">
          {myDisputes.map((dispute) => (
            <DisputeView
              key={dispute.id.toString()}
              id={dispute.id.toString()}
              submitter={dispute.submitter}
              claim={dispute.claim}
              evidence={dispute.evidence}
              verdict={dispute.verdict}
              reason={dispute.reason}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

type DisputeViewProps = {
  id: string;
  submitter: string;
  claim: string;
  evidence: string;
  verdict: string;
  reason: string;
};

function DisputeView({ id, submitter, claim, evidence, verdict, reason }: DisputeViewProps) {
  return (
    <article style={{ border: "1px solid #263356", borderRadius: 12, padding: 12 }}>
      <p>
        <strong>ID:</strong> {id}
      </p>
      <p>
        <strong>Submitter:</strong> {submitter}
      </p>
      <p>
        <strong>Claim:</strong> {claim}
      </p>
      <p>
        <strong>Evidence:</strong> {evidence}
      </p>
      <p>
        <strong>Verdict:</strong> {verdict || "pending"}
      </p>
      <p>
        <strong>Reason:</strong> {reason || "No reason"}
      </p>
    </article>
  );
}
