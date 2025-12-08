const express = require("express");
const router = express.Router();
const controller = require("../controllers/fulfillmentController");

router.post("/", controller.createFulfillment);
router.get("/", controller.getFulfillments);
router.get("/:id", controller.getFulfillmentById);
router.put("/:id", controller.updateFulfillment);
router.delete("/:id", controller.deleteFulfillment);

module.exports = router;
