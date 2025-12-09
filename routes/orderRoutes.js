const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

// Place order
router.post("/place", orderController.placeOrder);

// Get orders for a specific user by UID
router.get("/get/:uid", orderController.getUserOrders);

// Get single order by order_id
router.get("/order/:order_id", orderController.getOrderByOrderId);

// Admin: get all orders
router.get("/", orderController.getAllOrders);

// Update order status
router.put("/status", orderController.updateOrderStatus);

// Cancel order
router.put("/cancel", orderController.cancelOrder);

module.exports = router;
