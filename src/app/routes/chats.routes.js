const express = require("express");
const { ChatController } = require("../controllers");
const { AuthMiddleware } = require("../middlewares");

const router = express.Router();

router.use(AuthMiddleware);

router.get("/", ChatController.test);
router.post("/", ChatController.test);

router.get("/list", ChatController.fetchChats);

router.post("/groups/create", ChatController.createGroupChat);
router.post("/groups/:groupId/invite", ChatController.inviteToGroupChat);
router.post("/groups/:groupId/respond", ChatController.respondToGroupInvite);
router.post("/groups/:groupId/leave", ChatController.leaveFromGroup);

router.get("/messages/group/:chatId", ChatController.fetchGroupMessages);

router.get("/messages/private/:chatId", ChatController.fetchPrivateMessages);
router.post("/messages/private/:chatId/markread", ChatController.markChatsAsRead);

module.exports = router;
