var express = require("express"),
	router	= express.Router(),
	Campground = require("../models/campground");
	let { checkCampgroundOwnership, isLoggedIn, isPaid } = require("../middleware");
	router.use(isLoggedIn, isPaid);

var NodeGeocoder = require('node-geocoder');
 
var options = {
  provider: 'google',
  httpAdapter: 'https',
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
};
 
var geocoder = NodeGeocoder(options);

var multer = require('multer');
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function (req, file, cb) {
    
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter})

var cloudinary = require('cloudinary');
cloudinary.config({ 
  cloud_name: 'cloudsproyect', 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

//INDEX
router.get("/", function(req, res){
	var perPage = 8;
    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
	if (req.query.paid) res.locals.success = "Payment succeded, welcome to YelpCamp!";
	var noMatch = null;
	if(req.query.search) {
		const regex = new RegExp(escapeRegex(req.query.search), 'gi');
		Campground.find({name: regex}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allCampgrounds) {
            Campground.count({name: regex}).exec(function (err, count) {
			if(err){
				console.log(err);
				res.redirect("back");
			} else {
				if(allCampgrounds.length < 1) {
					noMatch = "No campgrounds match that query, please try again";
				}
				res.render("campgrounds/index", {
					campgrounds: allCampgrounds,
                    current: pageNumber,
                    pages: Math.ceil(count / perPage),
                    noMatch: noMatch,
                    search: req.query.search
				});
			}
		});
	});
	} else {
		Campground.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allCampgrounds) {
            Campground.count().exec(function (err, count) {
                if (err) {
                    console.log(err);
                } else {
                    res.render("campgrounds/index", {
                        campgrounds: allCampgrounds,
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        noMatch: noMatch,
                        search: false
                    });
                }
            });
        });
    }
});

//CREATE - add new campground to DB
router.post("/", upload.single('image'), function(req, res) {
    cloudinary.v2.uploader.upload(req.file.path, function(err, result) {
      if(err) {
        req.flash('error', err.message);
        return res.redirect('back');
      }
      geocoder.geocode(req.body.location, function (err, data) {
        if (err || !data.length) {
          req.flash('error', 'Invalid address');
          return res.redirect('back');
        }
            req.body.campground.lat = data[0].latitude;
            req.body.campground.lng = data[0].longitude;
            req.body.campground.location = data[0].formattedAddress;
        
            // add cloudinary url for the image to the campground object under image property
          req.body.campground.image = result.secure_url;
		  req.body.campground.imageId = result.public_id;
          // add author to campground
          req.body.campground.author = {
            id: req.user._id,
            username: req.user.username
          }
          Campground.create(req.body.campground, function(err, campground) {
            if (err) {
              req.flash('error', err.message);
              return res.redirect('back');
            }
            res.redirect('/campgrounds/' + campground.slug);
          });
      });
      
    });
});

//NEW
router.get("/new", function(req, res){
	res.render("campgrounds/new");
});

//SHOW
router.get("/:slug", function(req, res){
	Campground.findOne({slug: req.params.slug}).populate("comments").exec(function(err, foundCampground){
		if(err || !foundCampground){
			req.flash("error", "Campground not found");
			res.redirect("back");
		} else {
			console.log(foundCampground);
			res.render("campgrounds/show", {campground: foundCampground});
		}
	});
});

//EDIT
router.get("/:slug/edit", checkCampgroundOwnership, function(req, res){
	Campground.findOne({slug: req.params.slug}, function(err, foundCampground){
		res.render("campgrounds/edit", {campground: foundCampground});	
	});
});

//UPDATE
router.put("/:slug", checkCampgroundOwnership, upload.single("image"), function(req, res){
    Campground.findOne({slug: req.params.slug}, async function(err, campground){
        if(err){
            req.flash("error", err.message);
            res.redirect("back");
        } else{
            if(req.file){
                try{
                    await cloudinary.v2.uploader.destroy(campground.imageId);
                    var result = await cloudinary.v2.uploader.upload(req.file.path);
                    campground.image = result.secure_url;
                    campground.imageId = result.public_id;
                } catch(err){
                    req.flash("error", err.message);
                    return res.redirect("back");
                }
            }
            if(req.body.location !== campground.location){
                try{
                    var updatedLocation = await geocoder.geocode(req.body.location);
                    campground.lat = updatedLocation[0].latitude;
                    campground.lng = updatedLocation[0].longitude;
                    campground.location = updatedLocation[0].formattedAddress;
                } catch(err){
                    req.flash("error", err.message);
                    return res.redirect("back");
                }
            }
            campground.name = req.body.campground.name;
            campground.price = req.body.campground.price;
            campground.description = req.body.campground.description;
            campground.save();
            req.flash("success", "Successfully Updated!");
            res.redirect("/campgrounds/" + campground.slug);
        }
    });
});

// Delete/destroy Campground
router.delete("/:slug", checkCampgroundOwnership, async(req, res) => {
  try {
    let foundCampground = await Campground.findOneAndRemove({slug: req.params.slug});
    await foundCampground.deleteOne();
    res.redirect("/campgrounds");
  } catch (error) {
    console.log(error.message);
    res.redirect("/campgrounds");
  }
});


function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

module.exports = router;