const db = require("../config/db");
const redis = require("../config/redis");

// CREATE supplier
exports.createSupplier = async (req, res) => {
  try {
    const { company_name, contact_person, email, phone, country, address } = req.body;

    await db.query(
      "INSERT INTO suppliers ( company_name, contact_person, email, phone, country, address) VALUES ( ?, ?, ?, ?, ?, ?)",
      [ company_name, contact_person, email, phone, country, address]
    );

    await redis.del("suppliers:all");
    res.status(201).json({ message: "Supplier created successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ all suppliers (with Redis cache)
exports.getSuppliers = async (req, res) => {
  try {
    const cached = await redis.get("suppliers:all");
    if (cached) return res.json(JSON.parse(cached));

    const [rows] = await db.query("SELECT * FROM suppliers ORDER BY created_at DESC");
    await redis.setEx("suppliers:all", 3600, JSON.stringify(rows)); // cache 1 hour
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ single supplier
exports.getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;
    const key = `supplier:${id}`;

    const cached = await redis.get(key);
    if (cached) return res.json(JSON.parse(cached));

    const [rows] = await db.query("SELECT * FROM suppliers WHERE id=?", [id]);
    if (rows.length === 0) return res.status(404).json({ message: "Supplier not found" });

    await redis.setEx(key, 3600, JSON.stringify(rows[0]));
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE supplier
exports.updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, contact_person, phone, address, country } = req.body;

    await db.query(
      "UPDATE suppliers SET company_name=?, contact_person=?, phone=?, address=?, country=? WHERE id=?",
      [company_name, contact_person, phone, address, country, id]
    );

    await redis.del("suppliers:all");
    await redis.del(`supplier:${id}`);
    res.json({ message: "Supplier updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE supplier
exports.deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM suppliers WHERE id=?", [id]);

    await redis.del("suppliers:all");
    await redis.del(`supplier:${id}`);
    res.json({ message: "Supplier deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
