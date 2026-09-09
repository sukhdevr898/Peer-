import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  WifiOff,
  QrCode,
  Copy,
  Check,
  Download,
  Upload,
  ArrowRight,
  Shield,
  X,
  FileCode,
  RefreshCw,
} from 'lucide-react';

interface OfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOfflineMode: boolean;
  onToggleOffline: () => void;
  onGenerateInvite: () => Promise<string>;
  onAcceptAnswer: (answerBase64: string) => Promise<boolean>;
}

export const OfflineModal: React.FC<OfflineModalProps> = ({
  isOpen,
  onClose,
  isOfflineMode,
  onToggleOffline,
  onGenerateInvite,
  onAcceptAnswer,
}) => {
  const [inviteToken, setInviteToken] = useState<string>('');
  const [answerInput, setAnswerInput] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [answerStatus, setAnswerStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (isOpen && !inviteToken) {
      handleGenerate();
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const token = await onGenerateInvite();
      setInviteToken(token);
      // Generate QR Code
      const qr = await QRCode.toDataURL(token, {
        width: 260,
        margin: 1.5,
        color: {
          dark: '#030712',
          light: '#f8fafc',
        },
      });
      setQrDataUrl(qr);
    } catch (err) {
      console.error('Failed to generate offline bundle:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(inviteToken);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerInput.trim()) return;

    const success = await onAcceptAnswer(answerInput.trim());
    if (success) {
      setAnswerStatus('success');
      setTimeout(() => {
        onClose();
        setAnswerStatus('idle');
      }, 1500);
    } else {
      setAnswerStatus('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <WifiOff className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Air-Gapped & Offline P2P Mode</h3>
              <p className="text-[11px] text-slate-400">Direct serverless WebRTC connection via QR / SDP tokens</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar text-xs">
          {/* Offline Mode Switch */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">Disconnect from Public Signaling Server</p>
              <p className="text-[11px] text-slate-400">Forces complete isolation and air-gapped direct exchange only.</p>
            </div>
            <button
              onClick={onToggleOffline}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                isOfflineMode
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {isOfflineMode ? 'Offline Active' : 'Go Offline'}
            </button>
          </div>

          {/* Step 1: Offer Token & QR Code */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                Your Air-Gapped Invitation Token
              </span>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                title="Regenerate Token"
              >
                <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>Regenerate</span>
              </button>
            </div>

            {/* QR Code */}
            {qrDataUrl && (
              <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-sm w-fit mx-auto">
                <img src={qrDataUrl} alt="Offline P2P QR Code" className="w-44 h-44" />
                <span className="text-[10px] text-slate-600 mt-1 font-mono">Scan on other device</span>
              </div>
            )}

            {/* Token String */}
            <div className="relative">
              <textarea
                readOnly
                value={inviteToken}
                rows={2}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-[10px] text-slate-300 resize-none select-all focus:outline-none"
              />
              <button
                onClick={copyToken}
                className="absolute right-2 bottom-2 px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[10px] flex items-center gap-1"
              >
                {copiedInvite ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedInvite ? 'Copied' : 'Copy Token'}</span>
              </button>
            </div>
          </div>

          {/* Step 2: Answer Token */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">2</span>
              Paste Remote Peer's Answer Token
            </span>
            <form onSubmit={handleAccept} className="space-y-2">
              <textarea
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                placeholder="Paste the base64 answer token received from the other peer..."
                rows={2}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-[10px] text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
              />
              <div className="flex items-center justify-between">
                {answerStatus === 'success' && (
                  <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Peer connection initialized!
                  </span>
                )}
                {answerStatus === 'error' && (
                  <span className="text-rose-400 text-xs font-semibold">
                    Invalid token format. Please re-check.
                  </span>
                )}
                {answerStatus === 'idle' && <div />}

                <button
                  type="submit"
                  disabled={!answerInput.trim()}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Connect Direct</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
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
