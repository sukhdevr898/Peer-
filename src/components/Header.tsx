import React from 'react';
import {
  ShieldCheck,
  Wifi,
  WifiOff,
  Zap,
  Radio,
  Lock,
  QrCode,
  KeyRound,
  ExternalLink,
  Copy,
  Check,
  Activity,
} from 'lucide-react';
import { ConnectionMode, NetworkDiagnostics } from '../types';

interface HeaderProps {
  roomId: string;
  peerCount: number;
  diagnostics: NetworkDiagnostics;
  isOfflineMode: boolean;
  onToggleOffline: () => void;
  onOpenSecurity: () => void;
  onOpenOfflineModal: () => void;
  onOpenRoomModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  roomId,
  peerCount,
  diagnostics,
  isOfflineMode,
  onToggleOffline,
  onOpenSecurity,
  onOpenOfflineModal,
  onOpenRoomModal,
}) => {
  const [copied, setCopied] = React.useState(false);

  const copyRoomLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getModeBadge = (mode: ConnectionMode) => {
    if (isOfflineMode) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-medium">
          <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          <span>Air-Gapped Offline</span>
        </div>
      );
    }

    switch (mode) {
      case 'direct-lan':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-sm shadow-emerald-900/30">
            <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Local Network (LAN Turbo)</span>
          </div>
        );
      case 'p2p-internet':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-medium">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>Direct P2P Internet</span>
          </div>
        );
      case 'secure-relayed':
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Secure Relayed</span>
          </div>
        );
    }
  };

  return (
    <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand identity */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-emerald-500 shadow-md shadow-indigo-500/20 text-white font-bold text-lg">
              <Lock className="w-5 h-5" />
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base lg:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  PeerDrop <span className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">E2EE</span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <span>Room:</span>
                <button
                  onClick={onOpenRoomModal}
                  className="font-mono text-slate-200 hover:text-indigo-400 font-semibold transition-colors underline decoration-dotted decoration-slate-600 underline-offset-2"
                  title="Change Room"
                >
                  {roomId}
                </button>
                <span className="text-slate-600">•</span>
                <span className={peerCount > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                  {peerCount} {peerCount === 1 ? 'peer' : 'peers'} connected
                </span>
              </p>
            </div>
          </div>

          {/* Quick mobile copy link */}
          <div className="flex md:hidden items-center gap-1.5">
            <button
              onClick={copyRoomLink}
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
              title="Copy Room Link"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active connection mode badge */}
          {getModeBadge(diagnostics.activeMode)}

          {/* E2EE badge */}
          <button
            onClick={onOpenSecurity}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all"
            title="View End-to-End Encryption Keys and Verification"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-[11px]">AES-256-GCM</span>
          </button>

          {/* Offline / Air-Gap toggle */}
          <button
            onClick={onOpenOfflineModal}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
              isOfflineMode
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Air-Gapped Offline P2P Transfer"
          >
            {isOfflineMode ? <WifiOff className="w-3.5 h-3.5 text-amber-400" /> : <QrCode className="w-3.5 h-3.5" />}
            <span>Air-Gap / Offline</span>
          </button>

          {/* Room share button */}
          <button
            onClick={copyRoomLink}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm shadow-indigo-600/30 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Link Copied' : 'Share Room'}</span>
          </button>

          {/* Test in 2nd tab button */}
          <a
            href={`${window.location.origin}${window.location.pathname}#room=${roomId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs transition-colors"
            title="Open in new window to test P2P transfer between two devices/tabs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>New Peer Tab</span>
          </a>
        </div>
      </div>
    </header>
  );
};
