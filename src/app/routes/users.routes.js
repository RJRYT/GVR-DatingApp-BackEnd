module.exports = (app) => {
  const usersController = require("../controllers/users.controllers");

  var router = require("express").Router();

  router.get("/", usersController.test);
  router.post("/", usersController.test);

  router.get("/me", usersController.authMiddleware, usersController.CheckUser);
  router.post("/token", usersController.RefreshToken);

  router.post(
    "/upload/images",
    usersController.authMiddleware,
    usersController.uploadImages.array("images", 5),
    usersController.saveImages
  );

  router.post(
    "/upload/profilepic",
    usersController.authMiddleware,
    usersController.uploadProfilePic.single("profilePic"),
    usersController.saveUploadedPic
  );

  router.post(
    "/upload/shortreel",
    usersController.authMiddleware,
    usersController.uploadReel.single("shortReel"),
    usersController.saveUploadedReel
  );

  router.post(
    "/update/personalinfo",
    usersController.authMiddleware,
    usersController.updateUserPersonalDetails
  );

  router.post(
    "/update/professionalinfo",
    usersController.authMiddleware,
    usersController.updateUserProfessinalDetails
  );

  router.post(
    "/update/purpose",
    usersController.authMiddleware,
    usersController.updateUserPurposeDetails
  );

  router.get(
    "/status/registration",
    usersController.authMiddleware,
    usersController.CheckRegistrationStatus
  );

  router.get(
    "/profile/:userId",
    usersController.authMiddleware,
    usersController.fetchUserDetails
  );

  app.use("/api/users", router);
};
