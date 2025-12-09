const express = require("express");
const router = express.Router();
const {placeOrder,getUserOrders,getAllOrders,updateOrderStatus,cancelOrder,getOrderByOrderId} = require("../controllers/orderController");

// Place order
router.post("/place", placeOrder);

// Get user's orders
router.get("/get/:uid", getUserOrders);

// Get user's orders
router.get("/:order_id", getOrderByOrderId);

// Admin: get all orders
router.get("/", getAllOrders);

// Update order status
router.put("/status", updateOrderStatus);

// Cancel order
router.put("/cancel", cancelOrder);

module.exports = router;
