const jwt = require("jsonwebtoken");
const CatchAsync = require("../../util/catchAsync");
const bcrypt = require("bcryptjs");
const { Admin } = require("../../models");
const { generateAdminToken } = require("../../services/token.services");

exports.test = (req, res) => {
  res.json({ status: 200, success: true, message: "hello world from admin auth" });
};

exports.adminLogin = CatchAsync(async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    // Compare password with hashed password in DB
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    // Create and send JWT token
    const adminToken = generateAdminToken({ adminId: admin._id });

    res.cookie("adminToken", adminToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
    });

    res.status(200).json({ success: true, message: "Log-in success", adminToken });
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: 'Server error' });
  }
});