const { User, FriendRequests, PrivateChat } = require("../models");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const s3Config = require("../config/aws.config");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { generateAccessToken } = require("../services").Token;
const CatchAsync = require("../util/catchAsync");
const bcrypt = require("bcryptjs");

exports.test = (req, res) => {
  res.json({ status: 200, success: true, message: "hello world from users" });
};

exports.RefreshToken = CatchAsync(async (req, res) => {
  const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "Refresh token not found",
    });
  }

  jwt.verify(
    refreshToken,
    process.env.JWT_REFRESH_TOKEN_SECRET,
    (err, user) => {
      if (err)
        return res
          .status(403)
          .json({ status: 403, success: false, message: "Server error" });

      const accessToken = generateAccessToken({ id: user.id });
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
      });

      res.json({
        status: 200,
        success: true,
        message: "Token regenerated",
        accessToken,
      });
    }
  );
});

exports.CheckUser = CatchAsync(async (req, res) => {
  const {lat, lon} = req.query;
  const user = await User.findById(req.user.id).select("-password");
  if(lat && lon){
    user.currentLocation = {};
    user.currentLocation.latitude = lat;
    user.currentLocation.longitude = lon;
    await user.save();
  }
  res.json({ status: 200, success: true, message: "User found", user });
});

exports.updateUserPersonalDetails = CatchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.json({
      status: 404,
      success: false,
      message: "User not found. upload failed",
    });
  } else if (user.personalInfoSubmitted) {
    return res.json({
      status: 404,
      success: false,
      message: "Personal details already added. upload cancelled",
    });
  }

  //Delete existing profile pic if any
  if (user.profilePic && user.profilePic.key) {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: user.profilePic.key,
    };
    await s3Config.send(new DeleteObjectCommand(params));
  }
  //Delete existing images if any
  if (user.images && user.images.length > 0) {
    for (const pic of user.images) {
      if (pic.key) {
        const params = { Bucket: process.env.S3_BUCKET, Key: pic.key };
        await s3Config.send(new DeleteObjectCommand(params));
      }
    }
  }
  //Delete existing shortreel if any
  if (user.shortReel && user.shortReel.key) {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: user.shortReel.key,
    };
    await s3Config.send(new DeleteObjectCommand(params));
  }
  //Saving uploaded files to user
  user.shortReel = {
    url: req.files.shortreels[0].location,
    key: req.files.shortreels[0].key,
  };
  user.images = req.files.images.map((file) => ({
    url: file.location,
    key: file.key,
  }));
  user.profilePic = {
    url: req.files.profilepic[0].location,
    key: req.files.profilepic[0].key,
  };

  //saving other values
  user.age = req.body.age;
  user.dateOfBirth = req.body.dateOfBirth;
  user.gender = req.body.gender;
  user.hobbies = JSON.parse(req.body.hobbies);
  user.location = JSON.parse(req.body.location);
  user.interests = JSON.parse(req.body.interests);
  user.smokingHabits = req.body.smokingHabits;
  user.drinkingHabits = req.body.drinkingHabits;
  user.qualification = JSON.parse(req.body.qualification);
  user.personalInfoSubmitted = true;

  await user.save();
  return res.json({ status: 200, success: true, message: "Upload done", user });
});

exports.updateUserProfessinalDetails = CatchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.json({ status: 404, success: false, message: "User not found" });
  } else if (user.professionalInfoSubmitted) {
    return res.json({
      status: 404,
      success: false,
      message: "Professional details already added",
    });
  }

  const formData = req.body;
  if (
    formData.professionType === "employee" ||
    formData.professionType === "employer"
  ) {
    user.companyName = formData.companyName;
    user.designation = formData.designation;
    user.jobLocation = formData.jobLocation;
    user.professionalInfoSubmitted = true;
    user.professionType = formData.professionType;
  } else if (formData.professionType === "jobseeker") {
    user.expertiseLevel = formData.expertiseLevel;
    user.jobTitle = formData.jobTitle;
    user.professionalInfoSubmitted = true;
    user.professionType = formData.professionType;
  }

  await user.save();

  res.json({ status: 200, success: true, message: "Updated successfully" });
});

