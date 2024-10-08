const jwt = require("jsonwebtoken");

//JWT Access token and Refresh token generator
exports.generateAccessToken = (user) => {
  return jwt.sign(user, process.env.JWT_ACCESS_TOKEN_SECRET, {
    expiresIn: "5h",
  });
};

exports.generateRefreshToken = (user) => {
  return jwt.sign(user, process.env.JWT_REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
};

exports.generateAdminToken = (admin) => {
  return jwt.sign(admin, process.env.JWT_ACCESS_TOKEN_SECRET, {
    expiresIn: "1d",
  });
};