const express = require('express');
const { AuthController } = require("../../controllers").Admin;
const { AdminAuthMiddleware } = require("../../middlewares");

const router = express.Router();

//Test route
router.get("/", AuthController.test);
router.post("/", AuthController.test);

router.post("/login", AuthController.adminLogin);
router.post("/logout", AdminAuthMiddleware, AuthController.adminLogout);

module.exports = router;
