const { User, FriendRequests, PrivateChat, Session, MatchPoints, Preference, Subscriptions } = require("../models");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const s3Config = require("../config/aws.config");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { generateAccessToken, generateRefreshToken } = require("../services").Token;
const CatchAsync = require("../util/catchAsync");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { calculateMatchPercentage, getDistanceFromLatLonInKm } = require("../util/MatchUtil");

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

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_TOKEN_SECRET);

    if (!decoded.sessionId)
      return res.status(403).json({ status: 403, success: false, message: "Session id not found" });

    // Verify if session is still active
    const session = await Session.findOne({ sessionId: decoded.sessionId });

    if (!session)
      return res.status(403).json({ status: 403, success: false, message: 'Session expired. Please log in again.' });

    const accessToken = generateAccessToken({ id: session.userId, sessionId: session.sessionId });
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
    });

    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    const remainingTime = decoded.exp - currentTime; // Time left before expiration in seconds

    const timeThreshold = 2 * 24 * 60 * 60; // 2 days threshold

    if (remainingTime < timeThreshold) {
      const refreshToken = generateRefreshToken({ id: session.userId, sessionId: session.sessionId });
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
      });
    }

    res.json({
      status: 200,
      success: true,
      message: "Token regenerated",
      accessToken,
    });
  } catch (error) {
    return res
      .status(403)
      .json({ status: 403, success: false, message: 'Invalid refresh token.' });
  }
});

