const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
    name: { type: String },
    price: { type: Number },
    duration: { type: Number },
    subscriptiontype: { 
        type: String, 
        enum: ['dating', 'matrimony', 'studyabroad', 'jobportal'], 
        default: 'dating' // Default value
    },
    image: { type: String },
    description: { type: String } 
});

module.exports = mongoose.model("Subscription", SubscriptionSchema);
