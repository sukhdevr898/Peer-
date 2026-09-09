import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Hash,
  Copy,
  Check,
  X,
  Share2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoomId: string;
  onSetRoomId: (newRoom: string) => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  onClose,
  currentRoomId,
  onSetRoomId,
}) => {
  const [roomInput, setRoomInput] = useState(currentRoomId);
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  const roomUrl = `${window.location.origin}${window.location.pathname}#room=${currentRoomId}`;

  useEffect(() => {
    setRoomInput(currentRoomId);
    if (isOpen) {
      QRCode.toDataURL(roomUrl, {
        width: 240,
        margin: 1.5,
        color: { dark: '#020617', light: '#f8fafc' },
      }).then(setQrCodeUrl);
    }
  }, [isOpen, currentRoomId, roomUrl]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomInput.trim()) {
      onSetRoomId(roomInput.trim());
      onClose();
    }
  };

  const handleRandomize = () => {
    const random = 'vault-' + Math.random().toString(36).substring(2, 8);
    setRoomInput(random);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Share or Change Room</h3>
              <p className="text-[11px] text-slate-400">Join a shared encrypted space with other devices</p>
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
        <div className="p-5 space-y-4 text-xs">
          {/* QR Code */}
          {qrCodeUrl && (
            <div className="flex flex-col items-center justify-center p-4 bg-slate-950/60 rounded-xl border border-slate-800">
              <div className="p-2 bg-white rounded-xl shadow-md">
                <img src={qrCodeUrl} alt="Room QR Code" className="w-40 h-40" />
              </div>
              <p className="text-[11px] text-slate-400 mt-2 font-mono">
                Scan with phone camera to connect
              </p>
            </div>
          )}

          {/* Copy Link Button */}
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={roomUrl}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono select-all focus:outline-none"
            />
            <button
              onClick={copyLink}
              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Change Room ID form */}
          <form onSubmit={handleSave} className="space-y-2 pt-2 border-t border-slate-800">
            <label className="text-slate-300 font-semibold block">Change Room Name / Key</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="e.g. project-apollo"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleRandomize}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
                title="Random Room ID"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs"
              >
                Switch
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
