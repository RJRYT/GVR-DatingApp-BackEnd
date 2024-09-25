const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
    name: { type: String },
    price: { type: Number },
    duration: { type: String },
    subscriptiontype: { 
        type: String, 
        enum: ['dating', 'matrimony', 'studyabroad', 'jobportal'], 
        default: 'dating' 
    },
   
    description: { type: String }, 
    status:{
        type:String,
        enum:['active','inactive'],
        default:'active'
    }
});

module.exports = mongoose.model("Subscription", SubscriptionSchema);
