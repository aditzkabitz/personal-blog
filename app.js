var express = require("express");
var app = express();
require('dotenv').config();
var bodyParser = require("body-parser");
var mongoose = require("mongoose");
var flash = require("connect-flash");
var methodOverride = require("method-override");
var expressSanitizer = require("express-sanitizer");
var Blog = require("./models/blog");
var Comment = require("./models/comment");
var passport = require("passport");
var LocalStrategy = require("passport-local");
var passportLocalMongoose = require("passport-local-mongoose");
var User = require("./models/user");
var multer = require('multer');
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter})

var cloudinary = require('cloudinary');
cloudinary.config({ 
  cloud_name: 'adityag345', 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

mongoose.connect(process.env.DATABASEURL, { useNewUrlParser: true });
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(flash());
app.use(expressSanitizer());

// PASSPORT CONFIGURATION
app.use(require("express-session")({
    secret: "Finn is the best and cutest dog in the word",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next){
   res.locals.currentUser = req.user;
   res.locals.error = req.flash("error");
   res.locals.success = req.flash("success");
   next();
});



// REST routes
app.get("/", function(req, res) {
   res.redirect("/blogs"); 
});

// REGISTRATION
app.get("/blogs/register", function(req, res) {
  res.render("users/register"); 
});

app.post("/blogs/register", upload.single('avatar'), function(req, res){
    cloudinary.uploader.upload(req.file.path, function(result) {
        req.body.avatar = result.secure_url;
        req.body.avatar_id = result.secure_url;
        User.register(new User(
        {
            username: req.body.username, 
            firstName: req.body.firstname,
            lastName: req.body.lastname,
            email: req.body.email,
            avatar: req.body.avatar,
            about: req.body.about
        }
        ), req.body.password, function(err, user){
            if(err){
                req.flash("error", err.message);
                return res.redirect("/blogs");
            }
            passport.authenticate("local")(req, res, function(){
                req.flash("success", "Welcome to  Truly Truthful Tech, " + req.body.firstname);
                res.redirect("/blogs");
            });
        });
    });
});

// user profile redirect
app.get("/users/:id", function(req, res){
    User.findById(req.params.id, function(err, foundUser) {
        if(err || !foundUser){
            req.flash("error", "Could not find the requested user");
            return res.redirect("/blogs");
        }
        Blog.find().where('author.id').equals(foundUser._id).exec(function(err, blogs){
            if(err){
                req.flash("error", "Could not find the requested user");
                return res.redirect("/blogs");
            }
            res.render("users/show", {user: foundUser, blogs: blogs});
        });
        
    });
});


// show login form
app.get("/blogs/login", function(req, res){
    res.render("users/login");
});

app.post("/blogs/login", function(req, res, next){
     passport.authenticate("local", 
    {
        successRedirect: "/blogs",
        failureRedirect: "/blogs/login",
        failureFlash: true,
        successFlash: "Welcome back, " + req.body.username + "!"
    })(req, res);
});

// log the user out
app.get("/blogs/logout", function(req, res) {
    req.logout();
    req.flash("success", "Logged out!");
    res.redirect("/blogs");
});

// render the main blog feed
app.get("/blogs", function(req, res){
    if(req.query.search){
       const regex = new RegExp(escapeRegex(req.query.search), 'gi');
       Blog.find({title: regex}, function(err, blogs){
       if(err){
           console.log(err);
       } else {
           if(blogs.length < 1){
               req.flash("error", "No blog posts matched your search");
               return res.redirect("/blogs");
           }
           res.render("index", {blogs: blogs, currentUser: req.user});
       }
    });
    } else {
    Blog.find({}, function(err, blogs){
       if(err){
           console.log(err);
       } else {
           res.render("index", {blogs: blogs, currentUser: req.user});
       }
    });
    }
});

// if user is logged in, allow them to make new post
app.get("/blogs/new", isLoggedIn,function(req, res) {
   res.render("blogs/new"); 
});

// user must be logged in in order to create new blog post
app.post("/blogs", isLoggedIn, upload.single('image'), function(req, res){
    cloudinary.uploader.upload(req.file.path, function(result){
       req.body.blog.image = result.secure_url;
       req.body.blog.author = {
           id: req.user._id,
           username: req.user.username
       }
       Blog.create(req.body.blog, function(err, blog){
           if(err){
               req.flash("error", err.message);
               return res.redirect("/blogs");
           }
           res.redirect("/blogs/" + blog.id);
       })
    });
});

// app.post("/editUserPicture", isLoggedIn, upload.single('image'), function(req, res){
//     cloudinary.uploader.upload(req.file.path, function(result){
//         req.user.avatar = result.secure_url;
//         console.log(req.user.avatar);
//     });
//     User.create(req.user, function(err, updatedUser) {
//         if(err){
//             req.flash("error", err.message);
//             return res.redirect("/blogs");
//         }
//         res.redirect("/users/" + updatedUser._id);
//     });
// });

// update profile image
app.post("/users/:id", isLoggedIn, upload.single('image'), function(req, res) {
   cloudinary.uploader.upload(req.file.path, function(result) {
      req.body.avatar = result.secure_url;
      var updatedUser = {
          avatar: req.body.avatar,
      }
      User.update({_id: req.params.id}, updatedUser, function(err, updatedUser){
          if(err){
              req.flash("error", "Cannot update profile picture");
              res.redirect("/blogs");
          } else {
              res.redirect("/users/" + req.params.id);
          }
      })
   });
});


app.get("/blogs/:id", function(req, res) {
   Blog.findById(req.params.id).populate("comments").exec(function(err, foundBlog){
       if(err || !foundBlog){
           req.flash("error", "Blog post not found");
           res.redirect("/blogs");
       } else {
           res.render("blogs/show", {blog: foundBlog});
       }
   });
});

app.get("/blogs/:id/edit", checkBlogOwnership, function(req, res) {
        Blog.findById(req.params.id, function(err, foundBlog){
            if(err){
                req.flash("error", "Blog post not found");
                res.redirect("/blogs");
            } else {
                res.render("blogs/edit", {blog: foundBlog});
            }
       });
});

app.put("/blogs/:id", checkBlogOwnership, function(req, res){
  req.body.blog.body = req.sanitize(req.body.blog.body);
   Blog.findByIdAndUpdate(req.params.id, req.body.blog, function(err, updatedBlog){
       if(err){
           res.redirect("/blogs");
       } else {
           res.redirect("/blogs/" + req.params.id);     
       }
   });
});

app.delete("/blogs/:id", checkBlogOwnership, function(req, res){
   Blog.findByIdAndRemove(req.params.id, function(err){
       if(err){
           res.redirect("/blogs");
       } else {
           res.redirect("/blogs");
       }
   })
});

app.get("/blogs/:id/comments/new", isLoggedIn, function(req, res){
    Blog.findById(req.params.id, function(err, blog){
        if(err){
            console.log(err);
        } else {
            res.render("comments/new", {blog: blog});
        }
    }); 
});

app.post("/blogs/:id/comments", isLoggedIn, function(req, res){
    Blog.findById(req.params.id, function(err, blog){
        if(err){
            console.log(err);
            res.redirect("/blogs");
        } else {
            Comment.create(req.body.comment, function(err, comment){
                if(err){
                    console.log(err);
                } else {
                    comment.author.id = req.user._id;
                    comment.author.username = req.user.username;
                    comment.author.avatar = req.user.avatar;
                    comment.save();
                    blog.comments.push(comment);
                    blog.save();
                    res.redirect("/blogs/" + blog._id);
                }
            });
        }
    });
});

// add likes to blog post then redirect back
app.get("/blogs/:id/like", isLoggedIn, function(req, res) {
   Blog.findById(req.params.id, function(err, foundBlog) {
      if(err){
          console.log(err);
          res.redirect("/blogs");
      } else {
          var u = req.user.username;
          if(foundBlog.likedby.indexOf(u) === -1){
              foundBlog.likes++;
              foundBlog.likedby.push(u);
              foundBlog.save();
              res.redirect("/blogs/" + foundBlog._id);
          } else {
           req.flash("success", "You have already liked this post");
           res.redirect("/blogs/" + foundBlog._id);
          }
      }
   }); 
});

// comment edit routes
app.get("/blogs/:id/comments/:comment_id/edit",checkCommentOwnership, function(req, res) {
    Blog.findById(req.params.id, function(err, foundBlog){
       if(err || !foundBlog){
           req.flash("error", "Blog post not found");
           return res.redirect("/blogs");
       } 
        Comment.findById(req.params.comment_id, function(err, foundComment){
            if(err){
                res.redirect("back");
            } else {
                res.render("comments/edit", {blog_id: req.params.id, comment: foundComment});
            }
        });
    });

});

app.put("/blogs/:id/comments/:comment_id", checkCommentOwnership, function(req, res){
   Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, function(err, updatedComment){
       if(err){
           res.redirect("back");
       } else {
           res.redirect("/blogs/" + req.params.id);
       }
   });
});

app.delete("/blogs/:id/comments/:comment_id", checkCommentOwnership, function(req, res){
    Comment.findByIdAndRemove(req.params.comment_id, function(err){
       if(err){
           res.redirect("back");
       } else {
           res.redirect("/blogs/" + req.params.id);
       }
    });
});

function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    req.flash("error", "Login required");
    res.redirect("/blogs/login");
}

function checkBlogOwnership(req, res, next){
    if(req.isAuthenticated()){
        Blog.findById(req.params.id, function(err, foundBlog){
          if(err || !foundBlog){
              req.flash("error", "Blog post not found");
              res.redirect("/blogs");
          } else {
              if(foundBlog.author.id.equals(req.user._id)){
                  next();
              } else {
                  req.flash("error", "You don't have permission to do that");
                  res.redirect("/blogs");
              }
          }
       });
    } else {
        req.flash("error", "Login required");
        res.redirect("back");
    }
}

function checkCommentOwnership(req, res, next){
    if(req.isAuthenticated()){
        Comment.findById(req.params.comment_id, function(err, foundComment){
          if(err || !foundComment){
              req.flash("error", "Comment not found");
              res.redirect("/blogs");
          } else {
              if(foundComment.author.id.equals(req.user._id)){
                  next();
              } else {
                  res.redirect("back");
              }
          }
       });
    } else {
        res.redirect("back");
    }
}

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

app.listen(process.env.PORT, process.env.IP, function(){
    console.log("server is running");
});