exports.CheckUser = CatchAsync(async (req, res) => {
  const { lat, lon } = req.query;
  const user = await User.findById(req.user.id).select("-password");
  if (lat && lon) {
    user.currentLocation = {};
    user.currentLocation.latitude = lat;
    user.currentLocation.longitude = lon;
    await user.save();
  }

  const chats = await PrivateChat.find({ participants: req.user.id }).populate('messages').sort({ updatedAt: -1 });
  let unreadMessages = 0, unreadChats = 0;
  await Promise.all(chats.map(async chat => {
    if (chat.messages.length) {
      const chatsunreaded = chat.messages.some(message => !message.read && message.sender.toString() !== req.user.id);
      if (chatsunreaded) unreadChats++;
      chat.messages.map(message => {
        if (!message.read && message.sender.toString() !== req.user.id) unreadMessages++;
      })
    }
  }));
  if (unreadMessages && unreadChats) {
    user.notifications = user.notifications.filter(notif => notif.type !== "newMessage");
    const messageString = `You have ${unreadMessages}+ messages(s) from ${unreadChats} chat(s)`;
    const notification = {
      type: "newMessage",
      message: messageString,
      from: req.user.id,
    };
    user.notifications.push(notification);
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

  const matchPoints = await MatchPoints.findOne({});

  const preferences = await Preference.findOne({ userId: req.user.id }) || {};

  const requester = await User.findById(req.user.id);

  const chat = await PrivateChat.findOne({ participants: { $all: [userId, req.user.id] } })

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

  const UpdatedUser = await User.findById(
    userId,
    "username age dateOfBirth gender location hobbies interests smokingHabits drinkingHabits qualification profilePic shortReel"
  ).lean();

  const matchPercentage = await calculateMatchPercentage(UpdatedUser, preferences, matchPoints);
  const distanceFromUser = await getDistanceFromLatLonInKm(requester.location.latitude, requester.location.longitude, UpdatedUser.location.latitude, UpdatedUser.location.longitude);
  const modifiedUser = { ...UpdatedUser, matchPercentage: matchPercentage.toFixed(2), distance: distanceFromUser.toFixed(2) }

  res.json({ status: 200, success: true, user: modifiedUser, chat: chat?._id, message: "User found" });
});

exports.rejectUserProfile = CatchAsync(async (req, res) => {
  const { rejectedUserId } = req.body;
  const userId = req.user.id;

  if (!rejectedUserId) return res.json({ status: 403, success: false, message: "\"rejectedUserId\" is not found in request body" });
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

exports.privacyDetails = CatchAsync(async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('lastLogin twoFA lastDeviceName lastIpAddress');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Format the lastLogin date
    const now = new Date();
    const lastLoginDate = new Date(user.lastLogin);
    const isToday = now.toDateString() === lastLoginDate.toDateString();
    const formattedTime = lastLoginDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const lastLoginFormatted = isToday ? `Today at ${formattedTime}` : lastLoginDate.toLocaleString();

    res.json({
      lastSignInTime: lastLoginFormatted,
      twoFactorEnabled: user.twoFA,
      lastDeviceName: user.lastDeviceName,
      lastIpAddress: user.lastIpAddress,
    });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

exports.twoFAStatusUpdate = (async (req, res) => {
  try {
    const userId = req.user.id;
    const { twoFactorEnabled } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.twoFA = twoFactorEnabled;
    await user.save();

    res.json({ message: '2FA status updated successfully', twoFactorEnabled: user.twoFA });
  } catch (error) {
    console.error('Error updating 2FA status:', error);
    res.status(500).json({ message: 'Server error' });
  }
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
  const { firstName, lastName, username, about, replacedImages } = req.body;
  const replacedImgArray = replacedImages.trim().split(",");

  // Find user and proceed with profile update if OTP is verified
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // Handle file deletions and uploads (only delete old files if new ones are uploaded)
  const deleteFile = async (key) => {
    if (key) {
      const params = { Bucket: process.env.S3_BUCKET, Key: key };
      await s3Config.send(new DeleteObjectCommand(params));
    }
  };

  // File deletion only if new files are uploaded
  try {
    if (req.files) {
      if (req.files.profilePic) {
        // Delete old profilePic only if a new one is uploaded
        await deleteFile(user.profilePic?.key);
      }

      if (req.files.shortreels) {
        // Delete old short reel only if a new one is uploaded
        await deleteFile(user.shortReel?.key);
      }
    }

    if (req.files.images && replacedImgArray.length) {
      await Promise.all(user.images.map((pic) => {
        if (replacedImgArray.includes(pic.key)) {
          user.images = user.images.filter(img => img.url !== pic.url);
          return deleteFile(pic.key)
        }
      }));
    }

    //remove images with key null
    user.images = user.images.filter(img => img.key);

  } catch (fileDeleteError) {
    console.error("Error deleting files:", fileDeleteError);
    return res.status(500).json({ success: false, message: "Error deleting old files" });
  }

  // Update with new files if they exist in req.files
  if (req.files) {
    if (req.files.profilepic) {
      user.profilePic = {
        url: req.files.profilepic[0]?.location,
        key: req.files.profilepic[0]?.key,
      };
    }
    if (req.files.images) {
      // Append new images to the existing ones instead of replacing them
      user.images = [
        ...user.images,  // Keep existing images
        ...req.files.images.map((file) => ({
          url: file.location,
          key: file.key,
        })),
      ];
    }

    if (req.files.shortreels) {
      user.shortReel = {
        url: req.files.shortreels[0]?.location,
        key: req.files.shortreels[0]?.key,
      };
    }
  }

  // Update other user details (basic information)
  user.firstName = firstName;
  user.lastName = lastName;
  user.about = about;
  if (!user.username && username) {
    user.username = username;
  }

  // Save the updated user document
  try {
    await user.save();
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profilePic: user.profilePic, // Send the updated profilePic URL
      images: user.images,
      reel: user.shortReel,
    });
  } catch (error) {
    console.error("Error saving user:", error);
    return res.status(500).json({ success: false, message: "Failed to update profile", error: error.message });
  }
});

exports.displayStories = CatchAsync(async (req, res) => {

  const user = await User.findById(req.user.id)
    .populate({
      path: 'friends',
      select: 'username shortReel profilePic'
    })
    .exec();

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const userStory = {
    username: user.username,
    profilePic: user.profilePic ? user.profilePic.url : null,
    shortReel: user.shortReel ? user.shortReel.url : null,  // Assuming you want the first short reel
  };

  const friendsStories = user.friends.map(friend => ({
    username: friend.username,
    profilePic: friend.profilePic ? friend.profilePic.url : null,
    shortReel: friend.shortReel ? friend.shortReel.url : null,
  }));

  const stories = [userStory, ...friendsStories];
  res.status(200).json({ stories });
})

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
  }).populate("sender", "username profilePic about").lean();

  if (!pendingFriends.length)
    return res.json({
      success: false,
      status: 300,
      message: "Nothing to show",
    });

  const filteredRequests = pendingFriends.filter(req => req.sender !== null);
  return res.json({
    success: true,
    status: 200,
    message: `Friends pending friend list`,
    pending: filteredRequests,
  });
});

