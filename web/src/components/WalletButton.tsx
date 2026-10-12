"use client";

import { useEffect, useRef, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { arc } from "../lib/wagmi";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function WalletIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" />
      <path d="M4 8h14.5A1.5 1.5 0 0 1 20 9.5v5A1.5 1.5 0 0 1 18.5 16H16a2.5 2.5 0 0 1 0-5h4" />
      <circle cx="16" cy="13.5" r=".5" fill="currentColor" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

function DisconnectIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
    </svg>
  );
}

export default function WalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const browserConnector =
    connectors.find((connector) => connector.id === "injected") ??
    connectors.find((connector) => connector.type === "injected") ??
    connectors.find(
      (connector) =>
        !connector.name.toLowerCase().includes("walletconnect")
    );

  const walletConnectConnector = connectors.find(
    (connector) =>
      connector.id.toLowerCase().includes("walletconnect") ||
      connector.name.toLowerCase().includes("walletconnect")
  );

  const visibleConnectors = connectors.filter(
    (connector) =>
      connector === browserConnector ||
      connector === walletConnectConnector
  );


  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!pickerOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPickerOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pickerOpen]);

  useEffect(() => {
    if (isConnected) setPickerOpen(false);
  }, [isConnected]);

  async function copyAddress() {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setCopyError("");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError("Copy failed. Please copy the address manually.");
    }
  }

  if (isConnected && address && chainId !== arc.id) {
    return (
      <button
        type="button"
        onClick={() => switchChain({ chainId: arc.id })}
        disabled={isSwitching}
        className="flex h-10 items-center gap-2 rounded-xl bg-amber-500 px-3 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
      >
        <WalletIcon className="h-4 w-4" />
        <span>{isSwitching ? "Switching..." : "Switch to Arc"}</span>
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex h-10 max-w-[170px] items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-2.5 text-xs font-semibold text-[#1747c8] transition hover:border-blue-200 hover:bg-blue-100 sm:px-3"
        >
          <WalletIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{shortenAddress(address)}</span>
          <svg
            viewBox="0 0 20 20"
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${menuOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m5 7 5 5 5-5" />
          </svg>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-[100] mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
          >
            <div className="border-b border-slate-100 px-3 py-3">
              <p className="text-xs font-medium text-slate-500">
                Connected wallet
              </p>
              <p className="mt-1 break-all text-sm font-semibold text-slate-900">
                {shortenAddress(address)}
              </p>
              <p className="mt-1 text-xs text-emerald-600">
                ● Connected
              </p>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={copyAddress}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <CopyIcon />
              <span>{copied ? "Address copied" : "Copy address"}</span>
            </button>

            <a
              role="menuitem"
              href={`https://explorer.arc.io/address/${address}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-700 hover:bg-slate-50"
            >
              <ExternalLinkIcon />
              <span>View on Arc Explorer</span>
            </a>

            {copyError && (
              <p className="px-3 py-2 text-xs text-red-600">{copyError}</p>
            )}

            <div className="my-1 border-t border-slate-100" />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                disconnect();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <DisconnectIcon />
              <span>Disconnect wallet</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        aria-label="Connect wallet"
        className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#1747c8]"
      >
        <WalletIcon className="h-4 w-4" />
        <span>Connect</span>
      </button>

      {pickerOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPickerOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-picker-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="wallet-picker-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Connect wallet
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose how you want to connect.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                aria-label="Close wallet picker"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-xl text-slate-500 hover:bg-slate-50"
              >
                ×
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {visibleConnectors.map((connector) => {
                const isWalletConnect = connector.name
                  .toLowerCase()
                  .includes("walletconnect");

                return (
                  <button
                    key={connector.uid}
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      connect(
                        { connector },
                        {
                          onSuccess: () => setPickerOpen(false),
                        }
                      )
                    }
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-4 text-left transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {isPending
                          ? "Connecting..."
                          : isWalletConnect
                            ? "WalletConnect"
                            : "Browser Wallet"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {isWalletConnect
                          ? "Connect with a compatible wallet app"
                          : "Use a wallet available in this browser"}
                      </p>
                    </div>

                    <span className="ml-3 text-slate-400">→</span>
                  </button>
                );
              })}
            </div>

            {error && (
              <div className="mt-4 break-words rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <strong>Connection failed:</strong> {error.message}
              </div>
            )}

            {connectors.length === 0 && (
              <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                No wallet connectors are configured.
              </p>
            )}

            <p className="mt-4 text-center text-xs leading-5 text-slate-400">
              Only wallets supported by your browser or WalletConnect will be
              available.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
