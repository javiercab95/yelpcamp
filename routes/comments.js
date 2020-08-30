var express = require("express"),
	router	= express.Router({mergeParams: true}),
	Campground = require("../models/campground"),
	Comment = require("../models/comment");
	let { checkCommentOwnership, isLoggedIn, isPaid } = require("../middleware");
	router.use(isLoggedIn, isPaid);

//COMMENTS NEW
router.get("/new", function(req, res){
	Campground.findOne({slug: req.params.slug}, function(err, campground){
		if(err){
			console.log(err);
		} else {
			res.render("comments/new", {campground: campground});
		}
	});
});

//COMMENTS CREATE
router.post("/", function(req, res){
	Campground.findOne({slug: req.params.slug}, function(err, campground){
		if(err){
			console.log(err);
			res.redirect("/campgrounds");
		} else {
			Comment.create(req.body.comment, function(err, comment){
				if(err){
					req.flash("error", "Something went wrong");
					console.log(err);
				} else {
					comment.author.id = req.user._id;
					comment.author.username = req.user.username;
					comment.save();
					campground.comments.push(comment);
					campground.save();
					req.flash("success", "Comment Added");
					res.redirect('/campgrounds/' + campground.slug);
				}
			})
		}
	});
});

//EDIT
router.get("/:comment_id/edit", checkCommentOwnership, function(req, res){
	Campground.findOne({slug: req.params.slug}, function(err, foundCampground){
		if(err || !foundCampground) {
			req.flash("error", "No campground found");
			return res.redirect("back");
		}
		Comment.findById(req.params.comment_id, function(err, foundComment){
			if(err){
				res.redirect("back");
			} else {
				res.render("comments/edit", {campground_slug: req.params.slug, comment: foundComment});
			}
		});
	});
});

//UPDATE
router.put("/:comment_id", checkCommentOwnership, function(req, res){
   Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, function(err, updatedComment){
      if(err){
          res.redirect("back");
      } else {
          res.redirect("/campgrounds/" + req.params.slug );
      }
   });
});

//DELETE
router.delete("/:comment_id", checkCommentOwnership, function(req, res){
	Comment.findByIdAndRemove(req.params.comment_id, function(err){
		if(err){
			res.redirect("back");
		} else {
			req.flash("success", "Comment deleted");
			res.redirect("/campgrounds/" + req.params.slug);
		}
	});
});




module.exports = router;