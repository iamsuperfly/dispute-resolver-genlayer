"use client";

import { FormEvent, useEffect, useState } from "react";
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

function renderTxStatusMessage(message: string) {
  return message.split(/(ACCEPTED|FINALIZED)/g).map((part, index) => {
    if (part === "ACCEPTED" || part === "FINALIZED") {
      return (
        <span key={`${part}-${index}`} className="status-keyword">
          {part}
        </span>
      );
    }
    return <span key={`message-${index}`}>{part}</span>;
  });
}

export default function HomePage() {
  const { account, chainId, isConnected, isCorrectNetwork, connect, disconnect, ensureNetwork, provider, walletError } = useWallet();
  const [showSplash, setShowSplash] = useState(true);

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
  const [expandedDisputeIds, setExpandedDisputeIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setShowSplash(false);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, []);

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

  function toggleDispute(disputeId: string) {
    setExpandedDisputeIds((current) => ({
      ...current,
      [disputeId]: !current[disputeId]
    }));
  }

  return (
    <>
      {showSplash && (
        <div className="splash-screen" role="status" aria-live="polite" aria-label="Loading AI Dispute Resolver">
          <div className="splash-logo-wrap">
            <Image src="/assets/logos/dispute-resolver-logo.png" alt="AI Dispute Resolver logo" width={122} height={122} className="splash-logo" priority />
            <span className="splash-ring" aria-hidden="true" />
          </div>
        </div>
      )}

      <main className={`page-shell ${showSplash ? "app-hidden" : "app-ready"}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-group">
            <div className="brand-logo-frame" aria-hidden="true">
              <Image src="/assets/logos/dispute-resolver-logo.png" alt="AI Dispute Resolver" width={52} height={52} className="brand-logo-image" />
            </div>
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
          <p className="status-message">{renderTxStatusMessage(txStatusMessage)}</p>
          <p className="hash">Tx: {txHash}</p>
        </section>
      )}

      <section className="card">
        <h2>Resolution Lookup</h2>
        <form className="lookup-row" onSubmit={onLookupSubmit}>
          <input type="number" min={1} value={lookupId} onChange={(event) => setLookupId(event.target.value)} placeholder="Dispute ID" />
          <button type="submit" className="button secondary">Load Dispute</button>
        </form>
        {isLookupLoading && <p className="muted">Loading dispute...</p>}
        {lookupError && <p className="error">{lookupError}</p>}
        {lookedUpDispute && <DisputeView dispute={lookedUpDispute} />}
      </section>

      <section className="card">
        <h2>Latest Dispute</h2>
        <button onClick={() => void onLoadLatest()} type="button" className="button secondary">Refresh Latest Dispute</button>
        {isLatestLoading && <p className="muted">Loading latest dispute...</p>}
        {latestError && <p className="error">{latestError}</p>}
        {!isLatestLoading && latestDispute && <DisputeView dispute={latestDispute} />}
      </section>

      <section className="card">
        <h2>My Dashboard</h2>
        <button onClick={() => void onLoadDashboard()} type="button" className="button secondary">Load My Disputes</button>
        {isDashboardLoading && <p className="muted">Loading your disputes...</p>}
        {dashboardError && <p className="error">{dashboardError}</p>}
        {myDisputeIds.length > 0 && <p className="muted">My dispute IDs: {myDisputeIds.map((id) => id.toString()).join(", ")}</p>}
        <div className="accordion-list">
          {myDisputes.map((dispute) => (
            <article key={dispute.id.toString()} className="accordion-item">
              <button type="button" className="accordion-trigger" onClick={() => toggleDispute(dispute.id.toString())}>
                <span>Dispute #{dispute.id.toString()}</span>
                <span>{expandedDisputeIds[dispute.id.toString()] ? "−" : "+"}</span>
              </button>
              {expandedDisputeIds[dispute.id.toString()] && <DisputeView dispute={dispute} />}
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div className="footer-meta">
          <p>
            Contract:{" "}
            <a href={`https://studio.genlayer.com/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="footer-link">
              <span className="hash-inline">{shortAddress(CONTRACT_ADDRESS)}</span>
            </a>
          </p>
          <p>Wallet chain: {isConnected ? chainId : "-"}</p>
          <p>Target chain: {GENLAYER_CHAIN.id}</p>
          <p>RPC: {GENLAYER_CHAIN.rpcUrl}</p>
          <div className="footer-network-manual">
            <p>Add network Manually</p>
            <p>chain ID: {GENLAYER_CHAIN.id}</p>
            <p>network name: {GENLAYER_CHAIN.name}</p>
            <p>rpc: {GENLAYER_CHAIN.rpcUrl}</p>
            <p>currency symbol: {GENLAYER_CHAIN.currency.symbol}</p>
          </div>
        </div>
        <div className="footer-powered">
          <span>Powered by</span>
          <div className="footer-brand" aria-label="GenLayer logo">
            <Image src="/assets/genlayer/genlayer-wordmark.svg" alt="Powered by GenLayer" width={180} height={42} />
          </div>
        </div>
        <div className="built-by">
          <span>Built by</span>
          <a href="https://x.com/killsh0tx" target="_blank" rel="noopener noreferrer">
            Superfly 🦅
          </a>
        </div>
      </footer>
      </main>
    </>
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
