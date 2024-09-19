const express = require('express');
const { NotFoundMiddleware } = require("../middlewares/error.middleware");
const AuthRoutes = require("./auth.routes");
const MatchesRoutes = require("./matches.routes");
const UsersRoutes = require("./users.routes");
const ChatRoutes = require("./chats.routes");

const adminRoutes = require("./admin");

const router = express.Router();

router.get(["/", "/api"], (req, res) => {
    res.status(200).json({ success: true, message: "Welcome to dating application api." });
});

router.use("/api/auth", AuthRoutes);
router.use("/api/matches", MatchesRoutes);
router.use("/api/users", UsersRoutes);
router.use("/api/chats", ChatRoutes);

// admin sub route
router.use("/api/admin/", adminRoutes);

// Notfound handling
router.use(NotFoundMiddleware);

module.exports = router;