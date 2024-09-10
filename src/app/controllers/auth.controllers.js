const passport = require("passport");
const bcrypt = require("bcryptjs");
const { User, Session } = require("../models");
const CatchAsync = require("../util/catchAsync");
const crypto = require("crypto");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../services").Token;

const twilio = require("twilio");
const client = new twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

exports.test = (req, res) => {
  res.json({ status: 200, success: true, message: "hello world from auth" });
};

exports.doLogin = CatchAsync(async (req, res) => {
  const { email, password, phoneNumber } = req.body;
  let query = {};
  if (email) query.email = email;
  else if (phoneNumber) query.phoneNumber = phoneNumber;
  else return res.json({ status: 400, success: false, message: "Missing credentials" });
  const user = await User.findOne(query);
  if (!user) return res.json({ status: 400, success: false, message: "User not found" });
  if (!user.password) return res.json({ status: 400, success: false, message: "Invalid login method. try login with google" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch)
    return res.json({ status: 400, success: false, message: "Invalid credentials" });

  if (user.twoFA) {
    // If 2FA is enabled, redirect to the 2FA verification page
    const TempToken = generateAccessToken({ id: user.id });
    return res.json({ status: 200, success: true, message: "2FA required", twoFA: true, token: TempToken });
  }
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

  res.json({ status: 200, success: true, message: "Login successful", AccessToken, RefreshToken });
});

exports.doLogout = CatchAsync(async (req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  await Session.deleteOne({ sessionId: req.user.sessionId });
  res.json({ status: 200, success: true, message: "Logout successful" });
});

exports.doRegister = CatchAsync(async (req, res) => {
  const { username, email, password, phoneNumber, otp } = req.body;

  let user = await User.findOne({
    $or: [{ email }, { phoneNumber }],
  });
  if (user) return res.json({ status: 400, success: false, message: "User already exists" });

  const result = await verifyOtp(phoneNumber, otp);

  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message });
  }

  user = new User({ username, email, password, phoneNumber });

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
  user.numberVerified = true;
  await user.save();
  res.json({ status: 200, success: true, message: "Registration completed", AccessToken, RefreshToken });
});

exports.GoogleLogin = passport.authenticate("google", {
  scope: ["profile", "email"],
  session: false,
});

exports.PassportVerify = passport.authenticate("google", {
  failureRedirect: process.env.FRONTEND_URL + "/login?error=GoogleOAuthFailed",
  session: false,
});

exports.GoogleCallBack = CatchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  if (!user.twoFA) {
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

    return res.redirect(`${process.env.FRONTEND_URL}/login?token=${AccessToken}`);
  }
  const TempToken = generateAccessToken({ id: user.id });
  res.redirect(`${process.env.FRONTEND_URL}/login/2fa/?token=${TempToken}`);
});

exports.SendCode = CatchAsync(async (req, res) => {
  const { phoneNumber } = req.body;
  client.verify.v2
    .services(process.env.TWILIO_SERVICE_SID)
    .verifications.create({ to: `+91${phoneNumber}`, channel: "sms" })
    .then((verification) => {
      res.json({ status: 200, success: true, message: "OTP sent successfully" });
    })
    .catch((error) => {
      console.log("Twilio sendcode error: ", error);
      res.status(500).send({ status: 200, success: false, message: "Failed to send OTP" });
    });
});

// Function to verify OTP using Twilio
async function verifyOtp(phoneNumber, otp) {
  if (!phoneNumber || !otp) {
    throw new Error('Phone number and OTP must be provided');
  }

  try {
    console.log('Verifying OTP for phone number:', phoneNumber); // Debugging line

    const verificationCheck = await client.verify.v2
      .services(process.env.TWILIO_SERVICE_SID)
      .verificationChecks
      .create({ to: `+91${phoneNumber}`, code: otp });

    console.log("otp verify output: ", verificationCheck)

    if (verificationCheck.status === 'approved') {
      return { success: true };
    } else {
      return { success: false, message: 'Invalid OTP' };
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw new Error('OTP verification failed');
  }
}

// Function to handle OTP verification and user update
exports.verifyCode = CatchAsync(async (req, res) => {
  const { phoneNumber, otp, userId } = req.body;
  //const userId = req.user.id;

  try {
    if (!phoneNumber || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP must be provided' });
    }

    const result = await verifyOtp(phoneNumber, otp);

    if (result.success) {
      // Find the user by userId and update their phone number and verification status
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const user = await User.findById(userId);

      if (user) {
        user.phoneNumber = phoneNumber;
        user.numberVerified = true;
        await user.save();
        return res.status(200).json({ success: true, message: 'OTP verified and phone number updated successfully' });
      } else {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
    } else {
      return res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('Error in OTP verification route:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
