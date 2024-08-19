const express = require('express');
const { UserController } = require("../controllers");
const { AuthMiddleware, UploadMiddleware } = require("../middlewares");

const router = express.Router();

router.get("/", UserController.test);
router.post("/", UserController.test);

router.get("/me", AuthMiddleware, UserController.CheckUser);

router.post("/token", UserController.RefreshToken);

router.post(
  "/upload/images",
  AuthMiddleware,
  UploadMiddleware.array("images", 5),
  UserController.saveImages
);

router.post(
  "/upload/profilepic",
  AuthMiddleware,
  UploadMiddleware.single("profilepic"),
  UserController.saveUploadedPic
);

router.post(
  "/upload/shortreel",
  AuthMiddleware,
  UploadMiddleware.single("shortreels"),
  UserController.saveUploadedReel
);

router.post(
  "/update/personalinfo",
  AuthMiddleware,
  UserController.updateUserPersonalDetails
);

router.post(
  "/update/professionalinfo",
  AuthMiddleware,
  UserController.updateUserProfessinalDetails
);

router.post(
  "/update/purpose",
  AuthMiddleware,
  UserController.updateUserPurposeDetails
);

router.get(
  "/profile/:userId",
  AuthMiddleware,
  UserController.fetchUserDetails
);

module.exports = router;