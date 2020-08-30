require('dotenv').config();

var express 		 = require("express"),
	app         	 = express(),
	bodyParser  	 = require("body-parser"),
	mongoose    	 = require("mongoose"),
	flash 			 = require("connect-flash"),
	passport		 = require("passport"),
	LocalStrategy	 = require("passport-local"),
	methodOverride 	 = require("method-override"),
	Campground 		 = require("./models/campground"),
	Comment 		 = require("./models/comment"),
	User 			 = require("./models/user"),
	seedDB			 = require("./seeds");

//ROUTES REQUIERING
var indexRoutes 	 = require("./routes/index"),
	commentRoutes 	 = require("./routes/comments"),
	campgroundRoutes = require("./routes/campgrounds");


mongoose.connect("mongodb://localhost:27017/yelp_camp", {useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, useCreateIndex: true});
app.use(express.json());
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(flash());
// seedDB(); SEED THE DATABASE
app.locals.moment = require('moment');

//PASSPORT CONFIG
app.use(require("express-session")({
		secret: "Once again",
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

app.use("/", indexRoutes);
app.use("/campgrounds", campgroundRoutes);
app.use("/campgrounds/:slug/comments", commentRoutes);

//PORT
app.listen(3000, function(){
	console.log("The Yelp Camp has started");
});