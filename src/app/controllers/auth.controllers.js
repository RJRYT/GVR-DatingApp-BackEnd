const passport = require("passport");
const bcrypt = require("bcryptjs");
const { User } = require("../models");
const CatchAsync = require("../util/catchAsync");
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
  console.log("in dologin")
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


  const AccessToken = generateAccessToken({ id: user.id });
  const RefreshToken = generateRefreshToken({ id: user.id });

  if (user.twoFA) {
    // If 2FA is enabled, redirect to the 2FA verification page
    res.json({ status: 200, success: true, message: "2FA required", twoFA: true });
  } else {


   // Update last login details
   const userAgent = req.headers['user-agent'];
   const device = userAgent || 'Unknown Device';
   const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

   user.lastLogin = new Date();
   user.lastDeviceName = device;
   user.lastIpAddress = ip;

   if (!user.sessions) {
    user.sessions = [];
  }
   // Add session
   const session = {
     token: AccessToken,
     device,
     ipAddress: ip,
     lastActive: new Date(),
   };
   user.sessions.push(session);
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

   res.json({ status: 200, success: true, message: "Login successful", AccessToken });
  }
});

exports.doLogout = CatchAsync(async (req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.clearCookie("2fa");
  res.json({ status: 200, success: true, message: "Logout successful" });
});

exports.doRegister = CatchAsync(async (req, res) => {
  const { username, email, password, phoneNumber, otp } = req.body;

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
});

exports.GoogleLogin = passport.authenticate("google", {
  scope: ["profile", "email"],
});

exports.PassportVerify = passport.authenticate("google", {
  failureRedirect: process.env.FRONTEND_URL + "/login?error=GoogleOAuthFailed",
});

exports.GoogleCallBack = CatchAsync( async(req, res) => {
  console.log("in googleCallBack")
  const AccessToken = generateAccessToken({ id: req.user.id });
  const RefreshToken = generateRefreshToken({ id: req.user.id });

  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }


  if(user.twoFA === false){


    const userAgent = req.headers['user-agent'];
    const device = userAgent || 'Unknown Device';

    // Extract IP address
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Update last login details
    user.lastLogin = new Date();
    user.lastDeviceName = device;
    user.lastIpAddress = ip;


   if (!user.sessions) {
      user.sessions = [];
    }


    const session = {
      accessToken: AccessToken,
      refreshToken: RefreshToken,
      device,
      ipAddress: ip,
      lastActive: new Date(),
    };

    user.sessions.push(session);

    console.log(user)
    await user.save();

    res.cookie("2fa",user.twoFA, {
      secure: true,
      sameSite: 'None',
    });
  
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
  }
  else{
    
    user.accessToken = AccessToken;
    user.refreshToken = RefreshToken;
    await user.save();

    res.cookie("2fa", user.twoFA, {
      secure: true,
      sameSite: 'None',
    });

    res.cookie("userid", user.id, {
      secure: true,
      sameSite: 'None',
    });
 

  res.redirect(`${process.env.FRONTEND_URL}/login?token=${AccessToken}`);
}
});

exports.SendCode = CatchAsync(async (req, res) => {
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
  const { phoneNumber, otp , userId} = req.body;
  // const userId = req.userId; // Assuming userId is added to req by authentication middleware

  try {
    // Debugging: Log request data
    console.log('Request body:', req.body);
    console.log('Logged-in user ID:', userId);

    if (!phoneNumber || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP must be provided' });
    }

    // Verify OTP using Twilio
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
        return res.status(200).json({ success : true , message: 'OTP verified and phone number updated successfully' });
      } else {
        return res.status(404).json({ success: false ,  message: 'User not found' });
      }
    } else {
      return res.status(400).json({ success: false ,message: result.message });
    }
  } catch (error) {
    console.error('Error in OTP verification route:', error);
    return res.status(500).json({ success:false , message: 'Internal server error' });
  }
});
