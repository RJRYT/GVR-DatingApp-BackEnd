const express = require('express');
const { AuthController } = require("../controllers");

const router = express.Router();

//Test route
router.get("/", AuthController.test);
router.post("/", AuthController.test);

//Local Login/Register
router.post("/email/login", AuthController.doLogin);
router.post("/email/register", AuthController.doRegister);

//Logout
router.post("/logout", AuthController.doLogout);

// Google Authentication
router.get("/google/login", AuthController.GoogleLogin);
router.get("/google/callback", AuthController.PassportVerify, AuthController.GoogleCallBack);

//Phone Number Verify
router.post("/number/sendotp", AuthController.SendCode);

// OTP Verify
router.post("/number/verifyotp", AuthController.verifyCode)



module.exports = router;