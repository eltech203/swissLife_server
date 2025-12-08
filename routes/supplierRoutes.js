const express = require("express");
const router = express.Router();
const controller = require("../controllers/supplierController");

router.post("/upload", controller.createSupplier);
router.get("/", controller.getSuppliers);
router.get("/:id", controller.getSupplierById);
router.put("/:id", controller.updateSupplier);
router.delete("/:id", controller.deleteSupplier);

module.exports = router;
