"use client";

import { FormEvent, useState } from "react";
import { type Hash } from "viem";

import { useWallet } from "@/app/wallet-provider";
import { CONTRACT_ADDRESS, formatError, GENLAYER_CHAIN, genlayerClient, type Dispute, type TxStatus } from "@/lib/genlayer";

const MAX_CHARS = 800;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function HomePage() {
  const { account, chainId, isConnected, isCorrectNetwork, connect, disconnect, ensureNetwork, provider, walletError } = useWallet();

  const [claim, setClaim] = useState("");
  const [evidence, setEvidence] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txStatusMessage, setTxStatusMessage] = useState<string>("No submission yet.");

  const [latestDispute, setLatestDispute] = useState<Dispute | null>(null);
  const [latestError, setLatestError] = useState<string | null>(null);
  const [isLatestLoading, setIsLatestLoading] = useState(false);

  const [lookupId, setLookupId] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookedUpDispute, setLookedUpDispute] = useState<Dispute | null>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);

  const [myDisputes, setMyDisputes] = useState<Dispute[]>([]);
  const [myDisputeIds, setMyDisputeIds] = useState<bigint[]>([]);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);

  async function waitForFinalizedStatus(hash: Hash) {
    setTxStatus("submitted");
    setTxStatusMessage("Submitted. Waiting for ACCEPTED status...");

    await genlayerClient.waitForTransaction(hash, "ACCEPTED");
    setTxStatus("accepted");
    setTxStatusMessage("Transaction accepted. Waiting for FINALIZED status...");

    await genlayerClient.waitForTransaction(hash, "FINALIZED");
    setTxStatus("finalized");
    setTxStatusMessage("Transaction finalized on GenLayer Studio.");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const trimmedClaim = claim.trim();
    const trimmedEvidence = evidence.trim();

    if (!account || !provider) {
      setFormError("Connect MetaMask first.");
      return;
    }

    if (!trimmedClaim || !trimmedEvidence) {
      setFormError("Claim and evidence are required.");
      return;
    }

    if (trimmedClaim.length > MAX_CHARS || trimmedEvidence.length > MAX_CHARS) {
      setFormError(`Claim and evidence must be <= ${MAX_CHARS} characters.`);
      return;
    }

    try {
      await ensureNetwork();
      setTxStatus("submitted");
      setTxStatusMessage("Prompting MetaMask for submit_dispute transaction...");

      const hash = await genlayerClient.submitDispute(provider, account, trimmedClaim, trimmedEvidence);
      setTxHash(hash);

      await waitForFinalizedStatus(hash);
    } catch (error) {
      setTxStatus("failed");
      setTxStatusMessage(formatError(error, "Failed to submit dispute."));
    }
  }

  async function onLoadLatest() {
    setLatestError(null);
    setIsLatestLoading(true);

    try {
      const result = await genlayerClient.getLatestDispute();
      setLatestDispute(result);
    } catch (error) {
      setLatestError(formatError(error, "Failed to load latest dispute."));
    } finally {
      setIsLatestLoading(false);
    }
  }

  async function onLookupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookupError(null);
    setLookedUpDispute(null);

    if (!lookupId.trim()) {
      setLookupError("Enter a dispute ID.");
      return;
    }

    const parsed = Number(lookupId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setLookupError("Dispute ID must be a positive integer.");
      return;
    }

    setIsLookupLoading(true);
    try {
      const result = await genlayerClient.getDispute(BigInt(parsed));
      setLookedUpDispute(result);
    } catch (error) {
      setLookupError(formatError(error, "Failed to load dispute."));
    } finally {
      setIsLookupLoading(false);
    }
  }

  async function onLoadDashboard() {
    setDashboardError(null);

    if (!account) {
      setDashboardError("Connect wallet first.");
      return;
    }

    if (!isCorrectNetwork) {
      setDashboardError(`Switch wallet to chain ${GENLAYER_CHAIN.id} first.`);
      return;
    }

    setIsDashboardLoading(true);
    try {
      const [disputes, ids] = await Promise.all([genlayerClient.getMyDisputes(account), genlayerClient.getMyDisputeIds(account)]);
      setMyDisputes(disputes);
      setMyDisputeIds(ids);
    } catch (error) {
      setDashboardError(formatError(error, "Failed to load dashboard."));
    } finally {
      setIsDashboardLoading(false);
    }
  }

  return (
    <main className="grid">
      <header className="card">
        <h1>GenLayer AI Dispute Resolver</h1>
        <p>Contract: {CONTRACT_ADDRESS}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span className="badge">Current wallet chain: {isConnected ? chainId : "-"}</span>
          <span className="badge">Target chain: {GENLAYER_CHAIN.id}</span>
          <span className="badge">RPC: {GENLAYER_CHAIN.rpcUrl}</span>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {!isConnected ? (
            <button onClick={() => void connect()} type="button">
              Connect MetaMask
            </button>
          ) : (
            <>
              <span>Connected as {shortAddress(account ?? "")}</span>
              <button onClick={() => disconnect()} type="button">
                Disconnect
              </button>
              {!isCorrectNetwork && (
                <button onClick={() => void ensureNetwork()} type="button">
                  Switch to GenLayer
                </button>
              )}
            </>
          )}
        </div>

        {!isCorrectNetwork && isConnected && <p className="error">Wallet is on wrong network. Submissions are blocked.</p>}
        {walletError && <p className="error">{walletError}</p>}
      </header>

      <section className="card">
        <h2>Submit Dispute</h2>
        <form className="grid" onSubmit={onSubmit}>
          <div>
            <label htmlFor="claim">Claim ({claim.length}/{MAX_CHARS})</label>
            <textarea id="claim" maxLength={MAX_CHARS} value={claim} onChange={(event) => setClaim(event.target.value)} />
          </div>
          <div>
            <label htmlFor="evidence">Evidence ({evidence.length}/{MAX_CHARS})</label>
            <textarea id="evidence" maxLength={MAX_CHARS} value={evidence} onChange={(event) => setEvidence(event.target.value)} />
          </div>
          <button type="submit" disabled={!isConnected || !isCorrectNetwork || txStatus === "submitted" || txStatus === "accepted"}>
            {txStatus === "submitted" || txStatus === "accepted" ? "Submitting..." : "Submit Dispute"}
          </button>
        </form>
        {formError && <p className="error">{formError}</p>}
        <p>Tx status: {txStatus}</p>
        <p>Tx detail: {txStatusMessage}</p>
        {txHash && <p>Tx hash: {txHash}</p>}
      </section>

      <section className="card">
        <h2>Resolution Lookup (get_dispute)</h2>
        <form style={{ display: "flex", gap: 8 }} onSubmit={onLookupSubmit}>
          <input type="number" min={1} value={lookupId} onChange={(event) => setLookupId(event.target.value)} placeholder="Dispute ID" />
          <button type="submit">Load Dispute</button>
        </form>
        {isLookupLoading && <p>Loading dispute...</p>}
        {lookupError && <p className="error">{lookupError}</p>}
        {lookedUpDispute && <DisputeView dispute={lookedUpDispute} />}
      </section>

      <section className="card">
        <h2>Latest Dispute (get_latest_dispute)</h2>
        <button onClick={() => void onLoadLatest()} type="button" style={{ width: "fit-content" }}>
          Refresh Latest Dispute
        </button>
        {isLatestLoading && <p>Loading latest dispute...</p>}
        {latestError && <p className="error">{latestError}</p>}
        {!isLatestLoading && latestDispute && <DisputeView dispute={latestDispute} />}
      </section>

      <section className="card">
        <h2>My Dashboard (address-based reads)</h2>
        <button onClick={() => void onLoadDashboard()} type="button" style={{ width: "fit-content" }}>
          Load My Disputes
        </button>
        {isDashboardLoading && <p>Loading your disputes...</p>}
        {dashboardError && <p className="error">{dashboardError}</p>}
        {myDisputeIds.length > 0 && <p>My dispute IDs: {myDisputeIds.map((id) => id.toString()).join(", ")}</p>}
        <div className="grid">
          {myDisputes.map((dispute) => (
            <DisputeView key={dispute.id.toString()} dispute={dispute} />
          ))}
        </div>
      </section>
    </main>
  );
}

function DisputeView({ dispute }: { dispute: Dispute }) {
  return (
    <article style={{ border: "1px solid #263356", borderRadius: 12, padding: 12 }}>
      <p>
        <strong>ID:</strong> {dispute.id.toString()}
      </p>
      <p>
        <strong>Submitter:</strong> {dispute.submitter}
      </p>
      <p>
        <strong>Claim:</strong> {dispute.claim}
      </p>
      <p>
        <strong>Evidence:</strong> {dispute.evidence}
      </p>
      <p>
        <strong>Verdict:</strong> {dispute.verdict || "pending"}
      </p>
      <p>
        <strong>Reason:</strong> {dispute.reason || "No reason"}
      </p>
    </article>
  );
}
