const mongoose = require('mongoose');

const privateChatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PrivateMessages' }],
},
{ 
  timestamps: true 
});

module.exports = mongoose.model('PrivateChat', privateChatSchema);
