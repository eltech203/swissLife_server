const db = require("../config/db");
const redis = require("../config/redis");

// CREATE log (called automatically after an event)
exports.createLog = async (req, res) => {
  try {
    const { user_id, action, description } = req.body;

    await db.query(
      "INSERT INTO audit_logs (user_id, action, description) VALUES (?, ?, ?)",
      [user_id, action, description]
    );

    await redis.del("audit:recent");
    res.status(201).json({ message: "Audit log created successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ all logs (cached)
exports.getLogs = async (req, res) => {
  try {
    const cached = await redis.get("audit:recent");
    if (cached) return res.json(JSON.parse(cached));

    const [rows] = await db.query(`
      SELECT a.*, u.name AS user_name, u.email
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `);

    await redis.setEx("audit:recent", 900, JSON.stringify(rows)); // cache for 15 minutes
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ one log
exports.getLogById = async (req, res) => {
  try {
    const { id } = req.params;
    const key = `audit:${id}`;

    const cached = await redis.get(key);
    if (cached) return res.json(JSON.parse(cached));

    const [rows] = await db.query(`
      SELECT a.*, u.name AS user_name, u.email
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id=?
    `, [id]);

    if (rows.length === 0) return res.status(404).json({ message: "Log not found" });

    await redis.setEx(key, 900, JSON.stringify(rows[0]));
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE log (admin use only)
exports.deleteLog = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM audit_logs WHERE id=?", [id]);

    await redis.del("audit:recent");
    await redis.del(`audit:${id}`);
    res.json({ message: "Audit log deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
