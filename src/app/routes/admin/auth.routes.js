const express = require('express');
const { AuthController } = require("../../controllers").Admin

const router = express.Router();

//Test route
router.get("/", AuthController.test);
router.post("/", AuthController.test);

router.post("/login", AuthController.adminLogin);

module.exports = router;
