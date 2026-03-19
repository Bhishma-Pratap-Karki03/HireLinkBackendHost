const { Server } = require("socket.io");
const { verifyToken } = require("./utils/tokenUtils");
const User = require("./models/userModel");

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL
        ? process.env.CLIENT_URL.split(",")
        : ["http://localhost:5173"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.auth?.token || "";
      const rawToken = String(authHeader).replace(/^Bearer\s+/i, "").trim();

      if (!rawToken) {
        return next(new Error("Unauthorized"));
      }

      const decoded = verifyToken(rawToken);
      if (!decoded?.id) {
        return next(new Error("Unauthorized"));
      }

      const user = await User.findById(decoded.id).select("_id email role isBlocked").lean();
      if (!user || user.isBlocked) {
        return next(new Error("Unauthorized"));
      }

      socket.user = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      };

      return next();
    } catch (error) {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user?.id;
    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on("disconnect", () => {
      // no-op
    });
  });

  return io;
};

const getIO = () => io;

module.exports = {
  initSocket,
  getIO,
};
