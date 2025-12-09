const express = require("express");
const router = express.Router();

const {
  placeOrder,
  getUserOrders,
  getOrderByOrderId
} = require("../controllers/orderController");

// ✅ Place a new order
router.post("/place", placeOrder);

// ✅ Get all orders for a specific user
router.get("/user/:uid", getUserOrders);

// ✅ Get a specific order by order ID
router.get("/:order_id", getOrderByOrderId);

module.exports = router;