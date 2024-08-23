const mongoose = require('mongoose');

const groupChatSchema = new mongoose.Schema({
  name: String,
  description: { type: String },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  invitations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GroupMessages' }],
},
{ 
  timestamps: true 
});

module.exports = mongoose.model('GroupChat', groupChatSchema);
