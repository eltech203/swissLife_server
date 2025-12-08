const db = require("../config/db");
const redis = require("../config/redis");
const bcrypt = require("bcrypt");

// CREATE user
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)",
      [name, email, hashed, phone, role || "customer"]
    );
    await redis.del("users:all"); // Invalidate cache
    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ all users
exports.getUsers = async (req, res) => {
  try {
    const cached = await redis.get("users:all");
    if (cached) return res.json(JSON.parse(cached));

    const [rows] = await db.query("SELECT id, name, email, role, status FROM users");
    await redis.setEx("users:all", 3600, JSON.stringify(rows));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, status } = req.body;
    await db.query(
      "UPDATE users SET name=?, phone=?, status=? WHERE id=?",
      [name, phone, status, id]
    );
    await redis.del("users:all");
    res.json({ message: "User updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE user
exports.deleteUser = async (req, res) => {
  try {
    await db.query("DELETE FROM users WHERE id=?", [req.params.id]);
    await redis.del("users:all");
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
