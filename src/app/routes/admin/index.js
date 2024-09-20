const express = require('express');
const AuthRoutes = require("./auth.routes");
const AdminRoutes = require("./admin.routes");

const router = express.Router();

router.get("/", (req, res) => {
    res.status(200).json({ success: true, message: "Hello from admin api" });
});

router.use("/auth", AuthRoutes);
router.use("/me", AdminRoutes);

module.exports = router;