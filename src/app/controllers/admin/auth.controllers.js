const jwt = require("jsonwebtoken");
const CatchAsync = require("../../util/catchAsync");
const bcrypt = require("bcryptjs");
const Admin = require("../../models/Admin/adminDetails.model")


const JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET
const JWT_ADMIN_REFRESH_SECRET = process.env.JWT_ADMIN_REFRESH_SECRET

exports.adminLogin = CatchAsync( async (req, res) => {
  const { email, password } = req.body;
//   console.log("Credentials:",req.body);
  
  try {
    // Check if user exists
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({ success:false, message: 'Invalid email or password' });
    }

    // Compare password with hashed password in DB
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    // Create and send JWT token
    const adminToken = jwt.sign({ adminId: admin._id }, JWT_ADMIN_SECRET);
    const refreshToken = jwt.sign({ adminId: admin._id }, JWT_ADMIN_REFRESH_SECRET);

    res.status(200).json({ success: true, message: "Loggined as Admin", accessToken: adminToken , refreshToken: refreshToken});
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: 'Server error' });
  }
});