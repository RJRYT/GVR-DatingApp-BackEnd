const mongoose = require("mongoose");
const MongoUrl = process.env.MONGO_URI || "mongodb://0.0.0.0:27017/datingApp";

const connectDB = async () => {
  mongoose
    .connect(MongoUrl)
    .then(() => {
      console.log("[Database]: Connected to the database!");
    })
    .catch((err) => {
      console.log("[Database]: Cannot connect to the database!", err);
      process.exit();
    });
};

exports.mongoose = mongoose;

module.exports = connectDB;