const express = require("express");
const router = express.Router();
const controller = require("../controllers/userController");

router.post("/", controller.addUser);
router.get("/getAll", controller.getUsers);
router.put("/update/:id", controller.updateUser);
router.delete("/delete/:id", controller.deleteUser);

module.exports = router;