exports.updateUserPurposeDetails = CatchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.json({ status: 404, success: false, message: "User not found" });
  } else if (user.purposeSubmitted) {
    return res.json({
      status: 404,
      success: false,
      message: "purpose already added",
    });
  }

  user.purpose = req.body.purpose;
  user.purposeSubmitted = true;

  await user.save();

  res.json({ status: 200, success: true, message: "Updated successfully" });
});

exports.fetchUserDetails = CatchAsync(async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.isValidObjectId(userId)) {
    return res.json({ status: 403, success: false, message: "User id is not valid" });
  }

  const chat = await PrivateChat.findOne({ participants: [userId, req.user.id] })

  const user = await User.findById(
    userId,
    "username age dateOfBirth gender location hobbies interests smokingHabits drinkingHabits qualification profilePic shortReel"
  );

  if (!user) {
    return res.json({ status: 404, success: false, message: "User not found" });
  }
  if (!user.viewers) {
    user.viewers = [];
  }
  if (!user.viewers.includes(req.user.id)) {
    user.viewers.addToSet(req.user.id);
    await user.save();
  }

  if(chat){
    user.chatId = chat._id;
  }else{
    user.chatId = null;
  }

  res.json({ status: 200, success: true, user, message: "User found" });
});

exports.rejectUserProfile = CatchAsync(async (req, res) => {
  const { rejectedUserId } = req.body;
  const userId = req.user.id;

  if(!rejectedUserId) return res.json({ status: 403, success: false, message: "\"rejectedUserId\" is not found in request body" });
  if (!mongoose.isValidObjectId(rejectedUserId)) {
    return res.json({ status: 403, success: false, message: "rejected User id is not valid" });
  }

  const user = await User.findById(userId);
  if (user.rejected.includes(rejectedUserId)) {
    return res.json({ status: 403, success: false, message: "Profile already rejected" });
  }

  await User.findByIdAndUpdate(userId, { $push: { rejected: rejectedUserId } });
  
  res.status(200).json({ status: 200, success: true, message: "Profile rejected successfully" });
});

exports.checkPassword = CatchAsync(async (req, res) => {
  const userId = req.user.id;
  const user = await User.findById(userId, "password");
  if (!user) {
    return res.json({ status: 404, success: false, message: "User not found" });
  }

  const hasPassword = !!user.password;

  res.json({ status: 200, success: true, hasPassword, message: "User found" });
});

exports.changePassword = CatchAsync(async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!req.user) {
    return res.json({ status: 404, success: false, message: "User not found" });
  }

  // Fetch the user from the database
  const user = await User.findById(userId);

  // Check if the new password and confirm password match
  if (newPassword !== confirmPassword) {
    return res.json({
      status: 400,
      success: false,
      message: "Passwords do not match",
    });
  }

  // Check if the user has a current password and if it is correct
  if (user.password) {
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.json({
        status: 400,
        success: false,
        message: "Current password is incorrect",
      });
    }
  }

  user.password = newPassword;
  await user.save();

  res.json({
    status: 200,
    success: true,
    message: "Password updated successfully",
  });
});

