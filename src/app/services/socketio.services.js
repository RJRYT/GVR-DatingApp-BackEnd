
module.exports = (io) => {

  io.use(async (socket, next) => {
    //authentication check comes here
  });

  io.on('connection', (socket) => {
    //rest of socket io comes here
  });

  return io;
};
