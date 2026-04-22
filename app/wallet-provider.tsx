"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { type Address } from "viem";

import { EthereumProvider, formatError, GENLAYER_CHAIN } from "@/lib/genlayer";

type WalletState = {
  account: Address | null;
  chainId: number | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  ensureNetwork: () => Promise<void>;
  provider: EthereumProvider | null;
  walletError: string | null;
};

const WalletContext = createContext<WalletState | null>(null);

function hexChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

function getProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { ethereum?: EthereumProvider }).ethereum ?? null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  async function readInitialState(nextProvider: EthereumProvider) {
    const accounts = (await nextProvider.request({ method: "eth_accounts" })) as string[];
    const chainHex = (await nextProvider.request({ method: "eth_chainId" })) as string;

    setAccount((accounts[0] as Address) ?? null);
    setChainId(Number.parseInt(chainHex, 16));
  }

  const ensureNetwork = useCallback(async () => {
    if (!provider) {
      throw new Error("MetaMask provider not found.");
    }

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId(GENLAYER_CHAIN.id) }]
      });
    } catch {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hexChainId(GENLAYER_CHAIN.id),
            chainName: GENLAYER_CHAIN.name,
            nativeCurrency: GENLAYER_CHAIN.currency,
            rpcUrls: [GENLAYER_CHAIN.rpcUrl]
          }
        ]
      });
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId(GENLAYER_CHAIN.id) }]
      });
    }

    setChainId(GENLAYER_CHAIN.id);
  }, [provider]);

  const connect = useCallback(async () => {
    const nextProvider = getProvider();
    if (!nextProvider) {
      setWalletError("MetaMask not found. Open this app in MetaMask or install the extension.");
      return;
    }

    setWalletError(null);
    setProvider(nextProvider);

    try {
      const accounts = (await nextProvider.request({ method: "eth_requestAccounts" })) as string[];
      const nextAccount = (accounts[0] as Address) ?? null;
      setAccount(nextAccount);
      await ensureNetwork();
    } catch (error) {
      setWalletError(formatError(error, "Failed to connect wallet."));
    }
  }, [ensureNetwork]);

  function disconnect() {
    setAccount(null);
    setWalletError(null);
  }

  useEffect(() => {
    const nextProvider = getProvider();
    if (!nextProvider) return;

    setProvider(nextProvider);
    void readInitialState(nextProvider).catch(() => {
      // keep quiet on boot
    });

    const onAccountsChanged = (accounts: unknown) => {
      if (Array.isArray(accounts) && accounts.length > 0) {
        setAccount(accounts[0] as Address);
      } else {
        setAccount(null);
      }
    };

    const onChainChanged = (nextChainId: unknown) => {
      if (typeof nextChainId === "string") {
        setChainId(Number.parseInt(nextChainId, 16));
      }
    };

    nextProvider.on?.("accountsChanged", onAccountsChanged);
    nextProvider.on?.("chainChanged", onChainChanged);

    return () => {
      nextProvider.removeListener?.("accountsChanged", onAccountsChanged);
      nextProvider.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      account,
      chainId,
      isConnected: !!account,
      isCorrectNetwork: chainId === GENLAYER_CHAIN.id,
      connect,
      disconnect,
      ensureNetwork,
      provider,
      walletError
    }),
    [account, chainId, connect, ensureNetwork, provider, walletError]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used inside WalletProvider.");
  }
  return ctx;
}
