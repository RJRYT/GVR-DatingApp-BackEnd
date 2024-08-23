const mongoose = require('mongoose');

const groupChatSchema = new mongoose.Schema({
  name: String,
  description: { type: String },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  invitations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('GroupChat', groupChatSchema);
