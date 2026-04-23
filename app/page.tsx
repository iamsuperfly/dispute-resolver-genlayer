"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { TransactionStatus } from "genlayer-js/types";

import { useWallet } from "@/app/wallet-provider";
import { CONTRACT_ADDRESS, formatError, GENLAYER_CHAIN, genlayerClient, type Dispute, type TxStatus } from "@/lib/genlayer";

const MAX_CHARS = 800;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getStepState(txStatus: TxStatus, step: "submitted" | "accepted" | "finalized") {
  const order: Record<string, number> = { idle: 0, submitted: 1, accepted: 2, finalized: 3, failed: -1 };
  return order[txStatus] >= order[step];
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

  async function waitForFinalizedStatus(hash: `0x${string}`) {
    setTxStatus("submitted");
    setTxStatusMessage("Submitted. Waiting for ACCEPTED status...");

    await genlayerClient.waitForTransaction(hash, TransactionStatus.ACCEPTED);
    setTxStatus("accepted");
    setTxStatusMessage("Transaction accepted. Waiting for FINALIZED status...");

    await genlayerClient.waitForTransaction(hash, TransactionStatus.FINALIZED);
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
    <main className="page-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-group">
            <Image src="/assets/logos/logo-light.svg" alt="AI Dispute Resolver" width={40} height={40} />
            <div>
              <h1 className="title">AI Dispute Resolver</h1>
              <p className="subtitle">Powered by GenLayer Intelligent Contracts</p>
            </div>
          </div>

          <div className="wallet-group">
            {isConnected ? (
              <>
                <span className="connected">Connected as <strong>{shortAddress(account ?? "")}</strong></span>
                <button onClick={() => disconnect()} type="button" className="button secondary">Disconnect</button>
                {!isCorrectNetwork && (
                  <button onClick={() => void ensureNetwork()} type="button" className="button warning">Switch to GenLayer</button>
                )}
              </>
            ) : (
              <button onClick={() => void connect()} type="button" className="button primary">Connect Wallet</button>
            )}
          </div>
        </div>
      </header>

      <section className="meta-row">
        <span className="badge">Wallet chain: {isConnected ? chainId : "-"}</span>
        <span className="badge">Target chain: {GENLAYER_CHAIN.id}</span>
        <span className="badge">RPC: {GENLAYER_CHAIN.rpcUrl}</span>
        <span className="badge contract">Contract: {shortAddress(CONTRACT_ADDRESS)}</span>
      </section>

      {!isCorrectNetwork && isConnected && <p className="error">Wallet is on wrong network. Submissions are blocked.</p>}
      {walletError && <p className="error">{walletError}</p>}

      <section className="card">
        <h2>Submit Dispute</h2>
        <form className="grid" onSubmit={onSubmit}>
          <div>
            <label htmlFor="claim">Claim ({claim.length}/{MAX_CHARS})</label>
            <textarea id="claim" maxLength={MAX_CHARS} value={claim} onChange={(event) => setClaim(event.target.value)} placeholder="Describe the claim details..." />
          </div>
          <div>
            <label htmlFor="evidence">Evidence ({evidence.length}/{MAX_CHARS})</label>
            <textarea id="evidence" maxLength={MAX_CHARS} value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Provide supporting evidence..." />
          </div>
          <button type="submit" className="button primary full" disabled={!isConnected || !isCorrectNetwork || txStatus === "submitted" || txStatus === "accepted"}>
            {txStatus === "submitted" || txStatus === "accepted" ? "Submitting..." : "Submit Dispute"}
          </button>
        </form>
        {formError && <p className="error">{formError}</p>}
      </section>

      {txHash && (
        <section className="card">
          <h2>Transaction Status</h2>
          <div className="stepper">
            {(["submitted", "accepted", "finalized"] as const).map((step, index) => (
              <div className="step" key={step}>
                <div className={`step-dot ${getStepState(txStatus, step) ? "active" : ""}`}>{index + 1}</div>
                <span>{step}</span>
              </div>
            ))}
          </div>
          <p className="muted">{txStatusMessage}</p>
          <p className="hash">Tx: {txHash}</p>
        </section>
      )}

      <section className="card">
        <h2>Resolution Lookup (get_dispute)</h2>
        <form className="lookup-row" onSubmit={onLookupSubmit}>
          <input type="number" min={1} value={lookupId} onChange={(event) => setLookupId(event.target.value)} placeholder="Dispute ID" />
          <button type="submit" className="button secondary">Load Dispute</button>
        </form>
        {isLookupLoading && <p className="muted">Loading dispute...</p>}
        {lookupError && <p className="error">{lookupError}</p>}
        {lookedUpDispute && <DisputeView dispute={lookedUpDispute} />}
      </section>

      <section className="card">
        <h2>Latest Dispute (get_latest_dispute)</h2>
        <button onClick={() => void onLoadLatest()} type="button" className="button secondary">Refresh Latest Dispute</button>
        {isLatestLoading && <p className="muted">Loading latest dispute...</p>}
        {latestError && <p className="error">{latestError}</p>}
        {!isLatestLoading && latestDispute && <DisputeView dispute={latestDispute} />}
      </section>

      <section className="card">
        <h2>My Dashboard (address-based reads)</h2>
        <button onClick={() => void onLoadDashboard()} type="button" className="button secondary">Load My Disputes</button>
        {isDashboardLoading && <p className="muted">Loading your disputes...</p>}
        {dashboardError && <p className="error">{dashboardError}</p>}
        {myDisputeIds.length > 0 && <p className="muted">My dispute IDs: {myDisputeIds.map((id) => id.toString()).join(", ")}</p>}
        <div className="grid">
          {myDisputes.map((dispute) => (
            <DisputeView key={dispute.id.toString()} dispute={dispute} />
          ))}
        </div>
      </section>

      <footer className="footer">
        <span>Powered by</span>
        <a href="https://docs.genlayer.com/" target="_blank" rel="noopener noreferrer" className="footer-brand">
          <Image src="/assets/genlayer/genlayer-wordmark.svg" alt="GenLayer" width={92} height={22} />
        </a>
      </footer>
    </main>
  );
}

function DisputeView({ dispute }: { dispute: Dispute }) {
  return (
    <article className="dispute-card">
      <p><strong>ID:</strong> {dispute.id.toString()}</p>
      <p><strong>Submitter:</strong> {dispute.submitter}</p>
      <p><strong>Claim:</strong> {dispute.claim}</p>
      <p><strong>Evidence:</strong> {dispute.evidence}</p>
      <p><strong>Verdict:</strong> {dispute.verdict}</p>
      <p><strong>Reason:</strong> {dispute.reason}</p>
    </article>
  );
}
