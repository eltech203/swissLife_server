const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  console.log("Incoming:", req.method, req.url);
  next();
});
// Import routes
// const paymentRoutes = require("./routes/paymentRoutes");
// app.use("/api/payments", paymentRoutes);
app.use("/api/suppliers", require("./routes/supplierRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/fulfillment", require("./routes/fulfillmentRoutes"));
app.use("/api/settings", require("./routes/settingsRoutes"));
app.use("/api/audit", require("./routes/auditRoutes"));
app.use("/api/mpesa", require("./payment/mpesa_stk_push"));
// app.use("/card", require("./payment/stripe"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api/business", require("./routes/businessRoutes"));
app.use("/api/b2b/cart", require("./routes/b2bCartRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));


const stripePayment = require('./payment/stripe');
app.use("/api/card", stripePayment);



// Base route
app.get("/", (req, res) => res.send("SwissLife Backend API Running 🚀"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
