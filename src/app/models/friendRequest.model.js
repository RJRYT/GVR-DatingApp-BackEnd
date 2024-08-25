const mongoose = require('mongoose');

const FriendRequestSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined", "cancelled"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("FriendRequests", FriendRequestSchema);
