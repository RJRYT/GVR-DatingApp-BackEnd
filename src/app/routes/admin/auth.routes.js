const express = require('express');
const { AuthController } = require("../../controllers").Admin

const router = express.Router();

router.post("/login", AuthController.adminLogin);

module.exports = router;
