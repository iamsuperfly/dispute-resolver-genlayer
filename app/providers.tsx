"use client";

import { ReactNode } from "react";

import { WalletProvider } from "@/app/wallet-provider";

export default function Providers({ children }: { children: ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}
