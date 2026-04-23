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
  const { account, isConnected, isCorrectNetwork, connect, disconnect, ensureNetwork, provider, walletError } = useWallet();

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
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      <nav className="border-b border-zinc-800 bg-zinc-900 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-x-3">
            <Image src="/assets/logos/handshake image.png" alt="Dispute Resolver" width={48} height={48} className="object-contain rounded-2xl" />
            <h1 className="text-3xl font-semibold tracking-tighter">Dispute Resolver</h1>
          </div>

          <div className="flex items-center gap-x-8 text-sm font-medium">
            <a href="#about" className="hover:text-genlayer-primary transition-colors">About</a>
            <a href="#how" className="hover:text-genlayer-primary transition-colors">How it works</a>
            <a href="#network" className="hover:text-genlayer-primary transition-colors">Add network</a>
            {isConnected ? (
              <button onClick={() => disconnect()} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-3xl text-sm" type="button">Disconnect</button>
            ) : (
              <button onClick={() => void connect()} className="px-8 py-3 bg-genlayer-primary text-white font-semibold rounded-3xl" type="button">Connect Wallet</button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-8 space-y-8">
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
      </div>

      <footer className="max-w-5xl mx-auto px-6 pt-16 border-t border-zinc-800 text-zinc-400">
        <div className="grid md:grid-cols-3 gap-12 mb-12">
          <div id="about">
            <h2 className="text-lg font-semibold text-white mb-4">About</h2>
            <p className="text-sm leading-relaxed">
              Dispute Resolver is a decentralized platform where anyone can submit claims with evidence.
              GenLayer’s intelligent contracts and AI judges deliver fast, transparent, on-chain resolutions.
              <a href="https://docs.genlayer.com/" target="_blank" rel="noopener noreferrer" className="text-genlayer-primary hover:underline ml-1">GenLayer</a>
            </p>
          </div>
          <div id="how">
            <h2 className="text-lg font-semibold text-white mb-4">How it works</h2>
            <ol className="text-sm space-y-3">
              <li>1. Connect your wallet on GenLayer Studio</li>
              <li>2. Submit your dispute with claim + evidence</li>
              <li>3. AI Judge + validators reach consensus</li>
              <li>4. Get your final verdict on-chain in seconds</li>
            </ol>
          </div>
          <div id="network">
            <h2 className="text-lg font-semibold text-white mb-4">GenLayer Studio Network</h2>
            <div className="text-xs space-y-1">
              <div>Chain ID: <span className="font-mono">61999</span></div>
              <div>RPC: https://studio.genlayer.com/api</div>
            </div>
          </div>
        </div>

        <div className="text-xs flex flex-wrap justify-between gap-y-2 border-t border-zinc-800 pt-8">
          <a href={`https://studio.genlayer.com/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="hover:text-genlayer-primary">
            Contract: <span className="font-mono">{shortAddress(CONTRACT_ADDRESS)}</span>
          </a>
          <div className="flex gap-x-6 text-zinc-500">
            <div>Chain ID: 61999</div>
            <div>RPC: studio.genlayer.com/api</div>
          </div>
        </div>

        <div className="flex flex-col items-center mt-12">
          <div className="flex items-center gap-x-3">
            <p className="text-sm font-medium text-zinc-400">Powered by</p>
            <a href="https://docs.genlayer.com/" target="_blank" rel="noopener noreferrer">
              <Image src="/assets/genlayer/Genlayer-logo.png" alt="GenLayer" width={160} height={48} className="opacity-90 hover:opacity-100 transition-all" />
            </a>
          </div>
        </div>

        <div className="fixed bottom-6 right-6 bg-zinc-900 border border-zinc-700 px-5 py-2.5 rounded-3xl flex items-center gap-x-2 text-xs shadow-2xl hover:scale-105 transition-all">
          <span className="text-zinc-400">Built by</span>
          <a href="https://x.com/killsh0tx" target="_blank" rel="noopener noreferrer" className="font-semibold text-genlayer-primary hover:text-white">Superfly</a>
        </div>
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