exports.updateProfile = CatchAsync(async (req, res) => {
  console.log(req.body);
  console.log("Files:", req.files);
  const user = await User.findById(req.user.id);
  //Delete existing profile pic if any
  if (user.profilePic && user.profilePic.key) {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: user.profilePic.key,
    };
    await s3Config.send(new DeleteObjectCommand(params));
  }
  //Delete existing images if any
  if (user.images && user.images.length > 0) {
    for (const pic of user.images) {
      if (pic.key) {
        const params = { Bucket: process.env.S3_BUCKET, Key: pic.key };
        await s3Config.send(new DeleteObjectCommand(params));
      }
    }
  }
  //Delete existing shortreel if any
  if (user.shortReel && user.shortReel.key) {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: user.shortReel.key,
    };
    await s3Config.send(new DeleteObjectCommand(params));
  }

  // Saving uploaded files to user
  if (req.files?.shortreels) {
    console.log("Short reels:", req.files.shortreels); // Debug l
    user.shortReel = {
      url: req.files.shortreels[0]?.location,
      key: req.files.shortreels[0]?.key,
    };
  }

  if (req.files?.images) {
    console.log("Images:", req.files.images); // Debug line
    user.images = req.files.images.map((file) => ({
      url: file.location,
      key: file.key,
    }));
  }

  if (req.files?.profilePic) {
    user.profilePic = {
      url: req.files.profilepic?.location,
      key: req.files.profilepic?.key,
    };
  }

  user.username = req.body.username;
  user.about = req.body.bio;
  await user.save();
  return res.json({ status: 200, success: true, message: "Upload done", user });
});

exports.MarkNotificationAsRead = CatchAsync(async (req, res) => {
  const { notificationId } = req.body;

  await User.updateOne(
    { _id: req.user.id, "notifications._id": notificationId },
    { $set: { "notifications.$.read": true } }
  );

  req.app.locals.io
    .to(req.user.id)
    .emit("notificationRead", { notificationId });

  res.json({
    success: true,
    status: 200,
    message: "Notification marked as read",
  });
});

exports.deleteNotification = CatchAsync(async (req, res) => {
  const { notificationId } = req.body;

  await User.updateOne(
    { _id: req.user.id },
    { $pull: { notifications: { _id: notificationId } } }
  );

  req.app.locals.io
    .to(req.user.id)
    .emit("notificationDeleted", { notificationId });

  res.json({ success: true, status: 200, message: "Notification deleted" });
});

exports.fetchMyPendingRequests = CatchAsync(async (req, res) => {
  const pendingFriends = await FriendRequests.find({
    recipient: req.user.id,
    status: "pending",
  }).populate("sender", "username profilePic");

  if (!pendingFriends.length)
    return res.json({
      success: false,
      status: 300,
      message: "Nothing to show",
    });

  return res.json({
    success: true,
    status: 200,
    message: `Friends pending friend list`,
    pending: pendingFriends,
  });
});

exports.fetchFriendRequests = CatchAsync(async (req, res) => {
  const type = req.query.type || "pending";
  try {
    const friendsReqs = await FriendRequests.find({
      status: type,
      sender: req.user.id,
    }).populate("recipient", "username profilePic");
    if (!friendsReqs.length)
      return res.json({
        success: false,
        status: 300,
        message: "Nothing to show",
      });
    return res.json({
      success: true,
      status: 200,
      message: `Friends ${type} list`,
      [type]: friendsReqs,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "failed to fetch",
    });
  }
});

