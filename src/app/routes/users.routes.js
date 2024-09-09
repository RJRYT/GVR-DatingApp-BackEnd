const express = require("express");
const { UserController } = require("../controllers");
const { AuthMiddleware, UploadMiddleware } = require("../middlewares");

const router = express.Router();

router.get("/", UserController.test);
router.post("/", UserController.test);

router.get("/me", AuthMiddleware, UserController.CheckUser);

router.post("/token", UserController.RefreshToken);

router.post(
  "/update/personalinfo",
  AuthMiddleware,
  UploadMiddleware.fields([
    { name: "images", maxCount: 5 },
    { name: "profilepic", maxCount: 1 },
    { name: "shortreels", maxCount: 1 },
  ]),
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

router.get("/profile/:userId", AuthMiddleware, UserController.fetchUserDetails);

router.get("/password/check", AuthMiddleware, UserController.checkPassword);

router.put("/password/change", AuthMiddleware, UserController.changePassword);

router.put("/profile/reject", AuthMiddleware, UserController.rejectUserProfile)

router.post(
  "/notification/markread",
  AuthMiddleware,
  UserController.MarkNotificationAsRead
);
router.post(
  "/notification/delete",
  AuthMiddleware,
  UserController.deleteNotification
);

router.get("/friends", AuthMiddleware, UserController.fetchFriendRequests);
router.get(
  "/friends/pending",
  AuthMiddleware,
  UserController.fetchMyPendingRequests
);
router.post(
  "/friends/request",
  AuthMiddleware,
  UserController.addFriendRequest
);
router.put(
  "/friends/request/:requestId/accept",
  AuthMiddleware,
  UserController.acceptFriendRequest
);
router.put(
  "/friends/request/:requestId/decline",
  AuthMiddleware,
  UserController.declineFriendRequest
);
router.put(
  "/friends/request/:requestId/cancel",
  AuthMiddleware,
  UserController.cancelFriendRequest
);
router.put(
  "/update/profile",
  AuthMiddleware,
  UploadMiddleware.fields([
    { name: "images", maxCount: 5 },
    { name: "profilepic", maxCount: 1 },
    { name: "shortreels", maxCount: 1 },
  ]),
  UserController.updateProfile
);

router.get("/shortlist", AuthMiddleware, UserController.listMyShortList);
router.get("/shortlist/by", AuthMiddleware, UserController.ListShortListedBy);
router.post(
  "/shortlist",
  AuthMiddleware,
  UserController.updateShortListedUsers
);

router.get("/views", AuthMiddleware, UserController.listMyProfileViewers);


router.get('/privacy', AuthMiddleware, UserController.privacyDetails); 
router.post('/privacy/2fa', AuthMiddleware, UserController.twoFAStatusUpdate);
router.get('/privacy/2fa/generate', AuthMiddleware, UserController.generateTwoFASecret);
router.post('/privacy/2fa/verify', AuthMiddleware, UserController.verifyTwoFACode);
router.post('/verify-2fa', UserController.verifyTwoFAToken);
router.get('/sessions', AuthMiddleware, UserController.getActiveSessions);
router.delete('/sessions', AuthMiddleware, UserController.deleteAllSessions);

module.exports = router;
