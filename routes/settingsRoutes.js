const express = require("express");
const router = express.Router();
const controller = require("../controllers/settingsController");

router.post("/", controller.createSetting);
router.get("/", controller.getSettings);
router.get("/:key_name", controller.getSettingByKey);
router.put("/:key_name", controller.updateSetting);
router.delete("/:key_name", controller.deleteSetting);

module.exports = router;
