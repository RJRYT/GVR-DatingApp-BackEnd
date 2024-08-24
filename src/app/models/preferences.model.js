const mongoose = require('mongoose');

const PreferencesSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  AgeRange: {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
  },
  HeightRange: {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
  },
  WeightRange: {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
  },
  Location: [{ label: String, value: String }],
  Interests:  [{ label: String, value: String }],
  Hobbies:  [{ label: String, value: String }],
  Education:  [{ label: String, value: String }],
  Religion: {
    value: { type: String, required: true },
    label: { type: String, required: true },
  },
  Gender: {
    value: { type: String, required: true },
    label: { type: String, required: true },
  },
  Occupation:  {
    value: { type: String, required: true },
    label: { type: String, required: true },
  },
  LifeStyle:  [{ label: String, value: String }],
  Relation: {
    value: { type: String, required: true },
    label: { type: String, required: true },
  },
  fake: { type: Boolean },
});


module.exports = mongoose.model("Preferences", PreferencesSchema);