const express = require("express");
const router = express.Router();
const {addProduct,getProducts,updateProduct,deleteProduct,searchProducts,getProductsByTag} = require("../controllers/productController");

router.post("/upload", addProduct);
router.get("/getAll", getProducts);
router.put("/update/:id", updateProduct);
router.delete("/delete/:id", deleteProduct);
router.get('/search', searchProducts);// search all estate
router.get("/products/tag/:tag", getProductsByTag);



module.exports = router;
