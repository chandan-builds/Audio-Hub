import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import cron from "node-cron";

// --- Types ---
interface RoomUser {
  userId: string;
  userName: string;
  socketId: string;
  joinedAt: number;
  isMuted: boolean;
  isSharingScreen: boolean;
}

interface RoomInfo {
  users: Map<string, RoomUser>;
  createdAt: number;
}

// --- State ---
const rooms = new Map<string, RoomInfo>();
const socketToUser = new Map<string, { userId: string; roomId: string }>();

// --- Server Setup ---
const app = express();
const httpServer = createServer(app);

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://audio-hub.vercel.app",
  "https://audio-hub-client.vercel.app",
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ["websocket", "polling"],
});

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

// --- REST Endpoints ---
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), rooms: rooms.size });
});

app.get("/api/rooms", (_req, res) => {
  const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
    id,
    userCount: room.users.size,
    createdAt: room.createdAt,
    users: Array.from(room.users.values()).map((u) => ({
      userName: u.userName,
      isMuted: u.isMuted,
      isSharingScreen: u.isSharingScreen,
    })),
  }));
  res.json({ rooms: roomList });
});

app.get("/api/rooms/:roomId", (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.json({
    id: req.params.roomId,
    userCount: room.users.size,
    users: Array.from(room.users.values()).map((u) => ({
      userId: u.userId,
      userName: u.userName,
      isMuted: u.isMuted,
      isSharingScreen: u.isSharingScreen,
    })),
  });
});

// --- TURN Credentials (Metered.ca) ---
app.get("/api/turn-credentials", (_req, res) => {
  res.json({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      {
        urls: process.env.TURN_SERVER_URL || "turn:a.relay.metered.ca:80",
        username: process.env.TURN_USERNAME || "",
        credential: process.env.TURN_CREDENTIAL || "",
      },
      {
        urls: process.env.TURN_SERVER_URL_TLS || "turn:a.relay.metered.ca:443",
        username: process.env.TURN_USERNAME || "",
        credential: process.env.TURN_CREDENTIAL || "",
      },
      {
        urls:
          process.env.TURN_SERVER_URL_TCP ||
          "turn:a.relay.metered.ca:443?transport=tcp",
        username: process.env.TURN_USERNAME || "",
        credential: process.env.TURN_CREDENTIAL || "",
      },
    ],
  });
});

// --- Socket.IO Logic ---
io.on("connection", (socket: Socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  socket.on(
    "join-room",
    (roomId: string, userId: string, userName: string) => {
      // Create room if it doesn't exist
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          users: new Map(),
          createdAt: Date.now(),
        });
      }

      const room = rooms.get(roomId)!;

      // Create user record
      const user: RoomUser = {
        userId,
        userName,
        socketId: socket.id,
        joinedAt: Date.now(),
        isMuted: false,
        isSharingScreen: false,
      };

      room.users.set(userId, user);
      socketToUser.set(socket.id, { userId, roomId });

      // Join the socket room
      socket.join(roomId);

      // Send existing users list to the new user
      const existingUsers = Array.from(room.users.entries())
        .filter(([id]) => id !== userId)
        .map(([id, u]) => ({
          userId: id,
          userName: u.userName,
          isMuted: u.isMuted,
          isSharingScreen: u.isSharingScreen,
        }));

      socket.emit("room-users", existingUsers);

      // Broadcast to others that a new user joined
      socket.to(roomId).emit("user-connected", userId, userName);

      // Broadcast updated user count
      io.to(roomId).emit("room-user-count", room.users.size);

      console.log(
        `[Room] ${userName} (${userId}) joined "${roomId}" — ${room.users.size} users`
      );
    }
  );

  // WebRTC signaling — route by socketId via userId lookup
  socket.on(
    "signal",
    ({
      to,
      from,
      fromName,
      signal,
      type,
    }: {
      to: string;
      from: string;
      fromName: string;
      signal: any;
      type: string;
    }) => {
      // Find the target user's socketId
      const mapping = socketToUser.get(socket.id);
      if (!mapping) return;

      const room = rooms.get(mapping.roomId);
      if (!room) return;

      const targetUser = room.users.get(to);
      if (!targetUser) return;

      // Send directly to the target socket
      io.to(targetUser.socketId).emit("signal", {
        from,
        fromName,
        signal,
        type,
      });
    }
  );

  // User status updates
  socket.on("user-muted", (isMuted: boolean) => {
    const mapping = socketToUser.get(socket.id);
    if (!mapping) return;

    const room = rooms.get(mapping.roomId);
    if (!room) return;

    const user = room.users.get(mapping.userId);
    if (user) {
      user.isMuted = isMuted;
      socket.to(mapping.roomId).emit("user-status-changed", {
        userId: mapping.userId,
        isMuted,
      });
    }
  });

  socket.on("user-screen-share", (isSharingScreen: boolean) => {
    const mapping = socketToUser.get(socket.id);
    if (!mapping) return;

    const room = rooms.get(mapping.roomId);
    if (!room) return;

    const user = room.users.get(mapping.userId);
    if (user) {
      user.isSharingScreen = isSharingScreen;
      socket.to(mapping.roomId).emit("user-status-changed", {
        userId: mapping.userId,
        isSharingScreen,
      });
    }
  });

  // Chat message relay
  socket.on(
    "chat-message",
    ({ id, message, userName }: { id: string; message: string; userName: string }) => {
      const mapping = socketToUser.get(socket.id);
      if (!mapping) return;

      socket.to(mapping.roomId).emit("chat-message", {
        id,
        userId: mapping.userId,
        userName,
        message,
        timestamp: Date.now(),
      });
    }
  );

  // Disconnect handler
  socket.on("disconnect", () => {
    const mapping = socketToUser.get(socket.id);
    if (mapping) {
      const room = rooms.get(mapping.roomId);
      if (room) {
        const user = room.users.get(mapping.userId);
        if (user) {
          console.log(
            `[Room] ${user.userName} (${mapping.userId}) left "${mapping.roomId}"`
          );
        }

        room.users.delete(mapping.userId);

        // Broadcast disconnection
        io.to(mapping.roomId).emit("user-disconnected", mapping.userId);
        io.to(mapping.roomId).emit("room-user-count", room.users.size);

        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(mapping.roomId);
          console.log(`[Room] "${mapping.roomId}" deleted (empty)`);
        }
      }

      socketToUser.delete(socket.id);
    }

    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

// --- Start Server ---
const PORT = parseInt(process.env.PORT || "10000", 10);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Audio Hub server running on port ${PORT}`);
  console.log(`📡 CORS origins: ${ALLOWED_ORIGINS.join(", ")}`);

  // --- Keep-Alive Cron (Render free tier spins down after 15 min) ---
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

  cron.schedule("*/5 * * * *", async () => {
    try {
      const res = await fetch(`${SELF_URL}/health`);
      const data = await res.json();
      console.log(`[Cron] Keep-alive ping → ${res.status}`, data);
    } catch (err) {
      console.warn("[Cron] Keep-alive ping failed:", (err as Error).message);
    }
  });

  console.log(`⏰ Keep-alive cron scheduled (every 5 min → ${SELF_URL}/health)`);
});
