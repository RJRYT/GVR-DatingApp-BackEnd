const express = require("express");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const cron = require("node-cron");
const morgan = require("morgan");
const app = express();
const middleware = require("./middlewares");

const { CleanupFiles, SocketIo } = require("./services");
const corsConfig = middleware.CorsMiddleware;
const passport = middleware.PassportMiddleware;
const { GlobalErrorMiddleware } = middleware.ErrorMiddleware
const connectDatabase = require("./config/db.config");
const routes = require("./routes");

// Configure CORS
app.use(corsConfig);

// Request logger
app.use(morgan("dev"));

// Body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Cookie-parser
app.use(cookieParser());

// Passport middleware
app.use(passport.initialize());

// Connect to database
connectDatabase();

// Main routes
app.use("/", routes);

// Error handling
app.use(GlobalErrorMiddleware);

// Schedule the cleanup to run daily at midnight
cron.schedule("0 0 * * *", () => {
  console.log("[Corn Job]:Corn job triggered...");
  //CleanupFiles();
});

// Server error logger
process.on("unhandledRejection", (reason, promise) => {
  console.log(`[unhandledRejection]: `, reason);
});

process.on("uncaughtException", (err, origin) => {
  console.log("[uncaughtException]: ", origin, err);
});

// Socket.io config
const server = require('http').createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

SocketIo(io);

app.locals.io = io;

// to pass correct IP Address
app.set('trust proxy', true);

module.exports = server;