const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, required: true, unique: true },
  deviceInfo: { type: String, default: 'Unknown Device' }, 
  ipAddress: { type: String, default: 'Unknown IP' },
  loginAt: { type: Date, default: Date.now, },
  lastActiveAt: { type: Date, default: Date.now },
});

sessionSchema.index({ lastActiveAt: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model('Session', sessionSchema);