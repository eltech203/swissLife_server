const express = require("express");
const request = require("request");
const bodyParser = require("body-parser");
const router = express.Router();
const cors = require("cors");
const db = require("../config/db");

///-----Port-----///
const _urlencoded = express.urlencoded({ extended: false });
router.use(cors());
router.use(express.json());
router.use(express.static("public"));

// Middleware
router.use(cors());
router.use(express.json());
router.use(express.urlencoded({ extended: false }));

// ---- ALLOW ACCESS ----- //
router.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "PUT, POST, PATCH, DELETE, GET");
    return res.status(200).json({});
  }
  next();
});

// ---------------------------------------------
// 🔑 Safaricom Sandbox Credentials (Testing)
// ---------------------------------------------
const consumer_key = process.env.CONSUMER_KEY ;
const consumer_secret = process.env.SECRET_KEY ;
const shortCode = "174379"; // Sandbox
const passKey = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

// ---------------------------------------------
// 🧠 Helper: Get Access Token
// ---------------------------------------------
const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString("base64");

function access(req, res, next) {
  request(
    {
      url: "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      headers: { Authorization: "Basic " + auth },
    },
    (error, response, body) => {
      if (error) {
        console.error("❌ Error getting token:", error);
        return res.status(500).json({ error: "Failed to get access token" });
      }
      req.access_token = JSON.parse(body).access_token;
      next();
    }
  );
}



router.get("/",(req, res) => {

  res.send("M-Pesa STK Push API is running.");
});

// Temporary metadata store (Redis recommended)
const paymentMetaStore = {};

// ---------------------------------------------
// 📲 STK PUSH - Customer Payment
// ---------------------------------------------


  


let phoneNumber, amount, user_id, order_id, transaction_type;

router.post("/stkpush", access, express.urlencoded({ extended: false }), function (req, res) {
  phoneNumber = req.body.phone;
  amount = req.body.amount;
  user_id = req.body.user_id;
  amount = req.body.amount;
  order_id = req.body.order_id;
console.log("Token",req.access_token)




  let endpoint = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
  let auth = "Bearer " + req.access_token;

  let shortCode = `174379`; // Sandbox Paybill
  let passKey = `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919`;

  const timeStamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, -3);
  const password = Buffer.from(`${shortCode}${passKey}${timeStamp}`).toString("base64");

  request(
    {
      url: endpoint,
      method: "POST",
      headers: { Authorization: auth },
      json: {
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timeStamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: shortCode,
        PhoneNumber: phoneNumber,
        CallBackURL: "https://balanced-ambition-production.up.railway.app/payment/callback",
        AccountReference: `Payment for Order ${order_id}`,
        TransactionDesc: transaction_type === "vote" ? "Voting" : "Payment",
      },
    },
    (error, response, body) => {
      if (error) {
        console.log(error);
        return res.status(404).json(error);
      }

      // ✅ Store meta data for callback
      if (body.CheckoutRequestID) {
        paymentMetaStore[body.CheckoutRequestID] = {
          user_id,
          order_id,
        };
      }

      console.log("📲 STK push response:", body);
     return res.status(200).json(body);
    }
  );
});

// ---------------------------------------------
// 📥 M-Pesa Callback
// ---------------------------------------------
router.post("/callback", async (req, res) => {
  console.log("📩 M-Pesa Callback:", JSON.stringify(req.body, null, 2));

  // Safely respond to Safaricom immediately
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });

  try {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) {
      console.error("❌ No stkCallback found.");
      return;
    }

    const resultCode = callback.ResultCode;
    const checkoutId = callback.CheckoutRequestID;

    // Retrieve stored metadata (order_id, user_id, etc.)
    const metaJSON = await redisClient.get(`mpesa:${checkoutId}`);
    const meta = metaJSON ? JSON.parse(metaJSON) : null;

    if (!meta || !meta.order_id) {
      console.error("❌ No metadata found for:", checkoutId);
      return;
    }

    console.log("📦 Order metadata:", meta);

    // If payment FAILED
    if (resultCode !== 0) {
      console.warn("⚠️ Payment failed:", callback.ResultDesc);

      await db.query(
        `UPDATE payments SET status='failed' WHERE order_id = ?`,
        [meta.order_id]
      );

      return;
    }

    // Parse M-Pesa payment metadata
    const items = callback.CallbackMetadata?.Item || [];

    const amount = items.find(i => i.Name === "Amount")?.Value || 0;
    const transID = items.find(i => i.Name === "MpesaReceiptNumber")?.Value || null;
    const phone = items.find(i => i.Name === "PhoneNumber")?.Value || null;

    // Save payment in DB
    await db.query(
      `INSERT INTO payments 
        (order_id, transaction_id, method, amount, currency, status, receipt_no, payment_date, raw_response)
       VALUES (?, ?, 'mpesa', ?, 'KES', 'success', ?, NOW(), ?)`,
      [
        meta.order_id,
        transID,
        amount,
        transID,
        JSON.stringify(req.body) // raw callback saved
      ]
    );

    // Mark the order as paid
    await db.query(
      `UPDATE orders SET payment_status='paid' WHERE id=?`,
      [meta.order_id]
    );

    console.log(`✅ Payment saved & Order #${meta.order_id} marked as PAID`);

    // Remove meta key from Redis
    await redisClient.del(`mpesa:${checkoutId}`);

  } catch (error) {
    console.error("❌ M-Pesa Callback Error:", error);
  }
});

// ---------------------------------------------
// 📊 Query STK Push Status
// ---------------------------------------------
router.post("/stkpush/query", access, (req, res) => {
  const { checkoutRequestId } = req.body;
  if (!checkoutRequestId)
    return res.status(400).json({ message: "Missing CheckoutRequestId" });

  const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, -3);
  const password = Buffer.from(`${shortCode}${passKey}${timestamp}`).toString("base64");

  request(
    {
      url: "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query",
      method: "POST",
      headers: { Authorization: "Bearer " + req.access_token },
      json: {
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      },
    },
    (error, response, body) => {
      if (error) {
        console.error("❌ Query error:", error);
        return res.status(500).json({ error: "Failed to query transaction" });
      }

      console.log("📊 Query Response:", body);
      res.status(200).json(body);
    }
  );
});

module.exports = router;
