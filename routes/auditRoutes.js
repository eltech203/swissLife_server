const express = require("express");
const router = express.Router();
const controller = require("../controllers/auditController");

router.post("/", controller.createLog);
router.get("/", controller.getLogs);
router.get("/:id", controller.getLogById);
router.delete("/:id", controller.deleteLog);

module.exports = router;
