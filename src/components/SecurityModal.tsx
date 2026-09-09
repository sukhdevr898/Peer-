import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Key,
  KeyRound,
  X,
  Check,
  Copy,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Peer } from '../types';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  myFingerprint: string;
  myPublicKey: string;
  peers: Peer[];
  onVerifyPeer: (peerId: string) => void;
  roomPassword: string;
  onSetRoomPassword: (pwd: string) => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
  isOpen,
  onClose,
  myFingerprint,
  myPublicKey,
  peers,
  onVerifyPeer,
  roomPassword,
  onSetRoomPassword,
}) => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [pwdInput, setPwdInput] = useState(roomPassword);

  if (!isOpen) return null;

  const copyKey = () => {
    navigator.clipboard.writeText(myPublicKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    onSetRoomPassword(pwdInput);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Cryptographic Security & Verification</h3>
              <p className="text-[11px] text-slate-400">Zero-Trust End-to-End Encryption (AES-256-GCM + ECDH)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar text-xs">
          {/* Your Key Fingerprint */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-400" /> Your Safety Number Fingerprint
              </span>
              <button
                onClick={copyKey}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
              </button>
            </div>
            <div className="p-2 rounded bg-slate-900 font-mono text-emerald-400 text-xs tracking-wider break-all select-all border border-slate-800/80">
              {myFingerprint}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Derived from your browser's ephemeral Elliptic Curve Diffie-Hellman (P-256) public key.
            </p>
          </div>

          {/* Peer Authentication (SAS) */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-300 text-xs uppercase tracking-wider">
              Peer Verification (Anti-MITM)
            </h4>

            {peers.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic p-3 rounded-lg bg-slate-950/40 border border-slate-800/50">
                No peers connected yet. When a peer connects, verify that both screens display the identical safety symbols below.
              </p>
            ) : (
              peers.map((peer) => (
                <div
                  key={peer.peerId}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{peer.peerName}</span>
                    <button
                      onClick={() => onVerifyPeer(peer.peerId)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                        peer.isVerified
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{peer.isVerified ? 'Verified Match' : 'Mark as Verified'}</span>
                    </button>
                  </div>

                  {/* Safety symbols */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{peer.sasEmojis.join(' ')}</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        ({peer.fingerprint.slice(0, 9)})
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono">Shared Secret Match</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Custom Room Passphrase */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <h4 className="font-semibold text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" /> Optional Room Pre-Shared Passphrase
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Enforce a second layer of encryption with PBKDF2 (100,000 iterations). Only peers who enter the exact password can decrypt messages and files.
            </p>
            <form onSubmit={handleSavePassword} className="flex gap-2 pt-1">
              <input
                type="password"
                value={pwdInput}
                onChange={(e) => setPwdInput(e.target.value)}
                placeholder="Enter custom room passphrase..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors"
              >
                Save
              </button>
            </form>
          </div>

          {/* Zero-Trust Architecture Guarantee */}
          <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-900/40 text-[11px] text-indigo-200/90 leading-relaxed flex items-start gap-2">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <strong>Pure Zero-Knowledge Relay:</strong> When transferring over the internet or when fallback relay is used, the server only routes opaque AES-GCM ciphertext. The encryption keys remain strictly inside your browser.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
