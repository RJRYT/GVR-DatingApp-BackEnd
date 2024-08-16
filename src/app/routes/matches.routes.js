const express = require('express');
const { MatchController } = require("../controllers");
const { AuthMiddleware } = require("../middlewares");

const router = express.Router();

router.use(AuthMiddleware);

router.get("/", MatchController.test);
router.post("/", MatchController.test);

router.get("/me", MatchController.matchAlgorithm);
router.get("/preferences", MatchController.viewPreferences);
router.post("/preferences", MatchController.modifyPreferences);

module.exports = router;