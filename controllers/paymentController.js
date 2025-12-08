const db = require("../config/db");
const redis = require("../config/redis");

// CREATE payment
exports.createPayment = async (req, res) => {
  try {
    const { order_id, transaction_id, method, amount, currency, status, receipt_no, raw_response } = req.body;

    await db.query(
      `INSERT INTO payments (order_id, transaction_id, method, amount, currency, status, receipt_no, raw_response)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [order_id, transaction_id, method, amount, currency, status, receipt_no, JSON.stringify(raw_response)]
    );

    await redis.del("payments:recent"); // Invalidate cached recent payments
    res.status(201).json({ message: "Payment recorded successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ all payments (cached)
exports.getPayments = async (req, res) => {
  try {
    const cached = await redis.get("payments:recent");
    if (cached) return res.json(JSON.parse(cached));

    const [rows] = await db.query("SELECT * FROM payments ORDER BY payment_date DESC LIMIT 50");
    await redis.setEx("payments:recent", 600, JSON.stringify(rows)); // cache for 10 minutes
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ single payment
exports.getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const key = `payment:${id}`;

    const cached = await redis.get(key);
    if (cached) return res.json(JSON.parse(cached));

    const [rows] = await db.query("SELECT * FROM payments WHERE id=?", [id]);
    if (rows.length === 0) return res.status(404).json({ message: "Payment not found" });

    await redis.setEx(key, 1800, JSON.stringify(rows[0])); // cache for 30 mins
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE payment status (e.g., after webhook confirmation)
exports.updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, receipt_no } = req.body;

    await db.query("UPDATE payments SET status=?, receipt_no=? WHERE id=?", [status, receipt_no, id]);

    await redis.del("payments:recent");
    await redis.del(`payment:${id}`);
    res.json({ message: "Payment updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE payment (admin use only)
exports.deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM payments WHERE id=?", [id]);

    await redis.del("payments:recent");
    await redis.del(`payment:${id}`);
    res.json({ message: "Payment deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
