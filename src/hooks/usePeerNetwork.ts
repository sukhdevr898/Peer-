import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Peer,
  ChatMessage,
  FileTransfer,
  ConnectionMode,
  NetworkDiagnostics,
  SignalingMessage,
} from '../types';
import {
  generateEcdhKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  deriveKeyFromPassphrase,
  encryptData,
  decryptString,
  generateFingerprint,
  generateSas,
} from '../utils/crypto';
import {
  PeerConnectionWrapper,
  sendEncryptedFile,
  FileReceiver,
} from '../utils/webrtc';

export function usePeerNetwork() {
  // Local identity
  const [peerId] = useState<string>(() => {
    const saved = sessionStorage.getItem('peer_id');
    if (saved) return saved;
    const generated = 'p_' + Math.random().toString(36).substring(2, 10);
    sessionStorage.setItem('peer_id', generated);
    return generated;
  });

  const [peerName, setPeerNameState] = useState<string>(() => {
    const saved = localStorage.getItem('peer_name');
    if (saved) return saved;
    const names = ['Quantum', 'Cipher', 'Vortex', 'Shield', 'Nexus', 'Echo', 'Prism', 'Apex'];
    const random = names[Math.floor(Math.random() * names.length)] + '-' + Math.floor(100 + Math.random() * 900);
    localStorage.setItem('peer_name', random);
    return random;
  });

  const [roomId, setRoomIdState] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '');
    const match = hash.match(/room=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    return 'vault-' + Math.random().toString(36).substring(2, 7);
  });

  const [keyPair, setKeyPair] = useState<CryptoKeyPair | null>(null);
  const [publicKeyBase64, setPublicKeyBase64] = useState<string>('');
  const [fingerprint, setFingerprint] = useState<string>('');
  const [roomPassword, setRoomPassword] = useState<string>('');

  // Peers state
  const [peers, setPeers] = useState<Map<string, Peer>>(() => new Map<string, Peer>());
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);

  // Messages and transfers
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [fileTransfers, setFileTransfers] = useState<Map<string, FileTransfer>>(() => new Map<string, FileTransfer>());

  // Network and modes
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [diagnostics, setDiagnostics] = useState<NetworkDiagnostics>({
    clientIp: 'Detecting...',
    isOnline: navigator.onLine,
    sameNetworkDetected: false,
    activeMode: 'p2p-internet',
    latencyMs: 12,
    totalBytesSent: 0,
    totalBytesReceived: 0,
    currentTransferRate: 0,
  });

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, PeerConnectionWrapper>>(new Map());
  const sessionKeysRef = useRef<Map<string, CryptoKey>>(new Map());
  const fileReceiversRef = useRef<Map<string, FileReceiver>>(new Map());
  const offlineOutboxRef = useRef<ChatMessage[]>([]);

  // Update Peer Name
  const setPeerName = (name: string) => {
    setPeerNameState(name);
    localStorage.setItem('peer_name', name);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'join',
          roomId,
          peerId,
          peerName: name,
          publicKey: publicKeyBase64,
        })
      );
    }
  };

  // Switch Room
  const setRoomId = (newRoom: string) => {
    const cleanRoom = newRoom.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'vault-default';
    setRoomIdState(cleanRoom);
    window.location.hash = `room=${cleanRoom}`;
    // Reconnect to new room
    reconnectToRoom(cleanRoom);
  };

  // Initialize Cryptographic Keys on load
  useEffect(() => {
    async function initCrypto() {
      try {
        const kp = await generateEcdhKeyPair();
        const pubBase64 = await exportPublicKey(kp.publicKey);
        const fp = await generateFingerprint(pubBase64);

        setKeyPair(kp);
        setPublicKeyBase64(pubBase64);
        setFingerprint(fp);
      } catch (err) {
        console.error('Crypto initialization failed:', err);
      }
    }
    initCrypto();
  }, []);

  // Fetch Network Info from server endpoint
  useEffect(() => {
    async function checkNetwork() {
      try {
        const res = await fetch('/api/network-info');
        if (res.ok) {
          const data = await res.json();
          setDiagnostics((prev) => ({
            ...prev,
            clientIp: data.clientIp || '127.0.0.1',
          }));
        }
      } catch {
        setDiagnostics((prev) => ({ ...prev, clientIp: 'Offline / Isolated' }));
      }
    }
    checkNetwork();
  }, []);

  // Reconnection helper
  const reconnectToRoom = useCallback((roomToJoin: string) => {
    // Close existing WebRTC connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    setPeers(new Map());

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Setup / maintain WebSocket connection
  useEffect(() => {
    if (isOfflineMode || !publicKeyBase64) return;

    let isMounted = true;
    let pingInterval: any = null;

    function connectWs() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setDiagnostics((prev) => ({ ...prev, isOnline: true }));

        // Join room
        ws.send(
          JSON.stringify({
            type: 'join',
            roomId,
            peerId,
            peerName,
            publicKey: publicKeyBase64,
            clientNetworkHint: window.location.hostname,
          })
        );

        // Heartbeat
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const start = Date.now();
            ws.send(JSON.stringify({ type: 'ping' }));
            (ws as any).lastPingTime = start;
          }
        }, 15000);
      };

      ws.onmessage = async (event) => {
        try {
          const msg: SignalingMessage = JSON.parse(event.data);

          if (msg.type === 'pong') {
            const latency = Date.now() - ((ws as any).lastPingTime || Date.now());
            setDiagnostics((prev) => ({ ...prev, latencyMs: Math.max(1, latency) }));
            return;
          }

          if (msg.type === 'room-joined') {
            if (msg.remoteAddress) {
              setDiagnostics((prev) => ({ ...prev, clientIp: msg.remoteAddress! }));
            }
            if (msg.peers) {
              msg.peers.forEach((remotePeer) => {
                handlePeerJoined(remotePeer);
              });
            }
          }

          if (msg.type === 'peer-joined' && msg.peer) {
            handlePeerJoined(msg.peer);
          }

          if (msg.type === 'peer-left' && msg.peerId) {
            handlePeerLeft(msg.peerId);
          }

          if (msg.type === 'signal' && msg.senderPeerId && msg.signalData) {
            handleIncomingSignal(msg.senderPeerId, msg.signalData);
          }

          if (msg.type === 'encrypted-relay-message' && msg.senderPeerId && msg.payload) {
            handleIncomingRelayedMessage(msg.senderPeerId, msg.payload);
          }

          if (msg.type === 'encrypted-relay-chunk' && msg.senderPeerId && msg.chunkData) {
            handleIncomingRelayedChunk(msg.senderPeerId, msg.chunkData);
          }
        } catch (err) {
          console.error('Error handling WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setDiagnostics((prev) => ({ ...prev, isOnline: false }));
        clearInterval(pingInterval);
        // Auto reconnect after 3s
        setTimeout(() => {
          if (isMounted && !isOfflineMode) connectWs();
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connectWs();

    return () => {
      isMounted = false;
      clearInterval(pingInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomId, peerId, publicKeyBase64, isOfflineMode]);

  // Derive cryptographic session key with peer
  const getOrDeriveSessionKey = useCallback(
    async (remotePeerId: string, remotePublicKeyBase64: string): Promise<CryptoKey | null> => {
      if (sessionKeysRef.current.has(remotePeerId)) {
        return sessionKeysRef.current.get(remotePeerId)!;
      }

      try {
        let key: CryptoKey;
        if (roomPassword.trim()) {
          // Pre-shared Room Passphrase
          key = await deriveKeyFromPassphrase(roomPassword.trim());
        } else {
          // ECDH P-256 Key Agreement
          if (!keyPair || !remotePublicKeyBase64) return null;
          const remoteCryptoKey = await importPublicKey(remotePublicKeyBase64);
          key = await deriveSharedKey(keyPair.privateKey, remoteCryptoKey);
        }

        sessionKeysRef.current.set(remotePeerId, key);
        return key;
      } catch (err) {
        console.error('Failed to derive session key with peer:', remotePeerId, err);
        return null;
      }
    },
    [keyPair, roomPassword]
  );

  // Handle peer joined event
  const handlePeerJoined = useCallback(
    async (remotePeer: {
      peerId: string;
      peerName: string;
      publicKey: string;
      isSameNetwork: boolean;
      networkType: 'local' | 'internet';
    }) => {
      const { peerId: remoteId, peerName: remoteName, publicKey: remotePub, isSameNetwork } = remotePeer;

      // Calculate Fingerprint and SAS Emojis for MITM verification
      const fp = await generateFingerprint(remotePub);
      const sas = await generateSas(publicKeyBase64, remotePub);

      const newPeer: Peer = {
        peerId: remoteId,
        peerName: remoteName,
        publicKey: remotePub,
        isSameNetwork,
        networkType: isSameNetwork ? 'local' : 'internet',
        connectionType: isSameNetwork ? 'direct-lan' : 'p2p-internet',
        channelState: 'connecting',
        fingerprint: fp,
        sasEmojis: sas.emojis,
        isVerified: false,
        lastSeen: Date.now(),
      };

      setPeers((prev) => {
        const next = new Map(prev);
        next.set(remoteId, newPeer);
        return next;
      });

      // Update Diagnostics
      setDiagnostics((prev) => ({
        ...prev,
        sameNetworkDetected: isSameNetwork || prev.sameNetworkDetected,
      }));

      // Initialize session key
      await getOrDeriveSessionKey(remoteId, remotePub);

      // Create WebRTC connection wrapper
      createOrGetPeerConnection(remoteId, remotePub);

      // Politeness role: Higher peerId initiates the WebRTC offer
      if (peerId > remoteId) {
        setTimeout(async () => {
          const wrapper = peerConnectionsRef.current.get(remoteId);
          if (wrapper) {
            try {
              const offer = await wrapper.createOffer();
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                  JSON.stringify({
                    type: 'signal',
                    targetPeerId: remoteId,
                    senderPeerId: peerId,
                    signalData: { type: 'offer', sdp: offer.sdp },
                  })
                );
              }
            } catch (err) {
              console.error('Failed to create offer for peer:', remoteId, err);
            }
          }
        }, 150);
      }
    },
    [peerId, publicKeyBase64, getOrDeriveSessionKey]
  );

  // Handle peer left event
  const handlePeerLeft = useCallback((remotePeerId: string) => {
    const wrapper = peerConnectionsRef.current.get(remotePeerId);
    if (wrapper) {
      wrapper.close();
      peerConnectionsRef.current.delete(remotePeerId);
    }
    sessionKeysRef.current.delete(remotePeerId);

    setPeers((prev) => {
      const next = new Map(prev);
      next.delete(remotePeerId);
      return next;
    });
  }, []);

  // WebRTC Signal generated callback
  const handleSignalGenerated = useCallback(
    (targetPeerId: string, signalData: any) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'signal',
            targetPeerId,
            senderPeerId: peerId,
            signalData,
          })
        );
      }
    },
    [peerId]
  );

  // Create or get RTCPeerConnection wrapper
  const createOrGetPeerConnection = useCallback(
    (remotePeerId: string, remotePublicKey: string): PeerConnectionWrapper => {
      if (peerConnectionsRef.current.has(remotePeerId)) {
        return peerConnectionsRef.current.get(remotePeerId)!;
      }

      const wrapper = new PeerConnectionWrapper(peerId, remotePeerId, {
        onChannelStateChange: (targetId, state) => {
          setPeers((prev) => {
            const next = new Map<string, Peer>(prev);
            const p = next.get(targetId);
            if (p) {
              // If failed or disconnected, automatically fallback to secure relayed connection
              next.set(targetId, {
                ...p,
                channelState: state === 'connected' ? 'connected' : 'connected',
                connectionType: state === 'connected' ? p.connectionType : 'secure-relayed',
              });
            }
            return next;
          });
        },
        onConnectionModeDetected: (targetId, mode) => {
          setPeers((prev) => {
            const next = new Map<string, Peer>(prev);
            const p = next.get(targetId);
            if (p) {
              next.set(targetId, { ...p, connectionType: mode });
            }
            return next;
          });
          setDiagnostics((prev) => ({ ...prev, activeMode: mode }));
        },
        onMessageReceived: async (targetId, payload) => {
          await processDecryptedMessage(targetId, payload);
        },
        onFileChunkReceived: async (targetId, chunkData) => {
          await processDecryptedFileChunk(targetId, chunkData);
        },
        onSignalGenerated: handleSignalGenerated,
      });

      peerConnectionsRef.current.set(remotePeerId, wrapper);
      return wrapper;
    },
    [peerId, handleSignalGenerated]
  );

  // Handle incoming signaling messages (offers, answers, ICE candidates)
  const handleIncomingSignal = useCallback(
    async (senderPeerId: string, signalData: any) => {
      const wrapper = peerConnectionsRef.current.get(senderPeerId);
      if (!wrapper) return;

      try {
        if (signalData.type === 'offer') {
          const answer = await wrapper.handleOffer({
            type: 'offer',
            sdp: signalData.sdp,
          });
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'signal',
                targetPeerId: senderPeerId,
                senderPeerId: peerId,
                signalData: { type: 'answer', sdp: answer.sdp },
              })
            );
          }
        } else if (signalData.type === 'answer') {
          await wrapper.handleAnswer({
            type: 'answer',
            sdp: signalData.sdp,
          });
        } else if (signalData.type === 'candidate' && signalData.candidate) {
          await wrapper.addIceCandidate(signalData.candidate);
        }
      } catch (err) {
        console.error('Error in WebRTC signaling exchange:', err);
      }
    },
    [peerId]
  );

  // Process decrypted chat message
  const processDecryptedMessage = async (senderId: string, payload: any) => {
    try {
      const key = sessionKeysRef.current.get(senderId);
      if (!key) return;

      const decryptedText = await decryptString(payload.ciphertext, payload.iv, key);
      const peer = peers.get(senderId);

      const msg: ChatMessage = {
        id: payload.id || 'msg_' + Math.random().toString(36).substring(2, 9),
        senderId,
        senderName: peer ? peer.peerName : `Peer-${senderId.slice(0, 4)}`,
        content: decryptedText,
        timestamp: payload.timestamp || Date.now(),
        isEncrypted: true,
        deliveryStatus: payload.isRelayed ? 'relayed' : 'delivered',
        isLocalNetwork: peer ? peer.connectionType === 'direct-lan' : false,
      };

      setMessages((prev) => [...prev, msg]);
    } catch (err) {
      console.error('Failed to decrypt incoming message:', err);
    }
  };

  // Process decrypted file chunk
  const processDecryptedFileChunk = async (senderId: string, chunkData: any) => {
    try {
      const { type, transferId } = chunkData;

      if (type === 'file-start') {
        const key = sessionKeysRef.current.get(senderId);
        if (!key) return;

        const peer = peers.get(senderId);
        const newTransfer: FileTransfer = {
          id: transferId,
          fileName: chunkData.fileName,
          fileSize: chunkData.fileSize,
          fileType: chunkData.fileType,
          direction: 'download',
          peerId: senderId,
          peerName: peer ? peer.peerName : `Peer-${senderId.slice(0, 4)}`,
          transferredBytes: 0,
          progress: 0,
          speed: 0,
          status: 'transferring',
          sha256: chunkData.sha256,
          isLocalNetwork: peer ? peer.connectionType === 'direct-lan' : false,
          isRelayed: Boolean(chunkData.isRelayed),
          startedAt: Date.now(),
        };

        const receiver = new FileReceiver(
          newTransfer,
          key,
          (updated) => {
            setFileTransfers((prev) => {
              const next = new Map<string, FileTransfer>(prev);
              next.set(transferId, { ...updated });
              return next;
            });
          },
          (completed) => {
            setFileTransfers((prev) => {
              const next = new Map<string, FileTransfer>(prev);
              next.set(transferId, { ...completed });
              return next;
            });
            // Play notification sound
            try {
              const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcHCek3/PFk1A3M2mv3fDGmFk8NV+o0uvMmF5BOGCfzuTVpWlRQleKx+DTp21ZTVuNx93To25bT1qKw9rPnW9dUlaIvtjLmW5gU1N+sc7DmXFoVkt2qsC6lnZqW0ltpratkWtlV0ZnnquhkGZlVEhgmKaXh2VnU0NckpuPf2lkTERWipKCeGljS0FLf4eAd2diRT5AfYSAdGZhQTs+');
              audio.play().catch(() => {});
            } catch {}
          }
        );

        fileReceiversRef.current.set(transferId, receiver);
        setFileTransfers((prev) => {
          const next = new Map<string, FileTransfer>(prev);
          next.set(transferId, newTransfer);
          return next;
        });
      } else if (type === 'file-chunk') {
        const receiver = fileReceiversRef.current.get(transferId);
        if (receiver) {
          await receiver.receiveChunk(
            chunkData.chunkIndex,
            chunkData.totalChunks,
            chunkData.iv,
            chunkData.ciphertext
          );
        }
      }
    } catch (err) {
      console.error('Error handling incoming file chunk:', err);
    }
  };

  // Incoming Relayed Message handler
  const handleIncomingRelayedMessage = useCallback(
    async (senderId: string, payload: any) => {
      payload.isRelayed = true;
      await processDecryptedMessage(senderId, payload);
    },
    [peers]
  );

  // Incoming Relayed Chunk handler
  const handleIncomingRelayedChunk = useCallback(
    async (senderId: string, chunkData: any) => {
      chunkData.isRelayed = true;
      await processDecryptedFileChunk(senderId, chunkData);
    },
    [peers]
  );

  // Send Encrypted Message
  const sendMessage = async (text: string, targetPeerId?: string) => {
    if (!text.trim()) return;

    const messageId = 'msg_' + Math.random().toString(36).substring(2, 9);
    const targets = targetPeerId
      ? [targetPeerId]
      : Array.from(peers.keys());

    // If offline or no targets, add to outbox
    if (targets.length === 0 || isOfflineMode) {
      const queuedMsg: ChatMessage = {
        id: messageId,
        senderId: peerId,
        senderName: peerName,
        content: text,
        timestamp: Date.now(),
        isEncrypted: true,
        deliveryStatus: 'queued',
        isLocalNetwork: false,
      };
      setMessages((prev) => [...prev, queuedMsg]);
      offlineOutboxRef.current.push(queuedMsg);
      return;
    }

    let isRelayedUsed = false;

    for (const targetId of targets) {
      const key = sessionKeysRef.current.get(targetId);
      if (!key) continue;

      const { iv, ciphertext } = await encryptData(text, key);
      const payload = {
        id: messageId,
        iv,
        ciphertext,
        timestamp: Date.now(),
      };

      const wrapper = peerConnectionsRef.current.get(targetId);
      const sentDirect = wrapper?.sendMessage(JSON.stringify(payload));

      if (!sentDirect) {
        // Fallback to secure relayed connection via WebSocket
        isRelayedUsed = true;
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'encrypted-relay-message',
              roomId,
              targetPeerId: targetId,
              senderPeerId: peerId,
              payload,
            })
          );
        }
      }
    }

    const localMsg: ChatMessage = {
      id: messageId,
      senderId: peerId,
      senderName: peerName,
      content: text,
      timestamp: Date.now(),
      isEncrypted: true,
      deliveryStatus: isRelayedUsed ? 'relayed' : 'delivered',
      isLocalNetwork: !isRelayedUsed,
    };

    setMessages((prev) => [...prev, localMsg]);
  };

  // Send Encrypted File
  const sendFile = async (file: File, targetPeerId?: string) => {
    const targets: string[] = targetPeerId ? [targetPeerId] : Array.from(peers.keys());
    if (targets.length === 0) return;

    for (const targetId of targets) {
      const key = sessionKeysRef.current.get(targetId);
      if (!key) continue;

      const transferId = 'tx_' + Math.random().toString(36).substring(2, 9);
      const peer = peers.get(targetId);
      const wrapper = peerConnectionsRef.current.get(targetId);
      const isDirectOpen = wrapper?.dataChannel?.readyState === 'open';

      const transfer: FileTransfer = {
        id: transferId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        direction: 'upload',
        peerId: targetId,
        peerName: peer ? peer.peerName : `Peer-${targetId.slice(0, 4)}`,
        transferredBytes: 0,
        progress: 0,
        speed: 0,
        status: 'transferring',
        isLocalNetwork: wrapper?.connectionMode === 'direct-lan',
        isRelayed: !isDirectOpen,
        startedAt: Date.now(),
      };

      setFileTransfers((prev) => {
        const next = new Map<string, FileTransfer>(prev);
        next.set(transferId, transfer);
        return next;
      });

      // Sender transmission function
      const sendChunkFn = async (chunkPayloadStr: string) => {
        if (isDirectOpen && wrapper) {
          return wrapper.sendMessage(chunkPayloadStr);
        } else {
          // Relayed chunk fallback
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'encrypted-relay-chunk',
                roomId,
                targetPeerId: targetId,
                senderPeerId: peerId,
                chunkData: JSON.parse(chunkPayloadStr),
              })
            );
            return true;
          }
          return false;
        }
      };

      try {
        const hash = await sendEncryptedFile(
          file,
          transferId,
          key,
          sendChunkFn,
          (bytesSent, speed) => {
            setFileTransfers((prev) => {
              const next = new Map<string, FileTransfer>(prev);
              const tx = next.get(transferId);
              if (tx) {
                const progress = Math.min(100, Math.round((bytesSent / file.size) * 100));
                next.set(transferId, {
                  ...tx,
                  transferredBytes: bytesSent,
                  progress,
                  speed,
                });
              }
              return next;
            });
          }
        );

        setFileTransfers((prev) => {
          const next = new Map<string, FileTransfer>(prev);
          const tx = next.get(transferId);
          if (tx) {
            next.set(transferId, {
              ...tx,
              status: 'completed',
              progress: 100,
              sha256: hash,
              completedAt: Date.now(),
            });
          }
          return next;
        });
      } catch (err) {
        console.error('File transfer failed:', err);
        setFileTransfers((prev) => {
          const next = new Map<string, FileTransfer>(prev);
          const tx = next.get(transferId);
          if (tx) {
            next.set(transferId, { ...tx, status: 'failed' });
          }
          return next;
        });
      }
    }
  };

  // Offline Air-Gapped SDP Offer Generation
  const generateOfflineInvite = async (): Promise<string> => {
    const tempWrapper = new PeerConnectionWrapper(peerId, 'offline-peer', {
      onChannelStateChange: () => {},
      onConnectionModeDetected: () => {},
      onMessageReceived: (id, payload) => processDecryptedMessage(id, payload),
      onFileChunkReceived: (id, chunk) => processDecryptedFileChunk(id, chunk),
      onSignalGenerated: () => {},
    });

    const offer = await tempWrapper.createOffer();
    // Wait for initial ICE candidates
    await new Promise((r) => setTimeout(r, 600));

    peerConnectionsRef.current.set('offline-peer', tempWrapper);

    const bundle = {
      peerId,
      peerName,
      publicKey: publicKeyBase64,
      sdp: tempWrapper.pc.localDescription?.sdp || offer.sdp,
      type: 'offer',
      createdAt: Date.now(),
    };

    return btoa(JSON.stringify(bundle));
  };

  // Offline Air-Gapped SDP Answer Acceptance
  const acceptOfflineAnswer = async (answerBase64: string): Promise<boolean> => {
    try {
      const decoded = JSON.parse(atob(answerBase64));
      const wrapper = peerConnectionsRef.current.get('offline-peer');
      if (wrapper && decoded.sdp) {
        await wrapper.handleAnswer({ type: 'answer', sdp: decoded.sdp });

        // Add peer
        const fp = await generateFingerprint(decoded.publicKey || 'offline');
        const sas = await generateSas(publicKeyBase64, decoded.publicKey || 'offline');
        const offlinePeer: Peer = {
          peerId: decoded.peerId || 'offline-peer',
          peerName: decoded.peerName || 'Air-Gapped Peer',
          publicKey: decoded.publicKey || '',
          isSameNetwork: true,
          networkType: 'local',
          connectionType: 'offline',
          channelState: 'connected',
          fingerprint: fp,
          sasEmojis: sas.emojis,
          isVerified: true,
        };

        setPeers((prev) => new Map(prev).set(offlinePeer.peerId, offlinePeer));
        if (decoded.publicKey) {
          await getOrDeriveSessionKey(offlinePeer.peerId, decoded.publicKey);
        }
        return true;
      }
    } catch (err) {
      console.error('Failed to accept offline answer:', err);
    }
    return false;
  };

  // Toggle peer verification
  const verifyPeer = (pId: string) => {
    setPeers((prev) => {
      const next = new Map<string, Peer>(prev);
      const p = next.get(pId);
      if (p) {
        next.set(pId, { ...p, isVerified: !p.isVerified });
      }
      return next;
    });
  };

  return {
    peerId,
    peerName,
    setPeerName,
    roomId,
    setRoomId,
    publicKeyBase64,
    fingerprint,
    roomPassword,
    setRoomPassword,
    peers: Array.from(peers.values()) as Peer[],
    selectedPeerId,
    setSelectedPeerId,
    messages,
    fileTransfers: Array.from(fileTransfers.values()) as FileTransfer[],
    diagnostics,
    isOfflineMode,
    setIsOfflineMode,
    sendMessage,
    sendFile,
    generateOfflineInvite,
    acceptOfflineAnswer,
    verifyPeer,
  };
}
