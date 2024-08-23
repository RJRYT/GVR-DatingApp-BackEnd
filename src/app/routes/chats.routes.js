const express = require('express');
const { ChatController } = require("../controllers");
const { AuthMiddleware } = require("../middlewares");

const router = express.Router();

router.use(AuthMiddleware);

router.get("/", ChatController.test);
router.post("/", ChatController.test);

router.post("/requests", ChatController.privateChatRequests);
router.post("/requests/:id/respond", ChatController.respondToChatRequests);

router.post("/groups/create", ChatController.createGroupChat);
router.post("/groups/:groupId/invite", ChatController.inviteToGroupChat);
router.post("/groups/:groupId/respond", ChatController.respondToGroupInvite);
router.post("/groups/:groupId/leave", ChatController.leaveFromGroup);

router.get("/messages/private/:chatId", ChatController.fetchPrivateMessages);
router.get("/messages/group/:chatId", ChatController.fetchGroupMessages);

module.exports = router;