exports.addFriendRequest = CatchAsync(async (req, res) => {
  const { recipientId } = req.body;

  if (!mongoose.isValidObjectId(recipientId)) {
    return res.json({ status: 403, success: false, message: "user id is not valid" });
  }

  const requestCheck = await FriendRequests.findOne({
    sender: req.user.id,
    recipient: recipientId,
  });
  if (requestCheck) {
    if (requestCheck.status === "pending") {
      return res.json({
        status: 401,
        success: false,
        message: "Request already on his pending list",
      });
    }
    if (requestCheck.status === "accepted") {
      return res.json({
        status: 401,
        success: false,
        message: "You are already friends",
      });
    }
    if (requestCheck.status === "declined") {
      return res.json({
        status: 401,
        success: false,
        message: "Your request is declined by the recipient",
      });
    }
    if (requestCheck.status === "cancelled") {
      requestCheck.status = "pending";
      await requestCheck.save();
      return res.json({
        status: 200,
        success: true,
        message: "Request sended",
        request: requestCheck,
      });
    }
  }

  const requestReverseCheck = await FriendRequests.findOne({
    sender: recipientId,
    recipient: req.user.id,
  });

  if (requestReverseCheck) {
    if (requestReverseCheck.status === "pending") {
      return res.json({
        status: 401,
        success: false,
        message: "His request is on your pending list. please proceed with it.",
      });
    }
    if (requestReverseCheck.status === "accepted") {
      return res.json({
        status: 401,
        success: false,
        message: "He is already your friend",
      });
    }
    if (requestReverseCheck.status === "declined") {
      return res.json({
        status: 401,
        success: false,
        message:
          "His request is already declined by you. You can't send request",
      });
    }
  }

  const recipient = await User.findById(recipientId);
  const user = await User.findById(req.user.id);

  // Add a new notification to the recipient's notifications array
  const notification = {
    type: "FriendRequest",
    message: `You have a new friend request from ${user.username}`,
    from: req.user.id,
  };
  recipient.notifications.push(notification);
  req.app.locals.io.to(recipientId).emit("newNotification", notification);
  await recipient.save();

  const request = new FriendRequests({
    sender: req.user.id,
    recipient: recipientId,
  });
  await request.save();
  res.json({ status: 200, success: true, message: "Request sended", request });
});

exports.acceptFriendRequest = CatchAsync(async (req, res) => {
  const { requestId } = req.params;
  if (!mongoose.isValidObjectId(requestId)) {
    return res.json({ status: 403, success: false, message: "request id is not valid" });
  }
  const request = await FriendRequests.findById(requestId);
  if (!request)
    return res.json({
      status: 401,
      success: false,
      message: "Request not found",
    });
  if (request.recipient.toString() !== req.user.id)
    return res.json({ status: 403, success: false, message: "Unauthorized" });

  if (request.status === "accepted")
    return res.json({
      status: 400,
      success: false,
      message: "Request already accepted",
    });

  if (request.status !== "pending")
    return res.json({
      status: 400,
      success: false,
      message: "Request is not on pending to accept",
    });

  request.status = "accepted";
  await request.save();

  const requestReverseCheck = await FriendRequests.findOne({
    sender: request.recipient,
    recipient: request.sender,
  });

  if (requestReverseCheck) {
    requestReverseCheck.status = "accepted";
    await requestReverseCheck.save();
  }

  let chat = new PrivateChat({
    participants: [request.sender, request.recipient],
  });
  await chat.save();

  const sender = await User.findById(request.sender);
  const recipient = await User.findById(request.recipient);

  sender.friends.addToSet(request.recipient);
  recipient.friends.addToSet(request.sender);

  const notification = {
    type: "requestAccepted",
    message: `${sender.username} accepted your friend request`,
    from: request.recipient,
  };
  sender.notifications.push(notification);
  req.app.locals.io.to(request.sender).emit("newNotification", notification);
  await sender.save();
  await recipient.save();

  return res.json({ status: 201, success: true, message: "Request accepted" });
});

exports.declineFriendRequest = CatchAsync(async (req, res) => {
  const { requestId } = req.params;
  if (!mongoose.isValidObjectId(requestId)) {
    return res.json({ status: 403, success: false, message: "request id is not valid" });
  }
  const request = await FriendRequests.findById(requestId);
  if (!request)
    return res.json({
      status: 401,
      success: false,
      message: "Request not found",
    });
  if (request.recipient.toString() !== req.user.id)
    return res.json({ status: 403, success: false, message: "Unauthorized" });

  if (request.status === "declined")
    return res.json({
      status: 400,
      success: false,
      message: "Request already declined",
    });

  if (request.status !== "pending")
    return res.json({
      status: 400,
      success: false,
      message: "Request is not on pending to decline",
    });

  request.status = "declined";
  await request.save();

  const sender = await User.findById(request.sender);
  const requester = await User.findById(request.recipient);

  const notification = {
    type: "requestDeclined",
    message: `${requester.username} declined your friend request`,
    from: request.recipient,
  };
  sender.notifications.push(notification);
  req.app.locals.io.to(request.sender).emit("newNotification", notification);
  await sender.save();
  return res.json({ status: 201, success: true, message: "Request declined" });
});

