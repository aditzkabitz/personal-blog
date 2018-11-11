var mongoose = require("mongoose");

// mongoose model config
var blogSchema = new mongoose.Schema({
    title: String,
    image: String,
    body: String,
    likes: {type:Number,default:0},
    likedby: [ 
        {
        type: String
        }
    ],
    created: {type: Date, default: Date.now},
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            red: "User"
        },
        username: String
    },
    comments: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment"
        }
    ]
});

module.exports = mongoose.model("Blog", blogSchema);

