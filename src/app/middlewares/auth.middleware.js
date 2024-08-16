const jwt = require("jsonwebtoken");

// Middleware to protect routes
module.exports = (req, res, next) => {
  const token = req.header("x-auth-token") || req.cookies.accessToken;
  if (!token)
    return res.status(401).json({ status: 401, success: false, message: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.log("[AuthMiddleware]: ",err);
    res.status(401).json({ status: 401, success: false, message: "Token is not valid" });
  }
};