exports.cancelFriendRequest = CatchAsync(async (req, res) => {
  const { requestId } = req.params;
  if (!mongoose.isValidObjectId(requestId)) {
    return res.json({ status: 403, success: false, message: "request id is not valid" });
  }
  const request = await FriendRequests.findById(requestId);
  if (!request)
    return res.json({
      status: 401,
      success: false,
      message: "Request not found",
    });
  if (request.sender.toString() !== req.user.id)
    return res.json({ status: 403, success: false, message: "Unauthorized" });

  if (request.status === "cancelled")
    return res.json({
      status: 400,
      success: false,
      message: "Request already cancelled",
    });

  if (request.status !== "pending")
    return res.json({
      status: 400,
      success: false,
      message: "Request is not on pending to cancel",
    });

  request.status = "cancelled";
  await request.save();
  return res.json({ status: 201, success: true, message: "Request cancelled" });
});

exports.updateShortListedUsers = CatchAsync(async (req, res) => {
  const { userId } = req.body;
  if (!userId)
    return res.json({
      success: false,
      status: 300,
      message: "Please provide user id to add/remove",
    });

  if (!mongoose.isValidObjectId(userId)) {
    return res.json({ status: 403, success: false, message: "user id is not valid" });
  }

  const shortListUser = await User.findById(userId);
  if (!shortListUser)
    return res.json({
      success: false,
      status: 404,
      message: "User not found",
    });

  const user = await User.findById(req.user.id);
  if (!user)
    return res.json({
      success: false,
      status: 404,
      message: "User error. please re-login",
    });

  if (!user.shortlists.includes(userId)) {
    user.shortlists.addToSet(userId);
    await user.save();
  } else {
    user.shortlists.pull(userId);
    await user.save();
  }

  return res.json({
    status: 201,
    success: true,
    message: `user has ${user.shortlists.includes(userId) ? "added to" : "removed from"
      } your shortlist`,
  });
});

exports.listMyShortList = CatchAsync(async (req, res) => {
  const user = await User.findById(req.user.id).populate(
    "shortlists",
    "username profilePic"
  );
  if (!user)
    return res.json({
      success: false,
      status: 404,
      message: "User error. please re-login",
    });

  if (!user.shortlists.length)
    return res.json({
      success: false,
      status: 300,
      message: "Nothing to show",
    });

  return res.json({
    status: 201,
    success: true,
    message: `your shortlisted users`,
    shortlist: user.shortlists,
  });
});

exports.ListShortListedBy = CatchAsync(async (req, res) => {
  const users = await User.find(
    { shortlists: { $in: [req.user.id] } },
    "username profilePic"
  );
  if (!users.length)
    return res.json({
      success: false,
      status: 300,
      message: "Nothing to show",
    });

  return res.json({
    success: true,
    status: 200,
    message: `List of users who shortlisted you`,
    shortlist: users,
  });
});

exports.listMyProfileViewers = CatchAsync(async (req, res) => {
  const user = await User.findById(req.user.id).populate(
    "viewers",
    "username profilePic"
  );
  if (!user)
    return res.json({
      success: false,
      status: 404,
      message: "User error. please re-login",
    });

  if (!user.viewers.length)
    return res.json({
      success: false,
      status: 300,
      message: "Nothing to show",
    });

  return res.json({
    status: 201,
    success: true,
    message: `your profile viewed users`,
    viewers: user.viewers,
  });
});
