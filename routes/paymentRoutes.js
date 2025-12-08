const express = require("express");
const router = express.Router();
const controller = require("../controllers/paymentController");

router.post("/", controller.createPayment);
router.get("/", controller.getPayments);
router.get("/:id", controller.getPaymentById);
router.put("/:id", controller.updatePayment);
router.delete("/:id", controller.deletePayment);

module.exports = router;
