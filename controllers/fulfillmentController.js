const db = require("../config/db");
const redis = require("../config/redis");

// CREATE fulfillment record
exports.createFulfillment = async (req, res) => {
  try {
    const { order_id, provider, tracking_code, status, response } = req.body;

    await db.query(
      `INSERT INTO fulfillment (order_id, provider, tracking_code, status, response)
       VALUES (?, ?, ?, ?, ?)`,
      [order_id, provider, tracking_code, status, JSON.stringify(response)]
    );

    await redis.del("fulfillment:recent");
    res.status(201).json({ message: "Fulfillment record created successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ all fulfillment records (cached)
exports.getFulfillments = async (req, res) => {
  try {
    const cached = await redis.get("fulfillment:recent");
    if (cached) return res.json(JSON.parse(cached));

    const [rows] = await db.query("SELECT * FROM fulfillment ORDER BY created_at DESC LIMIT 50");
    await redis.setEx("fulfillment:recent", 900, JSON.stringify(rows)); // cache for 15 mins
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ single fulfillment by ID
exports.getFulfillmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const key = `fulfillment:${id}`;

    const cached = await redis.get(key);
    if (cached) return res.json(JSON.parse(cached));

    const [rows] = await db.query("SELECT * FROM fulfillment WHERE id=?", [id]);
    if (rows.length === 0) return res.status(404).json({ message: "Fulfillment not found" });

    await redis.setEx(key, 1800, JSON.stringify(rows[0]));
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE fulfillment status (e.g., "in_transit", "delivered")
exports.updateFulfillment = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, tracking_code, response } = req.body;

    await db.query(
      "UPDATE fulfillment SET status=?, tracking_code=?, response=? WHERE id=?",
      [status, tracking_code, JSON.stringify(response), id]
    );

    await redis.del("fulfillment:recent");
    await redis.del(`fulfillment:${id}`);
    res.json({ message: "Fulfillment updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE fulfillment record
exports.deleteFulfillment = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM fulfillment WHERE id=?", [id]);

    await redis.del("fulfillment:recent");
    await redis.del(`fulfillment:${id}`);
    res.json({ message: "Fulfillment deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
