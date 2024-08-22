const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: String,
  createdAt: { type: Date, default: Date.now },
  chatRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom' },
});

module.exports = mongoose.model('Message', messageSchema);
