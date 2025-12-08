const express = require("express");
const router = express.Router();

const {
  addToB2BCart,
  bulkAddToB2BCart,
  getB2BCart,
  removeFromB2BCart,
  clearB2BCart
} = require("../controllers/b2bCartController");

// ------------------------------------
// B2B Cart Routes
// ------------------------------------

// Add or update ONE item
router.post("/add", addToB2BCart);

// Add MULTIPLE items (Save All)
router.post("/add-bulk", bulkAddToB2BCart);

// Get cart for a user (uid)
router.get("/get-id/:uid", getB2BCart);

// Remove a single item
router.post("/remove", removeFromB2BCart);

// Clear entire cart
router.post("/clear", clearB2BCart);

module.exports = router;
