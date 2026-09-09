import React, { useState } from 'react';
import { usePeerNetwork } from './hooks/usePeerNetwork';
import { Peer } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { FileTransferHub } from './components/FileTransferHub';
import { SecurityModal } from './components/SecurityModal';
import { OfflineModal } from './components/OfflineModal';
import { RoomModal } from './components/RoomModal';
import {
  MessageSquare,
  ArrowDownUp,
  Zap,
  ShieldCheck,
  Radio,
  ExternalLink,
  Wifi,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

export default function App() {
  const {
    peerId,
    peerName,
    setPeerName,
    roomId,
    setRoomId,
    publicKeyBase64,
    fingerprint,
    roomPassword,
    setRoomPassword,
    peers,
    selectedPeerId,
    setSelectedPeerId,
    messages,
    fileTransfers,
    diagnostics,
    isOfflineMode,
    setIsOfflineMode,
    sendMessage,
    sendFile,
    generateOfflineInvite,
    acceptOfflineAnswer,
    verifyPeer,
  } = usePeerNetwork();

  // Active view tab on mobile / standard screens: 'all' | 'chat' | 'files'
  const [activeTab, setActiveTab] = useState<'all' | 'chat' | 'files'>('all');

  // Modals state
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);

  const selectedPeer: Peer | null = peers.find((p: Peer) => p.peerId === selectedPeerId) || null;

  const handleSimulateSecondTab = () => {
    const url = `${window.location.origin}${window.location.pathname}#room=${roomId}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <Header
        roomId={roomId}
        peerCount={peers.length}
        diagnostics={diagnostics}
        isOfflineMode={isOfflineMode}
        onToggleOffline={() => setIsOfflineMode(!isOfflineMode)}
        onOpenSecurity={() => setShowSecurityModal(true)}
        onOpenOfflineModal={() => setShowOfflineModal(true)}
        onOpenRoomModal={() => setShowRoomModal(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto flex flex-col lg:flex-row overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          peerId={peerId}
          peerName={peerName}
          onUpdatePeerName={setPeerName}
          fingerprint={fingerprint}
          peers={peers}
          selectedPeerId={selectedPeerId}
          onSelectPeer={setSelectedPeerId}
          diagnostics={diagnostics}
          onOpenSecurity={() => setShowSecurityModal(true)}
          onOpenOffline={() => setShowOfflineModal(true)}
        />

        {/* Central Workspace */}
        <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-6 gap-4 overflow-y-auto custom-scrollbar">
          {/* Top Notice / Peer Discovery Helper */}
          {peers.length === 0 && (
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="font-semibold text-white">Ready for Instant Peer-to-Peer Transfer</p>
                  <p className="text-[11px] text-slate-400">
                    Open a second tab or share room link with another device on your network or over the internet.
                  </p>
                </div>
              </div>
              <button
                onClick={handleSimulateSecondTab}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm transition-colors shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Peer in 2nd Tab</span>
              </button>
            </div>
          )}

          {/* View Tab Selector */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Split View</span>
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === 'files'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArrowDownUp className="w-3.5 h-3.5" />
                <span>File Sharing ({fileTransfers.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === 'chat'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat ({messages.length})</span>
              </button>
            </div>

            {/* Same Network Transfer Speed Badge */}
            {diagnostics.sameNetworkDetected ? (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Same Network: LAN Ultra Speed</span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>End-to-End Encrypted Tunnel</span>
              </div>
            )}
          </div>

          {/* Dynamic Content Layout */}
          <div className="flex-1 flex flex-col min-h-0">
            {activeTab === 'all' && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 flex-1 min-h-[550px]">
                {/* File Drop & Transfers Hub */}
                <div className="xl:col-span-6 flex flex-col gap-4">
                  <FileTransferHub
                    transfers={fileTransfers}
                    onSendFile={(file) => sendFile(file, selectedPeerId || undefined)}
                    selectedPeerName={selectedPeer?.peerName}
                  />
                </div>

                {/* Encrypted Chat Stream */}
                <div className="xl:col-span-6 flex flex-col min-h-[400px]">
                  <ChatArea
                    messages={messages}
                    onSendMessage={(text) => sendMessage(text, selectedPeerId || undefined)}
                    myPeerId={peerId}
                    selectedPeer={selectedPeer}
                    onOpenFilePicker={() => {
                      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                      input?.click();
                    }}
                  />
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <div className="max-w-3xl w-full mx-auto py-2">
                <FileTransferHub
                  transfers={fileTransfers}
                  onSendFile={(file) => sendFile(file, selectedPeerId || undefined)}
                  selectedPeerName={selectedPeer?.peerName}
                />
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="max-w-4xl w-full mx-auto h-[600px] flex flex-col py-2">
                <ChatArea
                  messages={messages}
                  onSendMessage={(text) => sendMessage(text, selectedPeerId || undefined)}
                  myPeerId={peerId}
                  selectedPeer={selectedPeer}
                  onOpenFilePicker={() => {
                    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                    input?.click();
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <SecurityModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        myFingerprint={fingerprint}
        myPublicKey={publicKeyBase64}
        peers={peers}
        onVerifyPeer={verifyPeer}
        roomPassword={roomPassword}
        onSetRoomPassword={setRoomPassword}
      />

      <OfflineModal
        isOpen={showOfflineModal}
        onClose={() => setShowOfflineModal(false)}
        isOfflineMode={isOfflineMode}
        onToggleOffline={() => setIsOfflineMode(!isOfflineMode)}
        onGenerateInvite={generateOfflineInvite}
        onAcceptAnswer={acceptOfflineAnswer}
      />

      <RoomModal
        isOpen={showRoomModal}
        onClose={() => setShowRoomModal(false)}
        currentRoomId={roomId}
        onSetRoomId={setRoomId}
      />
    </div>
  );
}
