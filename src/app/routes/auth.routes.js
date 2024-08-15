module.exports = (app) => {
  const authController = require("../controllers/auth.controllers");

  var router = require("express").Router();

  router.get("/", authController.test); //test
  router.post("/", authController.test); //test

  //Local Login/Register
  router.post("/email/login", authController.doLogin);
  router.post("/email/register", authController.doRegister);

  //Logout
  router.post("/logout", authController.doLogout);

  // Google Authentication
  router.get("/google/login", authController.GoogleLogin);
  router.get("/google/callback", authController.PassportVerify , authController.GoogleCallBack);

  //Phone Number Verify
  router.post("/number/sendotp", authController.SendCode);

  app.use("/api/auth", router);
};
