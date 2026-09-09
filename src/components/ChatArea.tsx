import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Lock,
  Check,
  CheckCheck,
  Clock,
  Zap,
  Server,
  Radio,
  Paperclip,
  Smile,
  Shield,
} from 'lucide-react';
import { ChatMessage, Peer } from '../types';

interface ChatAreaProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  myPeerId: string;
  selectedPeer?: Peer | null;
  onOpenFilePicker: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  onSendMessage,
  myPeerId,
  selectedPeer,
  onOpenFilePicker,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-900/30 rounded-2xl border border-slate-800/80 overflow-hidden">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {selectedPeer ? `Encrypted Direct Chat (${selectedPeer.peerName})` : 'Room Broadcast Chat (All Peers)'}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
          <Lock className="w-3 h-3" />
          <span>E2E Encrypted</span>
        </div>
      </div>

      {/* Message stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-3">
              <Shield className="w-6 h-6 text-indigo-400" />
            </div>
            <p className="text-sm font-semibold text-slate-300">End-to-End Encrypted Tunnel Active</p>
            <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
              Every message and chunk is encrypted with AES-256-GCM directly inside your browser before leaving your device. No plaintext touches the server.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === myPeerId;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {/* Sender name */}
                {!isMe && (
                  <span className="text-[11px] text-slate-400 font-medium ml-1 mb-1">
                    {msg.senderName}
                  </span>
                )}

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-sm relative leading-relaxed break-words ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-br-xs'
                      : 'bg-slate-800 border border-slate-700/80 text-slate-100 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Metadata line */}
                  <div
                    className={`flex items-center gap-1.5 mt-1 text-[10px] ${
                      isMe ? 'text-indigo-200 justify-end' : 'text-slate-400'
                    }`}
                  >
                    <span>{formatTime(msg.timestamp)}</span>

                    {msg.deliveryStatus === 'queued' && (
                      <span className="flex items-center gap-0.5 text-amber-300" title="Queued (Offline)">
                        <Clock className="w-3 h-3" /> Queued
                      </span>
                    )}

                    {msg.deliveryStatus === 'relayed' && (
                      <span className="flex items-center gap-0.5" title="Relayed through secure zero-knowledge node">
                        <Server className="w-3 h-3 text-indigo-300" /> Relayed
                      </span>
                    )}

                    {msg.deliveryStatus === 'delivered' && (
                      <span className="flex items-center gap-0.5" title="Delivered directly via WebRTC DataChannel">
                        {msg.isLocalNetwork ? (
                          <Zap className="w-3 h-3 text-emerald-300" title="Direct LAN" />
                        ) : (
                          <Radio className="w-3 h-3 text-cyan-300" title="Direct P2P" />
                        )}
                        <CheckCheck className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSend}
        className="p-3 border-t border-slate-800/80 bg-slate-900/80 flex items-end gap-2"
      >
        <button
          type="button"
          onClick={onOpenFilePicker}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors shrink-0"
          title="Attach file for peer transfer"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type an end-to-end encrypted message... (Enter to send)"
          rows={1}
          className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none max-h-32 min-h-[42px] custom-scrollbar"
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white shadow-md shadow-indigo-600/30 transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed"
          title="Send Encrypted Message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