exports.fetchFriendRequests = CatchAsync(async (req, res) => {
  const type = req.query.type || "pending";
  try {
    const friendsReqs = await FriendRequests.find({
      status: type,
      sender: req.user.id,
    }).populate("recipient", "username profilePic about").lean();
    if (!friendsReqs.length)
      return res.json({
        success: false,
        status: 300,
        message: "Nothing to show",
      });

    const filteredRequests = friendsReqs.filter(req => req.recipient !== null);
    return res.json({
      success: true,
      status: 200,
      message: `Friends ${type} list`,
      [type]: filteredRequests,
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

exports.generateTwoFASecret = CatchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Generate a secret key for the user
  const secret = speakeasy.generateSecret({ name: `Dating App: ${user.email}` });

  // Generate the QR code
  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

  // Save the secret to the user record (ensure it's stored securely)
  user.twoFASecret = secret.base32;
  await user.save();

  // Return the QR code and secret to the frontend
  res.json({
    qrCodeUrl,
    secret: secret.base32,
  });
});

exports.verifyTwoFACode = CatchAsync(async (req, res) => {
  const { token } = req.body;  // The 6-digit code from the user

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const isVerified = speakeasy.totp.verify({
    secret: user.twoFASecret,
    encoding: 'base32',
    token,
  });

  if (isVerified) {
    user.twoFA = true;  // Enable 2FA
    await user.save();
    return res.json({ success: true, message: '2FA enabled successfully' });
  } else {
    return res.status(400).json({ success: false, message: 'Invalid 2FA code' });
  }
});

exports.verifyTwoFAToken = CatchAsync(async (req, res) => {
  const { token, code } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isVerified = speakeasy.totp.verify({
      secret: user.twoFASecret,
      encoding: 'base32',
      token: code,
    });

    if (isVerified) {
      // Update last login details
      const userAgent = req.headers['user-agent'];
      const deviceInfo = userAgent || 'Unknown Device';
      const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

      // Generate session ID
      const sessionId = crypto.randomBytes(16).toString('hex');

      const AccessToken = generateAccessToken({ id: user.id, sessionId });
      const RefreshToken = generateRefreshToken({ id: user.id, sessionId });

      const session = new Session({
        userId: user.id || user._id,
        sessionId,
        deviceInfo,
        ipAddress
      });
      await session.save();

      user.lastLogin = new Date();
      user.lastDeviceName = deviceInfo;
      user.lastIpAddress = ipAddress;
      await user.save();

      res.cookie("accessToken", AccessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
      });

      res.cookie("refreshToken", RefreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
      });

      return res.json({ success: true, message: '2FA enabled successfully', token: AccessToken });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid 2FA code' });
    }
  } catch (error) {
    res.status(500).json({ status: 500, success: false, message: "Token is not valid" });
  }
});

exports.getActiveSessions = async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user.id });

    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

exports.deleteAllSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const currentSessionId = req.user.sessionId;

    await Session.deleteMany({ userId, sessionId: { $ne: currentSessionId } });

    res.json({ message: 'All sessions cleared' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

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
    "username profilePic about"
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
    "username profilePic about"
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
    "username profilePic about"
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

exports.deleteImage = CatchAsync(async (req, res) => {
  const { imageUrl } = req.body;

  // Find user
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // Find the image to delete
  const image = user.images.find(img => img.url === imageUrl);
  if (!image) {
    return res.status(404).json({ success: false, message: "Image not found" });
  }

  // Delete image from S3
  try {
    if (image.key) {
      const params = { Bucket: process.env.S3_BUCKET, Key: image.key };
      await s3Config.send(new DeleteObjectCommand(params));
    }
  } catch (error) {
    console.error(`Error deleting image with key: ${image.key}`, error);
    return res.status(500).json({ success: false, message: "Error deleting image from S3" });
  }

  // Remove image from user's profile
  user.images = user.images.filter(img => img.url !== imageUrl);

  // Save the updated user document
  try {
    await user.save();
    return res.status(200).json({
      success: true,
      message: "Image deleted successfully",
      images: user.images,
    });
  } catch (error) {
    console.error("Error saving user:", error);
    return res.status(500).json({ success: false, message: "Failed to update user profile", error: error.message });
  }
});

exports.getPrimePlan = CatchAsync(async (req, res) => {
  const plan = await Subscriptions.findOne({status:"active"});

  if(!plan) return res.status(200).json({ success: false, message: "No plan avaliable to show" });

  res.status(200).json({ success: true, message: "current prime plan", plan });
});