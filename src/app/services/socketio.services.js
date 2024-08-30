const { User, PrivateMessages } = require("../models");
const jwt = require("jsonwebtoken");

module.exports = (io) => {
  io.use(async (socket, next) => {
    const cookies = socket.request.headers.cookie;
    const token = cookies
      ? cookies
          .split("; ")
          .find((row) => row.startsWith("accessToken="))
          .split("=")[1]
      : null;

    if (token) {
      jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          console.log(err);
          return next(new Error("Authentication error"));
        }
        socket.user = decoded; // Attach the user object to the socket
        next();
      });
    } else {
      next(new Error("Authentication token missing"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user.id;
    User.findByIdAndUpdate(userId, { isOnline: true, lastActive: Date.now() })
      .then(() => {
        io.emit("userOnline", userId);
      })
      .catch((err) => console.error("Error updating online status:", err));

    socket.on("joinRoom", ({ chatId }) => {
      socket.join(chatId);
    });

    socket.on("typing", ({ chatId, userId }) => {
      socket.broadcast.to(chatId).emit("typing", { userId });
    });

    socket.on("sendMessage", async ({ chatId, content }) => {
      const message = new PrivateMessages({
        sender: userId,
        content,
        chatRoom: chatId,
      });
      await message.save();
      io.to(chatId).emit("message", message);
    });

    socket.on("disconnect", async () => {
      User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastActive: Date.now(),
      })
        .then(() => {
          io.emit("userOffline", userId);
        })
        .catch((err) => console.error("Error updating offline status:", err));
    });
  });

  return io;
};
