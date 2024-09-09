const { User, PrivateMessages, PrivateChat, Session } = require("../models");
const jwt = require("jsonwebtoken");

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const cookies = socket.request.headers.cookie;
      const token = cookies
        ?.split("; ")
        .find((row) => row.startsWith("accessToken="))
        ?.split("=")[1];

      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
        if (!decoded.sessionId)
          return next(new Error("Session id not found"));

        const session = await Session.findOne({ sessionId: decoded.sessionId });
        if (!session)
          return next(new Error("Session is no longer active."));

        session.lastActiveAt = Date.now();
        await session.save();
        const user = await User.findById(decoded.id, "username").lean();
        if (!user) return next(new Error("Invilid user"));
        socket.user = {...user, ...decoded};
        next();
      } else {
        next(new Error("Authentication token missing"));
      }
    } catch (err) {
      next(new Error("Internal server error"));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    socket.join(userId);

    User.findByIdAndUpdate(userId, { isOnline: true, lastActive: Date.now() })
      .then(() => {
        socket.broadcast.emit("userOnline", userId);
      })
      .catch((err) => console.error('Error updating online status:', err));

    socket.on('joinRoom', ({ chatId }) => {
      socket.join(chatId);
    });

    socket.on("typing", ({ chatId }) => {
      socket.broadcast.to(chatId).emit("typing", { userId });
    });

    socket.on("stopTyping", ({ chatId }) => {
      socket.broadcast.to(chatId).emit("stopTyping", { userId });
    });

    socket.on("sendMessage", async ({ chatId, content }) => {
      try {
        const chat = await PrivateChat.findById(chatId);
        const recipient = chat.participants[0].toString() === userId ? chat.participants[1].toString() : chat.participants[0].toString();
        if (chat) {
          const message = new PrivateMessages({
            sender: userId,
            content,
            chatRoom: chatId,
          });
          await message.save();
          chat.messages.push(message._id);
          await chat.save();

          io.to(chatId).emit("message", message);
          io.to([userId, recipient]).emit("UpdateLastMessage", message, chatId);
        } else {
          console.log("private chat not found");
        }
      } catch (err) {
        console.error("Error sending message:", err);
      }
    });

    socket.on("markMessagesAsRead", async ({ chatId }) => {
      try {
        await PrivateMessages.updateMany(
          { chatRoom: chatId, sender: { $ne: userId }, read: false },
          { read: true }
        );

        io.to(chatId).emit("messagesSeen", userId);
      } catch (err) {
        console.error("Error updating message read status:", err);
      }
    });

    socket.on("disconnect", () => {
      User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastActive: Date.now(),
      })
        .then(() => {
          socket.broadcast.emit("userOffline", userId);
        })
        .catch((err) => console.error("Error updating offline status:", err));
    });
  });

  return io;
};
