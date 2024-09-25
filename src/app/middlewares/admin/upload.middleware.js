const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");
const crypto = require("crypto");
const s3Config = require("../../config/aws.config")


module.exports = multer({
    storage: multerS3({
      s3: s3Config,
      bucket: process.env.S3_BUCKET,
      acl: "public-read",
      metadata: function (req, file, cb) {
        cb(null, { fieldName: file.fieldname, originalname: file.originalname });
      },
      key: function (req, file, cb) {
        const subscriptionId = crypto.randomBytes(8).toString("hex"); // Generate a random subscription ID
        const randomString = crypto.randomBytes(6).toString("hex");
        const currentDate = new Date().toISOString().replace(/:/g, "-"); // Format date to avoid issues with colons
        const uniqueName = `subscriptions/${subscriptionId}_${randomString}_${currentDate}${path.extname(
          file.originalname
        )}`;
        cb(null, uniqueName); // Use the uniqueName as the S3 key
      },
    }),
    limits: {
      fileSize: 1024 * 1024 * 5, // Limit file size to 5MB (adjust as needed)
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
  
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error("Images only!"));
      }
    },
  });