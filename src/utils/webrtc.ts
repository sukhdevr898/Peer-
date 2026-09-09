/**
 * WebRTC DataChannel & PeerConnection manager
 * Handles direct P2P connections, local network candidate detection,
 * offline SDP exchange, and chunked encrypted file streaming.
 */

import { ConnectionMode, FileTransfer } from '../types';
import { encryptData, decryptData, computeSha256 } from './crypto';

export const CHUNK_SIZE = 48 * 1024; // 48KB chunks for optimal WebRTC MTU & AES-GCM efficiency

export interface WebRtcCallbacks {
  onChannelStateChange: (peerId: string, state: 'connecting' | 'connected' | 'disconnected' | 'failed') => void;
  onConnectionModeDetected: (peerId: string, mode: ConnectionMode) => void;
  onMessageReceived: (peerId: string, payload: any) => void;
  onFileChunkReceived: (peerId: string, chunkData: any) => void;
  onSignalGenerated: (targetPeerId: string, signalData: any) => void;
}

export class PeerConnectionWrapper {
  public pc: RTCPeerConnection;
  public dataChannel: RTCDataChannel | null = null;
  public peerId: string;
  public targetPeerId: string;
  public callbacks: WebRtcCallbacks;
  public sessionKey: CryptoKey | null = null;
  public connectionMode: ConnectionMode = 'p2p-internet';
  private iceCandidatesQueue: RTCIceCandidateInit[] = [];
  private statsInterval: any = null;

  constructor(peerId: string, targetPeerId: string, callbacks: WebRtcCallbacks) {
    this.peerId = peerId;
    this.targetPeerId = targetPeerId;
    this.callbacks = callbacks;

    // Standard STUN servers for NAT traversal
    const rtcConfig: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 4,
    };

    this.pc = new RTCPeerConnection(rtcConfig);
    this.setupPcEvents();
  }

  private setupPcEvents() {
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onSignalGenerated(this.targetPeerId, {
          type: 'candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      if (state === 'connected') {
        this.detectConnectionMode();
      } else if (state === 'failed' || state === 'disconnected') {
        this.callbacks.onChannelStateChange(this.targetPeerId, state);
      }
    };

    this.pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };
  }

  public createDataChannel(): RTCDataChannel {
    const channel = this.pc.createDataChannel('p2p-drop-data', {
      ordered: true,
    });
    this.setupDataChannel(channel);
    return channel;
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    this.dataChannel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      this.callbacks.onChannelStateChange(this.targetPeerId, 'connected');
      this.detectConnectionMode();
      this.startStatsPolling();
    };

    channel.onclose = () => {
      this.callbacks.onChannelStateChange(this.targetPeerId, 'disconnected');
      this.stopStatsPolling();
    };

    channel.onerror = () => {
      this.callbacks.onChannelStateChange(this.targetPeerId, 'failed');
    };

    channel.onmessage = (event) => {
      try {
        if (typeof event.data === 'string') {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'file-chunk') {
            this.callbacks.onFileChunkReceived(this.targetPeerId, parsed);
          } else {
            this.callbacks.onMessageReceived(this.targetPeerId, parsed);
          }
        }
      } catch (err) {
        console.error('Error handling data channel message:', err);
      }
    };
  }

  // Detect whether connection is Direct LAN (local network) vs Internet STUN vs Relayed
  public async detectConnectionMode() {
    try {
      const stats = await this.pc.getStats();
      let activeCandidatePair: any = null;

      stats.forEach((report) => {
        if (report.type === 'transport' && report.selectedCandidatePairId) {
          activeCandidatePair = stats.get(report.selectedCandidatePairId);
        } else if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
          activeCandidatePair = report;
        }
      });

      if (activeCandidatePair) {
        const localCandidate = stats.get(activeCandidatePair.localCandidateId);
        const remoteCandidate = stats.get(activeCandidatePair.remoteCandidateId);

        if (localCandidate && remoteCandidate) {
          // If both are 'host' candidates -> Direct Local Network / LAN
          const isLocal =
            localCandidate.candidateType === 'host' &&
            remoteCandidate.candidateType === 'host';

          const isRelay =
            localCandidate.candidateType === 'relay' ||
            remoteCandidate.candidateType === 'relay';

          let mode: ConnectionMode = 'p2p-internet';
          if (isLocal) {
            mode = 'direct-lan';
          } else if (isRelay) {
            mode = 'secure-relayed';
          }

          this.connectionMode = mode;
          this.callbacks.onConnectionModeDetected(this.targetPeerId, mode);
          return mode;
        }
      }
    } catch {
      // Fallback if stats check fails
    }
    return this.connectionMode;
  }

  private startStatsPolling() {
    this.stopStatsPolling();
    this.statsInterval = setInterval(() => {
      this.detectConnectionMode();
    }, 5000);
  }

  private stopStatsPolling() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  // Create WebRTC Offer
  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.createDataChannel();
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  // Handle incoming WebRTC Offer and create Answer
  public async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    // Flush queued candidates
    while (this.iceCandidatesQueue.length > 0) {
      const cand = this.iceCandidatesQueue.shift()!;
      await this.pc.addIceCandidate(new RTCIceCandidate(cand));
    }
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  // Handle incoming WebRTC Answer
  public async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    while (this.iceCandidatesQueue.length > 0) {
      const cand = this.iceCandidatesQueue.shift()!;
      await this.pc.addIceCandidate(new RTCIceCandidate(cand));
    }
  }

  // Add ICE Candidate
  public async addIceCandidate(candidateInit: RTCIceCandidateInit): Promise<void> {
    if (this.pc.remoteDescription && this.pc.remoteDescription.type) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidateInit));
    } else {
      this.iceCandidatesQueue.push(candidateInit);
    }
  }

  // Send raw string message over DataChannel
  public sendMessage(msg: string): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(msg);
      return true;
    }
    return false;
  }

  // Close connection cleanly
  public close() {
    this.stopStatsPolling();
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    this.pc.close();
  }
}

