var 	Campground = require("../models/campground"),
		Comment = require("../models/comment"),
		middlewareObj = {};

middlewareObj.checkCampgroundOwnership = function(req, res, next) {
	if(req.isAuthenticated()){
		Campground.findOne({slug: req.params.slug}, function(err,foundCampground){
			if(err || !foundCampground){
				req.flash("error", "Campground not found");
				res.render("back");
			} else {
			 if(foundCampground.author.id.equals(req.user._id) || req.user.isAdmin) {
				 next();
			 } else {
				 req.flash("error", "You dont have permission");
				 res.redirect("back");
			 }	
			}
		});
	} else {
		req.flash("error", "You must login");
		res.redirect("back");
	}
};

middlewareObj.checkCommentOwnership = function(req, res, next) {
	if(req.isAuthenticated()){
		Comment.findById(req.params.comment_id, function(err,foundComment){
			if(err || !foundComment){
				req.flash("error", "Comment not found");
				res.render("back");
			} else {
			 if(foundComment.author.id.equals(req.user._id) || req.user.isAdmin) {
				 next();
			 } else {
				 req.flash("error", "You dont have permission");
				 res.redirect("back");
			 }	
			}
		});
	} else {
		req.flash("error", "Login first");
		res.redirect("back");
	}
};

middlewareObj.isLoggedIn = function(req, res, next){
	if(req.isAuthenticated()){
		return next();
	}
	if(req["headers"]["content-type"] === "application/json"){
		return res.send({error: "Login requiered"});
	}
	req.flash("error", "You must be logged in");
	res.redirect("/login");
};

middlewareObj.isPaid = function(req, res, next){
	if(req.user.isPaid) return next();
	req.flash("error", "Please pay registration fee");
	res.redirect("/checkout");
};

module.exports = middlewareObj;