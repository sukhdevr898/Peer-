import React, { useState } from 'react';
import {
  User,
  Users,
  ShieldCheck,
  Zap,
  Radio,
  Wifi,
  Edit2,
  Check,
  QrCode,
  Lock,
  Share2,
  Info,
  Server,
  ArrowRight,
} from 'lucide-react';
import { Peer, NetworkDiagnostics } from '../types';

interface SidebarProps {
  peerId: string;
  peerName: string;
  onUpdatePeerName: (name: string) => void;
  fingerprint: string;
  peers: Peer[];
  selectedPeerId: string | null;
  onSelectPeer: (peerId: string | null) => void;
  diagnostics: NetworkDiagnostics;
  onOpenSecurity: () => void;
  onOpenOffline: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  peerId,
  peerName,
  onUpdatePeerName,
  fingerprint,
  peers,
  selectedPeerId,
  onSelectPeer,
  diagnostics,
  onOpenSecurity,
  onOpenOffline,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(peerName);

  const saveName = () => {
    if (tempName.trim()) {
      onUpdatePeerName(tempName.trim());
    }
    setIsEditingName(false);
  };

  return (
    <aside className="w-full lg:w-80 flex flex-col gap-4 p-4 bg-slate-900/50 border-r border-slate-800/80 shrink-0">
      {/* My Identity Card */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 p-0.5 shadow-sm">
            <div className="w-full h-full rounded-[10px] bg-slate-950 flex items-center justify-center font-bold text-slate-100 text-sm">
              {peerName.slice(0, 2).toUpperCase()}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  className="bg-slate-800 border border-indigo-500 rounded px-2 py-0.5 text-xs text-white w-full font-medium focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={saveName}
                  className="p-1 rounded bg-indigo-600 text-white hover:bg-indigo-500"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-semibold text-sm text-white truncate">{peerName}</span>
                  <button
                    onClick={() => {
                      setTempName(peerName);
                      setIsEditingName(true);
                    }}
                    className="text-slate-400 hover:text-white p-0.5"
                    title="Edit handle"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
            <p className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
              Online • IP: {diagnostics.clientIp}
            </p>
          </div>
        </div>

        {/* Cryptographic key fingerprint */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1 font-mono text-slate-300">
            <Lock className="w-3 h-3 text-indigo-400" />
            <span className="truncate max-w-[170px]" title={`ECDH Fingerprint: ${fingerprint}`}>
              {fingerprint || 'Generating keys...'}
            </span>
          </div>
          <button
            onClick={onOpenSecurity}
            className="text-indigo-400 hover:text-indigo-300 font-medium text-[11px]"
          >
            Verify
          </button>
        </div>
      </div>

      {/* Connected Peers Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Peers ({peers.length})
            </h2>
          </div>
          {peers.length > 0 && (
            <button
              onClick={() => onSelectPeer(null)}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                selectedPeerId === null
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Broadcast (All)
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {peers.length === 0 ? (
            <div className="p-5 rounded-xl border border-dashed border-slate-800 text-center bg-slate-900/30">
              <Radio className="w-6 h-6 text-slate-600 mx-auto mb-2 animate-pulse" />
              <p className="text-xs font-medium text-slate-300">Waiting for peers to join...</p>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Share this room link with another device on your Wi-Fi or across the internet.
              </p>
            </div>
          ) : (
            peers.map((peer) => {
              const isSelected = selectedPeerId === peer.peerId;
              const isDirectLan = peer.connectionType === 'direct-lan';

              return (
                <div
                  key={peer.peerId}
                  onClick={() => onSelectPeer(isSelected ? null : peer.peerId)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md shadow-indigo-950/40'
                      : 'bg-slate-900/80 hover:bg-slate-850 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400 shrink-0">
                        {peer.peerName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-white truncate">
                            {peer.peerName}
                          </span>
                          {peer.isVerified && (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          {isDirectLan ? (
                            <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5" /> Direct LAN
                            </span>
                          ) : peer.connectionType === 'p2p-internet' ? (
                            <span className="text-cyan-400 font-medium flex items-center gap-0.5">
                              <Radio className="w-2.5 h-2.5" /> P2P WebRTC
                            </span>
                          ) : peer.connectionType === 'offline' ? (
                            <span className="text-amber-400 font-medium flex items-center gap-0.5">
                              <Wifi className="w-2.5 h-2.5" /> Air-Gapped
                            </span>
                          ) : (
                            <span className="text-indigo-400 font-medium flex items-center gap-0.5">
                              <Server className="w-2.5 h-2.5" /> Secure Relayed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SAS Emoji fingerprint pills */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSecurity();
                      }}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-xs hover:border-indigo-500"
                      title="Inspect Short Authentication String (SAS)"
                    >
                      {peer.sasEmojis.slice(0, 2).join('')}
                    </button>
                  </div>

                  {/* Local network speed benefit tag */}
                  {peer.isSameNetwork && (
                    <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Same Wi-Fi / LAN detected
                      </span>
                      <span className="text-slate-400 font-mono">Gbps Speed</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Network Diagnostics Info Box */}
      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-2">
        <div className="flex items-center justify-between font-semibold text-slate-300">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-400" /> Dual-Engine Routing
          </span>
          <span className="font-mono text-[10px] text-slate-400">{diagnostics.latencyMs}ms ping</span>
        </div>
        <div className="space-y-1.5 text-[11px] text-slate-400 leading-tight">
          <p className="flex items-start gap-1">
            <span className="text-emerald-400 font-bold">•</span>
            <span><strong className="text-slate-200">Local Speed Check:</strong> Direct device-to-device streaming when on the same Wi-Fi.</span>
          </p>
          <p className="flex items-start gap-1">
            <span className="text-indigo-400 font-bold">•</span>
            <span><strong className="text-slate-200">Public Relayed:</strong> Zero-knowledge encrypted relay when NAT or firewalls restrict P2P.</span>
          </p>
        </div>
      </div>
    </aside>
  );
};
