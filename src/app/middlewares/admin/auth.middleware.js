const jwt = require("jsonwebtoken");
const { Admin } = require("../../models");

// Middleware to protect routes
module.exports = async(req, res, next) => {
  console.log("subscription....")
  const token = req.header("x-auth-admintoken") || req.cookies.adminToken;
  if (!token)
    return res.status(401).json({ status: 401, success: false, message: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
    if(!decoded.adminId)
      return res.status(401).json({ status: 401, success: false, message: "admin id not found" });
    
    const admin = await Admin.findById(decoded.adminId);

    if (!admin) 
      return res.status(401).json({ status: 401, success: false, message: "Admin account not found." });
    
    req.admin = decoded;
    next();
  } catch (err) {
    res.status(401).json({ status: 401, success: false, message: "Token is not valid" });
  }
};