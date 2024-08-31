const { User, PrivateMessages, PrivateChat } = require("../models");
const jwt = require("jsonwebtoken");

module.exports = (io) => {
  io.use((socket, next) => {
    try {
      const cookies = socket.request.headers.cookie;
      const token = cookies
        ?.split("; ")
        .find((row) => row.startsWith("accessToken="))
        ?.split("=")[1];

      if (token) {
        jwt.verify(
          token,
          process.env.JWT_ACCESS_TOKEN_SECRET,
          (err, decoded) => {
            if (err) {
              console.log("JWT verification error:", err);
              return next(new Error("Authentication error"));
            }
            socket.user = decoded; // Attach the user object to the socket
            next();
          }
        );
      } else {
        next(new Error("Authentication token missing"));
      }
    } catch (err) {
      console.error("Error in socket authentication:", err);
      next(new Error("Internal server error"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user.id;
    socket.join(userId);
    console.log(`User with ID ${userId} connected and joined room ${userId}`);

    User.findByIdAndUpdate(userId, { isOnline: true, lastActive: Date.now() })
      .then(() => {
        io.emit("userOnline", userId);
      })
      .catch((err) => console.error("Error updating online status:", err));

    socket.on("joinRoom", ({ chatId }) => {
      socket.join(chatId);
      console.log(`User ${userId} joined room ${chatId}`);
    });

    socket.on("typing", ({ chatId }) => {
      socket.broadcast.to(chatId).emit("typing", { userId });
    });

    socket.on("sendMessage", async ({ chatId, content }) => {
      try {
        const chat = await PrivateChat.findById(chatId);
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
          io.to(userId).emit("UpdateLastMessage", message, chatId);
        } else {
          console.log("private chat not found");
        }
      } catch (err) {
        console.error("Error sending message:", err);
      }
    });

    socket.on("disconnect", () => {
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
