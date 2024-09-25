const jwt = require("jsonwebtoken");
const { User, Session } = require("../models");

// Middleware to protect routes
module.exports = async(req, res, next) => {
  
  const token = req.header("x-auth-token") || req.cookies.accessToken;
  if (!token)
    return res.status(401).json({ status: 401, success: false, message: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
    if(!decoded.sessionId)
      return res.status(401).json({ status: 401, success: false, message: "Session id not found" });
    
    const session = await Session.findOne({ sessionId: decoded.sessionId });

    if (!session) 
      return res.status(401).json({ status: 401, success: false, message: "Session is no longer active." });
    
    session.lastActiveAt = Date.now();
    await session.save();
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ status: 401, success: false, message: "Token is not valid" });
  }
};