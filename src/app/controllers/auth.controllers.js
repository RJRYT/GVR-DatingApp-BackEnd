const passport = require("passport");
const bcrypt = require("bcryptjs");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../config/token.config");

const twilio = require("twilio");
const client = new twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const User = require("../models").user;

exports.test = (req, res) => {
  res.json({ status: 200, success: true, message: "hello world from auth" });
};

exports.doLogin = async (req, res) => {
  const { email, password, phoneNumber } = req.body;
  try {
    let query = {};
    if (email) query.email = email;
    else if (phoneNumber) query.phoneNumber = phoneNumber;
    else return res.json({ status: 400, success: false, message: "Missing credentials" });
    const user = await User.findOne(query);
    if (!user) return res.json({ status: 400, success: false, message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.json({ status: 400, success: false, message: "Invalid credentials" });

    const AccessToken = generateAccessToken({ id: user.id });
    const RefreshToken = generateRefreshToken({ id: user.id });

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

    res.json({ status: 200, success: true, message: "Login successful", AccessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, success: false, message: "Server error" });
  }
};

exports.doLogout = async (req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ status: 200, success: true, message: "Logout successful" });
};

exports.doRegister = async (req, res) => {
  const { username, email, password, phoneNumber, otp } = req.body;
  try {
    let user = await User.findOne({
      $or: [{ email }, { phoneNumber }],
    });
    if (user) return res.json({ status: 400, success: false, message: "User already exists" });

    client.verify.v2
      .services(process.env.TWILIO_SERVICE_SID)
      .verificationChecks.create({ to: `+91${phoneNumber}`, code: otp })
      .then(async (verification_check) => {
        if (verification_check.status) {
          user = new User({ username, email, password, phoneNumber });
          const AccessToken = generateAccessToken({ id: user.id });
          const RefreshToken = generateRefreshToken({ id: user.id });

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
          res.json({ status: 200, success: true, message: "Registration completed", AccessToken });
        }
      })
      .catch((err) => {
        console.log("Twilio verify error: ", err);
        res.json({ status: 400, success: false, message: "OTP expired/invalid. please generate a new one" });
      })
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, success: false, message: "Server error" });
  }
};

exports.GoogleLogin = passport.authenticate("google", {
  scope: ["profile", "email"],
});

exports.PassportVerify = passport.authenticate("google", {
  failureRedirect: process.env.FRONTEND_URL + "/login?error=GoogleOAuthFailed",
});

exports.GoogleCallBack = (req, res) => {
  const AccessToken = generateAccessToken({ id: req.user.id });
  const RefreshToken = generateRefreshToken({ id: req.user.id });

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
  res.redirect(`${process.env.FRONTEND_URL}/login?token=${AccessToken}`);
};

exports.SendCode = async (req, res) => {
  const { phoneNumber } = req.body;
  client.verify.v2
    .services(process.env.TWILIO_SERVICE_SID)
    .verifications.create({ to: `+91${phoneNumber}`, channel: "sms" })
    .then((verification) => {
      console.log(verification.sid);
      res.json({ status: 200, success: true, message: "OTP sent successfully" });
    })
    .catch((error) => {
      console.log("Twilio sendcode error: ", error);
      res.status(500).send({ status: 200, success: false, message: "Failed to send OTP" });
    });
};
