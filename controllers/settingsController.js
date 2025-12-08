const db = require("../config/db");
const redis = require("../config/redis");

// CREATE a new setting
exports.createSetting = async (req, res) => {
  try {
    const { key_name, key_value, description } = req.body;

    await db.query(
      "INSERT INTO settings (key_name, key_value, description) VALUES (?, ?, ?)",
      [key_name, key_value, description]
    );

    await redis.del("settings:all");
    res.status(201).json({ message: "Setting added successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ all settings (cached)
exports.getSettings = async (req, res) => {
  try {
    const cached = await redis.get("settings:all");
    if (cached) return res.json(JSON.parse(cached));

    const [rows] = await db.query("SELECT * FROM settings ORDER BY updated_at DESC");
    await redis.setEx("settings:all", 1800, JSON.stringify(rows)); // cache for 30 mins
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ one setting by key name
exports.getSettingByKey = async (req, res) => {
  try {
    const { key_name } = req.params;
    const key = `setting:${key_name}`;

    const cached = await redis.get(key);
    if (cached) return res.json(JSON.parse(cached));

    const [rows] = await db.query("SELECT * FROM settings WHERE key_name=?", [key_name]);
    if (rows.length === 0) return res.status(404).json({ message: "Setting not found" });

    await redis.setEx(key, 1800, JSON.stringify(rows[0]));
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE a setting
exports.updateSetting = async (req, res) => {
  try {
    const { key_name } = req.params;
    const { key_value, description } = req.body;

    await db.query(
      "UPDATE settings SET key_value=?, description=? WHERE key_name=?",
      [key_value, description, key_name]
    );

    await redis.del("settings:all");
    await redis.del(`setting:${key_name}`);
    res.json({ message: "Setting updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE a setting
exports.deleteSetting = async (req, res) => {
  try {
    const { key_name } = req.params;
    await db.query("DELETE FROM settings WHERE key_name=?", [key_name]);

    await redis.del("settings:all");
    await redis.del(`setting:${key_name}`);
    res.json({ message: "Setting deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
