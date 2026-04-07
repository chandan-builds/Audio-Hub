import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  const PORT = 3000;

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId: string, userId: string, userName: string) => {
      socket.join(roomId);
      socket.join(userId); // Allow direct messaging via userId
      console.log(`User ${userId} (${userName}) joined room ${roomId}`);
      
      // Broadcast to others in the room that a new user joined
      socket.to(roomId).emit("user-connected", userId, userName, socket.id);

      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        socket.to(roomId).emit("user-disconnected", userId);
      });
    });

    // Signaling for WebRTC
    socket.on("signal", ({ to, from, signal, type }: { to: string, from: string, signal: any, type: string }) => {
      io.to(to).emit("signal", { from, signal, type });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
