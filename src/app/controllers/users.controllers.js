const { User, FriendRequests, PrivateChat } = require("../models");
const jwt = require("jsonwebtoken");
const s3Config = require("../config/aws.config");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { generateAccessToken } = require("../services").Token;
const CatchAsync = require("../util/catchAsync");
const bcrypt = require("bcryptjs");
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

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
  const user = await User.findById(req.user.id).select("-password");
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
    url: req.files.shortreels.location,
    key: req.files.shortreels.key,
  };
  user.images = req.files.images.map((file) => ({
    url: file.location,
    key: file.key,
  }));
  user.profilePic = {
    url: req.files.profilepic.location,
    key: req.files.profilepic.key,
  };

  //saving other values
  user.age = req.body.age;
  user.dateOfBirth = req.body.dateOfBirth;
  user.gender = req.body.gender;
  user.hobbies = JSON.parse(req.body.hobbies);
  user.location = req.body.location;
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

  const user = await User.findById(
    userId,
    "username age dateOfBirth gender location hobbies interests smokingHabits drinkingHabits qualification profilePic shortReel"
  );

  if (!user) {
    return res.json({ status: 404, success: false, message: "User not found" });
  }

  res.json({ status: 200, success: true, user, message: "User found" });
});



exports.privacyDetails = CatchAsync(async (req, res) => {
  try {
    const userId = req.user.id;  // Use `req.user.id` for authenticated user ID
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



exports.twoFAStatusUpdate= (async (req, res) => {
  try {
    const userId = req.user.id;  // Assuming `req.user.id` holds the authenticated user's ID
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

exports.MarkNotificationAsRead = CatchAsync(async (req, res) => {
  const { userId, notificationId } = req.body;

  await User.updateOne(
    { _id: userId, "notifications._id": notificationId },
    { $set: { "notifications.$.read": true } }
  );

  res.json({
    success: true,
    status: 200,
    message: "notification marked as read",
  });
});

exports.deleteNotification = CatchAsync(async (req, res) => {
  const { userId, notificationId } = req.body;

  await User.deleteOne({ _id: userId, "notifications._id": notificationId });

  res.json({ success: true, status: 200, message: "notification deleted" });
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

  // Add a new notification to the recipient's notifications array
  const notification = {
    type: "FriendRequest",
    message: `You have a new friend request from ${req.user.username}`,
    from: req.user.id,
  };
  recipient.notifications.push(notification);
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

  sender.friends.push(request.recipient);
  recipient.friends.push(request.sender);

  const notification = {
    type: "requestAccepted",
    message: `${req.user.username} accepted your friend request`,
    from: request.recipient,
  };
  sender.notifications.push(notification);
  await sender.save();
  await recipient.save();

  return res.json({ status: 201, success: true, message: "Request accepted" });
});

exports.declineFriendRequest = CatchAsync(async (req, res) => {
  const { requestId } = req.params;
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

  const notification = {
    type: "requestDeclined",
    message: `${req.user.username} declined your friend request`,
    from: request.recipient,
  };
  sender.notifications.push(notification);
  await sender.save();
  return res.json({ status: 201, success: true, message: "Request declined" });
});

exports.cancelFriendRequest = CatchAsync(async (req, res) => {
  const { requestId } = req.params;
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


exports.logUser = CatchAsync(async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");

  if (!user) {
    return res.status(404).json({ status: 404, success: false, message: "User not found" });
  }

  // Update lastLogin, deviceName, and ipAddress fields
  user.lastLogin = new Date();
  user.deviceName = req.headers['user-agent'] || 'Unknown device'; // Get device name from User-Agent
  user.ipAddress = req.ip; // Get IP address

  await user.save();

  res.json({ status: 200, success: true, message: "User found", user });
});


exports.generateTwoFASecret = CatchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Generate a secret key for the user
  const secret = speakeasy.generateSecret({ name: `MyApp (${user.email})` });

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
  console.log(token)
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

    const userAgent = req.headers['user-agent'];
    const device = userAgent || 'Unknown Device';

    // Extract IP address
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Update last login details
    user.lastLogin = new Date();
    user.lastDeviceName = device;
    user.lastIpAddress = ip;


    const session = {
      token,
      device,
      ipAddress: ip,
      lastActive: new Date(),
    };

    user.sessions.push(session);
    await user.save();

    return res.json({ success: true, message: '2FA enabled successfully' });
  } else {
    return res.status(400).json({ success: false, message: 'Invalid 2FA code' });
  }
});


exports.getActiveSessions = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('sessions');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.sessions);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

exports.deleteAllSessions = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.sessions = [];
    await user.save();

    res.json({ message: 'All sessions cleared' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

