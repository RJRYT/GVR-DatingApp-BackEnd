const express = require('express');
const authController = require("../../controllers/Admin/AuthController")

const router = express.Router();

router.post("/login", authController.adminLogin);

module.exports = router;
