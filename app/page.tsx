"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract
} from "wagmi";

import { CONTRACT_ADDRESS, disputeResolverAbi, genlayerChain, toDisputeArray, toDisputeTuple } from "@/lib/genlayer";

const MAX_CHARS = 800;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function HomePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const wrongNetwork = isConnected && chainId !== genlayerChain.id;

  const [claim, setClaim] = useState("");
  const [evidence, setEvidence] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [lookupId, setLookupId] = useState("");

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

  const latestDisputeQuery = useReadContract({
    abi: disputeResolverAbi,
    address: CONTRACT_ADDRESS,
    functionName: "get_latest_dispute",
    chainId: genlayerChain.id,
    query: {
      refetchInterval: 12_000
    }
  });

  const myDisputesQuery = useReadContract({
    abi: disputeResolverAbi,
    address: CONTRACT_ADDRESS,
    functionName: "get_my_disputes_self",
    chainId: genlayerChain.id,
    account: address,
    query: {
      enabled: isConnected && !wrongNetwork && !!address,
      refetchInterval: 15_000
    }
  });

  const lookupDisputeQuery = useReadContract({
    abi: disputeResolverAbi,
    address: CONTRACT_ADDRESS,
    functionName: "get_dispute",
    args: [lookupId ? BigInt(lookupId) : 0n],
    chainId: genlayerChain.id,
    query: {
      enabled: !!lookupId && Number(lookupId) > 0
    }
  });

  const latestDispute = useMemo(() => toDisputeTuple(latestDisputeQuery.data), [latestDisputeQuery.data]);
  const myDisputes = useMemo(() => toDisputeArray(myDisputesQuery.data), [myDisputesQuery.data]);
  const lookedUpDispute = useMemo(() => toDisputeTuple(lookupDisputeQuery.data), [lookupDisputeQuery.data]);

  const canSubmit = isConnected && !wrongNetwork && !isSubmitting && !txReceipt.isLoading;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

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

    writeContract({
      abi: disputeResolverAbi,
      address: CONTRACT_ADDRESS,
      functionName: "submit_dispute",
      args: [trimmedClaim, trimmedEvidence],
      chainId: genlayerChain.id,
      account: address
    });
  }

  return (
    <main className="grid">
      <header className="card">
        <h1>GenLayer AI Dispute Resolver</h1>
        <p>Contract: {CONTRACT_ADDRESS}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span className="badge">Chain ID {genlayerChain.id}</span>
          <span className="badge">RPC: {genlayerChain.rpcUrls.default.http[0]}</span>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {!isConnected ? (
            <button
              onClick={() => {
                const connector = connectors[0];
                if (connector) connect({ connector });
              }}
              disabled={isConnecting || connectors.length === 0}
              type="button"
            >
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
            <button onClick={() => switchChain({ chainId: genlayerChain.id })} disabled={isSwitching} type="button">
              {isSwitching ? "Switching..." : "Switch to GenLayer"}
            </button>
          )}
        </div>
        {wrongNetwork && <p className="error">Wrong network. Please switch MetaMask to Chain ID {genlayerChain.id}.</p>}
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
        {formError && <p className="error">{formError}</p>}
        {writeError && <p className="error">{writeError.shortMessage || writeError.message}</p>}
        {txHash && <p>Transaction hash: {txHash}</p>}
        {txReceipt.isSuccess && <p>Transaction confirmed in block {txReceipt.data.blockNumber.toString()}.</p>}
        {txReceipt.isError && <p className="error">Confirmation failed: {txReceipt.error?.message}</p>}
      </section>

      <section className="card">
        <h2>Resolution Lookup (get_dispute)</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            min={1}
            value={lookupId}
            onChange={(event) => setLookupId(event.target.value)}
            placeholder="Dispute ID"
          />
        </div>
        {lookupDisputeQuery.isLoading && <p>Loading dispute...</p>}
        {lookupDisputeQuery.error && <p className="error">{lookupDisputeQuery.error.message}</p>}
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
        {latestDisputeQuery.isLoading && <p>Loading latest dispute...</p>}
        {latestDisputeQuery.error && <p className="error">{latestDisputeQuery.error.message}</p>}
        {!latestDisputeQuery.isLoading && !latestDispute && <p>No disputes yet.</p>}
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
        <h2>My Dashboard (get_my_disputes_self)</h2>
        {!isConnected && <p>Connect wallet to load your personal disputes using caller context.</p>}
        {isConnected && wrongNetwork && <p className="error">Switch network to load your dashboard.</p>}
        {myDisputesQuery.isLoading && <p>Loading your disputes...</p>}
        {myDisputesQuery.error && <p className="error">{myDisputesQuery.error.message}</p>}
        {isConnected && !wrongNetwork && !myDisputesQuery.isLoading && myDisputes.length === 0 && (
          <p>You have not submitted disputes yet.</p>
        )}
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
