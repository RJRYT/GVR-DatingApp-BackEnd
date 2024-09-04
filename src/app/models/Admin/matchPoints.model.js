const mongoose = require("mongoose");

const MatchPointsSchema = new mongoose.Schema({
  ageRange: { type: Number, default: 0 },    
  heightRange: { type: Number, default: 0 },  
  weightRange: { type: Number, default: 0 },  
  location: { type: Number, default: 0 },     
  interests: { type: Number, default: 0 },    
  hobbies: { type: Number, default: 0 },      
  education: { type: Number, default: 0 },    
  religion: { type: Number, default: 0 },     
  gender: { type: Number, default: 0 },       
  occupation: { type: Number, default: 0 },   
  lifestyle: { type: Number, default: 0 },    
  relation: { type: Number, default: 0 },     
});

module.exports = mongoose.model("matchPoints", MatchPointsSchema);