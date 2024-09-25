const express = require('express');
const { AdminController } = require("../../controllers").Admin;
const { AdminAuthMiddleware } = require("../../middlewares");

const router = express.Router();

router.get("/", AdminAuthMiddleware, AdminController.fetchAdminDetails);
router.post("/subscription",AdminAuthMiddleware,AdminController.addSubscription)
router.get("/subscriptions", AdminAuthMiddleware, AdminController.getSubscription);
router.delete("/subscription/:id",AdminAuthMiddleware,AdminController.deleteSubscription)

module.exports = router;