/**
 * Encrypted Chunked File Transfer Engine
 * Slices file, encrypts each chunk with session key, streams through DataChannel or Relay
 * with backpressure and throughput monitoring.
 */
export async function sendEncryptedFile(
  file: File,
  transferId: string,
  key: CryptoKey,
  sendChunkFn: (data: string) => Promise<boolean> | boolean,
  onProgress: (bytesSent: number, speed: number) => void
): Promise<string> {
  const totalBytes = file.size;
  const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);
  let bytesSent = 0;
  let lastTime = Date.now();
  let bytesSinceLast = 0;

  // Compute full file SHA-256 for integrity verification
  const fullBuffer = await file.arrayBuffer();
  const fileHash = await computeSha256(fullBuffer);

  // Send initial transfer header
  const header = {
    type: 'file-start',
    transferId,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || 'application/octet-stream',
    totalChunks,
    sha256: fileHash,
  };

  await sendChunkFn(JSON.stringify(header));

  // Stream each chunk
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalBytes);
    const chunkBytes = new Uint8Array(fullBuffer.slice(start, end));

    // End-to-End Encrypt chunk with AES-256-GCM
    const { iv, ciphertext } = await encryptData(chunkBytes, key);

    const chunkPayload = {
      type: 'file-chunk',
      transferId,
      chunkIndex: i,
      totalChunks,
      iv,
      ciphertext,
    };

    await sendChunkFn(JSON.stringify(chunkPayload));
    bytesSent += (end - start);
    bytesSinceLast += (end - start);

    const now = Date.now();
    const elapsed = (now - lastTime) / 1000;
    if (elapsed >= 0.25 || i === totalChunks - 1) {
      const speed = bytesSinceLast / (elapsed || 0.001);
      onProgress(bytesSent, speed);
      lastTime = now;
      bytesSinceLast = 0;
    }

    // Small yield to prevent event loop blocking
    if (i % 8 === 0) {
      await new Promise((r) => setTimeout(r, 1));
    }
  }

  // Send transfer completion marker
  const finishPayload = {
    type: 'file-finish',
    transferId,
    sha256: fileHash,
  };
  await sendChunkFn(JSON.stringify(finishPayload));

  return fileHash;
}

/**
 * File Assembler for receiving end
 */
export class FileReceiver {
  public transfer: FileTransfer;
  public chunks: Map<number, Uint8Array> = new Map();
  public receivedBytes = 0;
  public key: CryptoKey;
  public onProgress: (transfer: FileTransfer) => void;
  public onComplete: (transfer: FileTransfer, blob: Blob) => void;
  private lastTime = Date.now();
  private bytesSinceLast = 0;

  constructor(
    transfer: FileTransfer,
    key: CryptoKey,
    onProgress: (transfer: FileTransfer) => void,
    onComplete: (transfer: FileTransfer, blob: Blob) => void
  ) {
    this.transfer = transfer;
    this.key = key;
    this.onProgress = onProgress;
    this.onComplete = onComplete;
  }

  public async receiveChunk(chunkIndex: number, totalChunks: number, iv: string, ciphertext: string) {
    try {
      // Decrypt chunk
      const decryptedBytes = await decryptData(ciphertext, iv, this.key);
      this.chunks.set(chunkIndex, decryptedBytes);
      this.receivedBytes += decryptedBytes.byteLength;
      this.bytesSinceLast += decryptedBytes.byteLength;

      const now = Date.now();
      const elapsed = (now - this.lastTime) / 1000;
      let speed = this.transfer.speed;
      if (elapsed >= 0.25) {
        speed = this.bytesSinceLast / (elapsed || 0.001);
        this.lastTime = now;
        this.bytesSinceLast = 0;
      }

      this.transfer.transferredBytes = this.receivedBytes;
      this.transfer.progress = Math.min(100, Math.round((this.receivedBytes / this.transfer.fileSize) * 100));
      this.transfer.speed = speed;

      this.onProgress(this.transfer);

      // Check if all chunks received
      if (this.chunks.size === totalChunks) {
        await this.assembleFile();
      }
    } catch (err) {
      console.error('Error decrypting file chunk:', err);
      this.transfer.status = 'failed';
      this.onProgress(this.transfer);
    }
  }

  private async assembleFile() {
    const orderedChunks: Uint8Array[] = [];
    for (let i = 0; i < this.chunks.size; i++) {
      const chunk = this.chunks.get(i);
      if (chunk) {
        orderedChunks.push(chunk);
      }
    }

    const blob = new Blob(orderedChunks, { type: this.transfer.fileType });
    const arrayBuffer = await blob.arrayBuffer();
    const computedHash = await computeSha256(arrayBuffer);

    this.transfer.sha256 = computedHash;
    this.transfer.blobUrl = URL.createObjectURL(blob);
    this.transfer.status = 'completed';
    this.transfer.progress = 100;
    this.transfer.completedAt = Date.now();

    this.onComplete(this.transfer, blob);
  }
}
