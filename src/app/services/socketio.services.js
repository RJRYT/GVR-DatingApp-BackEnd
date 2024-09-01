const { User, PrivateMessages } = require("../models");
const jwt = require('jsonwebtoken');

module.exports = (io) => {

  io.use(async (socket, next) => {
    const token = socket.handshake.query.token;
    if (token) {
      jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) return next(new Error('Authentication error'));
        socket.user = decoded; // Attach the user object to the socket
        next();
      });
    } else {
      next(new Error('Authentication token missing'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    console.log(socket.handshake.query);

    try {
      const token = req.headers.authorization.split(' ')[1];
      //const user = await User.findOne({ 'sessions.token': token });
      const user = User.findById(userId);
  
      if (user) {
        const session = user.sessions.find((session) => session.token === token);
        if (session) {
          session.lastActive = new Date();
          user.isOnline = true;
           user.save();
          io.emit('userOnline', userId);
        }
      }
      next();
    } catch (err) {
      console.error('Error updating online status:', err);
      next(err);
    }

/*
    User.findByIdAndUpdate(userId, { isOnline: true, lastActive: Date.now() })
      .then(() => {
        io.emit('userOnline', userId);
      })
      .catch((err) => console.error('Error updating online status:', err));
*/
    socket.on('joinRoom', ({ chatId }) => {
      socket.join(chatId);
    });

    socket.on('typing', ({ chatId, userId }) => {
      socket.broadcast.to(chatId).emit('typing', { userId });
    });

    socket.on('sendMessage', async ({ chatId, content }) => {
      const message = new PrivateMessages({ sender: userId, content, chatRoom: chatId });
      await message.save();
      io.to(chatId).emit('message', message);
    });

    socket.on('disconnect', async () => {
      User.findByIdAndUpdate(userId, { isOnline: false, lastActive: Date.now() })
        .then(() => {
          io.emit('userOffline', userId);
        })
        .catch((err) => console.error('Error updating offline status:', err));
    });
  });

  return io;
};
