export type ConnectionMode = 'direct-lan' | 'p2p-internet' | 'secure-relayed' | 'offline';

export interface Peer {
  peerId: string;
  peerName: string;
  publicKey: string;
  isSameNetwork: boolean;
  networkType: 'local' | 'internet';
  connectionType: ConnectionMode;
  channelState: 'connecting' | 'connected' | 'disconnected' | 'failed';
  fingerprint: string;
  sasEmojis: string[];
  isVerified: boolean;
  lastSeen?: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  isEncrypted: boolean;
  deliveryStatus: 'queued' | 'sending' | 'delivered' | 'relayed';
  isLocalNetwork: boolean;
  peerId?: string; // target or origin peer
}

export interface FileTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  direction: 'upload' | 'download';
  peerId: string;
  peerName: string;
  transferredBytes: number;
  progress: number;
  speed: number; // bytes per second
  status: 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled';
  sha256?: string;
  blobUrl?: string;
  isLocalNetwork: boolean;
  isRelayed: boolean;
  startedAt: number;
  completedAt?: number;
}

export interface EncryptedEnvelope {
  iv: string;
  ciphertext: string;
  keyFingerprint?: string;
}

export interface SignalingMessage {
  type: 'join' | 'room-joined' | 'peer-joined' | 'peer-left' | 'signal' | 'encrypted-relay-message' | 'encrypted-relay-chunk' | 'ping' | 'pong';
  roomId?: string;
  peerId?: string;
  senderPeerId?: string;
  targetPeerId?: string;
  peerName?: string;
  publicKey?: string;
  clientNetworkHint?: string;
  signalData?: any;
  payload?: any;
  chunkData?: any;
  remoteAddress?: string;
  peer?: {
    peerId: string;
    peerName: string;
    publicKey: string;
    isSameNetwork: boolean;
    networkType: 'local' | 'internet';
  };
  peers?: Array<{
    peerId: string;
    peerName: string;
    publicKey: string;
    isSameNetwork: boolean;
    networkType: 'local' | 'internet';
  }>;
}

export interface NetworkDiagnostics {
  clientIp: string;
  isOnline: boolean;
  sameNetworkDetected: boolean;
  activeMode: ConnectionMode;
  latencyMs: number;
  totalBytesSent: number;
  totalBytesReceived: number;
  currentTransferRate: number; // bytes/sec
}

export interface SecuritySettings {
  roomPassword?: string;
  requireSasVerification: boolean;
  forceRelayMode: boolean;
}
