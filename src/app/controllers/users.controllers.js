const { User } = require("../models");
const jwt = require("jsonwebtoken");
const s3Config = require("../config/aws.config");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { generateAccessToken } = require("../services").Token;
const CatchAsync = require("../util/catchAsync");
const { UploadMiddleware } = require("../middlewares");

exports.test = (req, res) => {
  res.json({ status: 200, success: true, message: "hello world from users" });
};

exports.RefreshToken = CatchAsync(async (req, res) => {
  const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(403).json({ status: 403, success: false, message: "Refresh token not found" });
  }

  jwt.verify(
    refreshToken,
    process.env.JWT_REFRESH_TOKEN_SECRET,
    (err, user) => {
      if (err) return res.status(403).json({ status: 403, success: false, message: "Server error" });

      const accessToken = generateAccessToken({ id: user.id });
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
      });

      res.json({ status: 200, success: true, message: "Token regenerated", accessToken });
    }
  );
});

exports.CheckUser = CatchAsync(async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json({ status: 200, success: true, message: "User found", user });
});

exports.saveUploadedPic = CatchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.json({ status: 404, success: false, message: "User not found" });
  }

  // if (user.personalInfoSubmitted) {
  //   return res.json({ status: 404, success: false, message: "Personal section already completed." });
  // }

  if (user.profilePic) {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: user.profilePic.key,
    };
    await s3Config.send(new DeleteObjectCommand(params));
  }

  user.profilePic = { url: req.file.location, key: req.file.key };

  await user.save();
  res.json({
    status: 200, success: true,
    message: "Profile picture uploaded successfully",
    profilePic: user.profilePic,
  });
});

exports.saveImages = CatchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.json({ status: 404, success: false, message: "User not found" });
  }

  // if (user.personalInfoSubmitted) {
  //   return res.json({ status: 404, success: false, message: "Personal section already completed." });
  // }

  if (user.images.length > 0) {
    for (const pic of user.images) {
      const params = { Bucket: process.env.S3_BUCKET, Key: pic.key };
      await s3Config.send(new DeleteObjectCommand(params));
    }
  }

  user.images = req.files.map((file) => ({
    url: file.location,
    key: file.key,
  }));

  await user.save();
  res.json({
    status: 200, success: true,
    message: "Images uploaded successfully",
    images: user.images,
  });
});

exports.saveUploadedReel = CatchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.json({ status: 404, success: false, message: "User not found" });
  }

  // if (user.personalInfoSubmitted) {
  //   return res.json({status: 404, success: false, message: "Personal section already completed." });
  // }

  if (user.shortReel) {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: user.shortReel.key,
    };
    await s3Config.send(new DeleteObjectCommand(params));
  }

  user.shortReel = { url: req.file.location, key: req.file.key };
  await user.save();
  res.json({
    status: 200, success: true,
    message: "Short reel uploaded successfully",
    shortReel: user.shortReel,
  });
});

exports.updateUserPersonalDetails = CatchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.json({ status: 404, success: false, message: "User not found" });
  } else if (user.personalInfoSubmitted) {
    return res.json({ status: 404, success: false, message: "Personal details already added" });
  }

  user.age = req.body.age;
  user.dateOfBirth = req.body.dateOfBirth;
  user.gender = req.body.gender;
  user.hobbies = req.body.hobbies;
  user.location = req.body.location;
  user.interests = req.body.interests;
  user.smokingHabits = req.body.smokingHabits;
  user.drinkingHabits = req.body.drinkingHabits;
  user.qualification = req.body.qualification;
  user.personalInfoSubmitted = true;

  await user.save();

  res.json({ status: 200, success: true, message: "Updated successfully" });
});

exports.updateUserProfessinalDetails = CatchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.json({ status: 404, success: false, message: "User not found" });
  } else if (user.professionalInfoSubmitted) {
    return res.json({ status: 404, success: false, message: "Professional details already added" });
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
    return res.json({ status: 404, success: false, message: "purpose already added" });
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

exports.addUserProfileInfo = CatchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.json({ status: 404, success: false, message: "User not found. upload failed" });
  } else if (user.personalInfoSubmitted) {
    return res.json({ status: 404, success: false, message: "Personal details already added. upload cancelled" });
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
  user.shortReel = { url: req.files.shortreels.location, key: req.files.shortreels.key };
  user.images = req.files.images.map((file) => ({
    url: file.location,
    key: file.key,
  }));
  user.profilePic = { url: req.files.profilepic.location, key: req.files.profilepic.key };

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