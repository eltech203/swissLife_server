const express = require("express");
const router = express.Router();
const {addToCart,getCart,removeFromCart,clearCart,getCartTotal} = require("../controllers/cartController");

// Add item to cart
router.post("/add", addToCart);

// Get cart items
router.get("/getCart/:uid", getCart);

// Remove specific item
router.post("/remove", removeFromCart);

// Clear all items
router.post("/clear", clearCart);

router.get("/total/:uid", getCartTotal);


module.exports = router;
