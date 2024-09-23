const express = require('express');
const { AdminController } = require("../../controllers").Admin;
const { AdminAuthMiddleware } = require("../../middlewares");

const router = express.Router();

router.get("/", AdminAuthMiddleware, AdminController.fetchAdminDetails);
router.post("/subscription",AdminAuthMiddleware,AdminController.addSubscription)

module.exports = router;