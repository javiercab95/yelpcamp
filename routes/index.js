var express = require("express"),
	router	= express.Router(),
	passport = require("passport"),
	User = require("../models/user"),
	Campground = require("../models/campground"),
	middleware = require("../middleware");
var async = require("async");
var	nodemailer = require("nodemailer");
var crypto = require("crypto");

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

//ROOT ROUTE
router.get("/", function(req, res){
	res.render("landing");
});

//AUTH ROUTE
router.get("/register", function(req, res){
	res.render("register", {page: "register"});
});

//AUTH LOGIC ROUTE
router.post("/register", function(req, res){
    var newUser = new User({
			username: req.body.username,
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			email: req.body.email,
			avatar: req.body.avatar
		});
	var adminKey = process.env.ADMIN_KEY;
	if(req.body.adminCode == adminKey) {
		newUser.isAdmin = true;
	}
	
    User.register(newUser, req.body.password, function(err, user){
        if(err){
            req.flash("error", err.message);
            return res.redirect("/register");
        }
        passport.authenticate("local")(req, res, function(){
           req.flash("success", "Successfully Signed Up! Nice to meet you " + req.body.username);
           res.redirect("/checkout"); 
        });
    });
});

//LOGIN ROUTE
router.get("/login", function(req, res){
	res.render("login", {page: "login"});
});

//LOGIN LOGIC ROUTE
router.post("/login", passport.authenticate("local", 
	{
	successRedirect: "/campgrounds", 
	failureRedirect: "/login"
	}), function(req, res){
});

//LOGOUT ROUTE
router.get("/logout", function(req, res){
	req.logout();
	req.flash("success", "Logged you out");
	res.redirect("/campgrounds");
})

//FORGOT PASSWORD
router.get('/forgot', function(req, res) {
  res.render('forgot');
});

router.post('/forgot', function(req, res, next) {
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email }, function(err, user) {
        if (!user) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: 'proyechelptinfo@gmail.com',
          pass: process.env.GMAILPW
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'proyechelptinfo@gmail.com',
        subject: 'Node.js Password Reset',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        console.log('mail sent');
        req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
        done(err, 'done');
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('/forgot');
  });
});

router.get('/reset/:token', function(req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
    res.render('reset', {token: req.params.token});
  });
});

router.post('/reset/:token', function(req, res) {
  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }
        if(req.body.password === req.body.confirm) {
          user.setPassword(req.body.password, function(err) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            user.save(function(err) {
              req.logIn(user, function(err) {
                done(err, user);
              });
            });
          })
        } else {
            req.flash("error", "Passwords do not match.");
            return res.redirect('back');
        }
      });
    },
    function(user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: 'proyechelptinfo@gmail.com',
          pass: process.env.GMAILPW
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'proyechelptinfo@gmail.com',
        subject: 'Your password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash('success', 'Success! Your password has been changed.');
        done(err);
      });
    }
  ], function(err) {
    res.redirect('/campgrounds');
  });
});

// USER PROFILE
router.get("/users/:id", function(req, res) {
  User.findById(req.params.id, function(err, foundUser) {
    if(err) {
      req.flash("error", "Something went wrong.");
      return res.redirect("/");
    }
    Campground.find().where('author.id').equals(foundUser._id).exec(function(err, campgrounds) {
      if(err) {
        req.flash("error", "Something went wrong.");
        return res.redirect("/");
      }
      res.render("users/show", {user: foundUser, campgrounds: campgrounds});
    })
  });
});

//CHECKOUT
router.get('/checkout',middleware.isLoggedIn, async (req, res) => {
	if (req.user.isPaid){
		req.flash("success", "Your account is already paid");
		return res.redirect("/campgrounds");
	}
	res.render('checkout', { amount: 20 });
});

//CHECKOUT PAY
router.post("/pay", middleware.isLoggedIn, async (req, res) => {
  const { paymentMethodId, items, currency } = req.body;

  const amount = 2000;

  try {
    
    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method: paymentMethodId,
      error_on_requires_action: true,
      confirm: true
    });

    console.log("💰 Payment received!");
	  
	req.user.isPaid = true; 
	await req.user.save();
    
    res.send({ clientSecret: intent.client_secret });
  } catch (e) {
    
    if (e.code === "authentication_required") {
      res.send({
        error:
          "This card requires authentication in order to proceeded. Please use a different card."
      });
    } else {
      res.send({ error: e.message });
    }
  }
});

module.exports = router;