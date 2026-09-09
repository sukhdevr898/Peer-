import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

interface PeerConnection {
  ws: WebSocket;
  peerId: string;
  peerName: string;
  roomId: string;
  publicKey: string;
  remoteAddress: string;
  clientNetworkHint?: string;
  joinedAt: number;
}

const app = express();
const PORT = 3000;
const server = http.createServer(app);

// JSON body parser
app.use(express.json({ limit: "50mb" }));

// Network diagnostics endpoint
app.get("/api/network-info", (req, res) => {
  const forwarded = req.headers["x-forwarded-for"];
  const clientIp = typeof forwarded === "string" 
    ? forwarded.split(",")[0].trim() 
    : req.socket.remoteAddress || "127.0.0.1";

  res.json({
    clientIp,
    timestamp: Date.now(),
    protocol: req.protocol,
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
  });
});

// Rooms storage: Map<roomId, Map<peerId, PeerConnection>>
const rooms = new Map<string, Map<string, PeerConnection>>();

// WebSocket signaling & encrypted relay server
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws: WebSocket, req) => {
  const forwarded = req.headers["x-forwarded-for"];
  const remoteAddress = typeof forwarded === "string" 
    ? forwarded.split(",")[0].trim() 
    : req.socket.remoteAddress || "127.0.0.1";

  let currentRoomId: string | null = null;
  let currentPeerId: string | null = null;

  ws.on("message", (rawMessage: string) => {
    try {
      const data = JSON.parse(rawMessage.toString());

      switch (data.type) {
        case "join": {
          const { roomId, peerId, peerName, publicKey, clientNetworkHint } = data;
          if (!roomId || !peerId) return;

          currentRoomId = roomId;
          currentPeerId = peerId;

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
          }

          const room = rooms.get(roomId)!;

          // Check if peer is on the same network:
          // Same public/remote IP or matching local subnet hint
          const peerConn: PeerConnection = {
            ws,
            peerId,
            peerName: peerName || `Peer-${peerId.slice(0, 4)}`,
            roomId,
            publicKey: publicKey || "",
            remoteAddress,
            clientNetworkHint,
            joinedAt: Date.now(),
          };

          room.set(peerId, peerConn);

          // Get list of other peers in the room
          const existingPeers: Array<{
            peerId: string;
            peerName: string;
            publicKey: string;
            isSameNetwork: boolean;
            networkType: "local" | "internet";
          }> = [];

          room.forEach((otherPeer, otherPeerId) => {
            if (otherPeerId !== peerId) {
              const isSameNetwork =
                otherPeer.remoteAddress === remoteAddress ||
                (Boolean(clientNetworkHint) &&
                  clientNetworkHint === otherPeer.clientNetworkHint);

              existingPeers.push({
                peerId: otherPeer.peerId,
                peerName: otherPeer.peerName,
                publicKey: otherPeer.publicKey,
                isSameNetwork,
                networkType: isSameNetwork ? "local" : "internet",
              });

              // Notify the existing peer about the newly joined peer
              if (otherPeer.ws.readyState === WebSocket.OPEN) {
                otherPeer.ws.send(
                  JSON.stringify({
                    type: "peer-joined",
                    peer: {
                      peerId,
                      peerName: peerConn.peerName,
                      publicKey,
                      isSameNetwork,
                      networkType: isSameNetwork ? "local" : "internet",
                    },
                  })
                );
              }
            }
          });

          // Send confirmation back to newly joined peer
          ws.send(
            JSON.stringify({
              type: "room-joined",
              roomId,
              peerId,
              remoteAddress,
              peers: existingPeers,
            })
          );
          break;
        }

        case "signal": {
          // WebRTC offer, answer, or ICE candidate forwarded to specific target peer
          const { targetPeerId, signalData, senderPeerId } = data;
          if (!currentRoomId || !targetPeerId) return;

          const room = rooms.get(currentRoomId);
          if (room && room.has(targetPeerId)) {
            const target = room.get(targetPeerId)!;
            if (target.ws.readyState === WebSocket.OPEN) {
              target.ws.send(
                JSON.stringify({
                  type: "signal",
                  senderPeerId: senderPeerId || currentPeerId,
                  signalData,
                })
              );
            }
          }
          break;
        }

        case "encrypted-relay-message": {
          // Zero-knowledge relayed message (payload is already AES-256-GCM encrypted)
          const { targetPeerId, payload, senderPeerId } = data;
          if (!currentRoomId) return;

          const room = rooms.get(currentRoomId);
          if (!room) return;

          if (targetPeerId) {
            const target = room.get(targetPeerId);
            if (target && target.ws.readyState === WebSocket.OPEN) {
              target.ws.send(
                JSON.stringify({
                  type: "encrypted-relay-message",
                  senderPeerId: senderPeerId || currentPeerId,
                  payload,
                })
              );
            }
          } else {
            // Broadcast to all other peers in the room
            room.forEach((target, otherId) => {
              if (otherId !== currentPeerId && target.ws.readyState === WebSocket.OPEN) {
                target.ws.send(
                  JSON.stringify({
                    type: "encrypted-relay-message",
                    senderPeerId: senderPeerId || currentPeerId,
                    payload,
                  })
                );
              }
            });
          }
          break;
        }

        case "encrypted-relay-chunk": {
          // Zero-knowledge relayed file chunk (payload is already AES-256-GCM encrypted)
          const { targetPeerId, chunkData, senderPeerId } = data;
          if (!currentRoomId || !targetPeerId) return;

          const room = rooms.get(currentRoomId);
          if (room && room.has(targetPeerId)) {
            const target = room.get(targetPeerId)!;
            if (target.ws.readyState === WebSocket.OPEN) {
              target.ws.send(
                JSON.stringify({
                  type: "encrypted-relay-chunk",
                  senderPeerId: senderPeerId || currentPeerId,
                  chunkData,
                })
              );
            }
          }
          break;
        }

        case "ping": {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          break;
        }
      }
    } catch {
      // Ignore malformed message frames
    }
  });

  const cleanup = () => {
    if (currentRoomId && currentPeerId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.delete(currentPeerId);
        // Broadcast peer-left to remaining peers
        room.forEach((otherPeer) => {
          if (otherPeer.ws.readyState === WebSocket.OPEN) {
            otherPeer.ws.send(
              JSON.stringify({
                type: "peer-left",
                peerId: currentPeerId,
              })
            );
          }
        });
        if (room.size === 0) {
          rooms.delete(currentRoomId);
        }
      }
    }
  };

  ws.on("close", cleanup);
  ws.on("error", cleanup);
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`P2P Relay & Signaling Server running on port ${PORT}`);
  });
}

startServer();
