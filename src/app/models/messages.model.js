const { ReplicationTimeStatus } = require('@aws-sdk/client-s3');
const mongoose = require('mongoose');

const MessagesSchema = mongoose.Schema(
    {
        chatName: { type: String, trim:true },
        isGroupChat: { type: Boolean, default: false},
        users: [{
            type: mongoose.Schema.Types.ObjectId,
            ref:"User",
        },
        ],
        latestMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref:"Chat",
        },
        groupAdmin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
       },
    },
     {
        timeStamps: true
     })

    module.exports =  mongoose.model("message", MessagesSchema);