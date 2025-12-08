const express = require("express");
const router = express.Router();
const businessController = require("../controllers/businessController");

// Helper to catch async errors
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);


// CHECK BY REG NO
router.get("/check/uid", asyncHandler(businessController.checkBusinessByUID));

// CHECK BY REG NO
router.get("/check/reg", asyncHandler(businessController.checkBusinessByRegNo));

// CREATE BUSINESS
router.post("/register", asyncHandler(businessController.createBusiness));

// GET ALL
router.get("/getAll", asyncHandler(businessController.getAllBusinesses));

// GET BY ID
router.get("/get-id/:id", asyncHandler(businessController.getBusinessById));

// UPDATE
router.put("/update/:id", asyncHandler(businessController.updateBusiness));

// DELETE
router.delete("/delete/:id", asyncHandler(businessController.deleteBusiness));

module.exports = router;
