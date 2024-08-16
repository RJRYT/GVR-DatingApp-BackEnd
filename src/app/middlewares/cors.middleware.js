const cors = require("cors");

//Configure CORS
const allowedOrigins = [process.env.FRONTEND_URL];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `Request from origin ${origin} has been blocked by CORS policy`;
      return callback(msg, false);
    }
    return callback(null, true);
  },
  credentials: true,
};

module.exports = cors(corsOptions);