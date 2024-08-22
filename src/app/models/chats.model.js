const mongoose = require('mongoose');

const ChatSchema = mongoose.Schema(
    {
        sender : { type: mongoose.Schema.Types.ObjectId, ref: "User"},
        content : { type: String, trim: true},
        message : { type: mongoose.Schema.Types.ObjectId, ref: "Message"},
    },{
        timeStamps: true
    }
)

module.exports = mongoose.model("chat", ChatSchema);