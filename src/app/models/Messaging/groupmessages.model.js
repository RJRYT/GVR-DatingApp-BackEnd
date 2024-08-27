const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: String,
  read: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  chatRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupChat' },
});

module.exports = mongoose.model('GroupMessages', messageSchema);
