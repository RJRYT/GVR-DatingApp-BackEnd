const mongoose =require('mongoose');
const bcrypt=require("bcryptjs");

const AdminSchema = mongoose.Schema({
    firstName: { type: String },
    lastName: { type: String },
    email: { type: String, unique: true, sparse: true },
    phoneNumber: { type: String, unique: true, sparse: true },
    nationality: { type: String },
    password : { type: String },
    designation : { type: String }
})

AdminSchema.index({ email: 1 }, { unique: true, sparse: true });
AdminSchema.index({ phoneNumber: 1 }, { unique: true, sparse: true });


AdminSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  });

  module.exports = mongoose.model('adminDetails', AdminSchema);