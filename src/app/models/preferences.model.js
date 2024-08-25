const mongoose = require("mongoose");

const PreferencesSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  AgeRange: { min: Number, max: Number },
  HeightRange: { min: Number, max: Number },
  WeightRange: { min: Number, max: Number },
  Location: [{ label: String, value: String }],
  Interests: [{ label: String, value: String }],
  Hobbies: [{ label: String, value: String }],
  Education: [{ label: String, value: String }],
  Religion: { label: String, value: String },
  Gender: { label: String, value: String },
  Occupation: { label: String, value: String },
  LifeStyle: [{ label: String, value: String }],
  Relation: { label: String, value: String },
});

module.exports = mongoose.model("Preferences", PreferencesSchema);
