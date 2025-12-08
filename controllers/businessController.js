const db = require("../config/db");
const redis = require("../config/redis");
const { v4: uuidv4 } = require("uuid");

// -----------------------------------------------------
// CREATE BUSINESS
// -----------------------------------------------------
exports.createBusiness = async (req, res) => {
  const {
    uid,
    registration_number,
    business_name,
    business_type,
    industry_category,
    description,
    contact_full_name,
    contact_role,
    contact_email,
    contact_phone,
    delivery_address
  } = req.body;

  const business_uid = uuidv4();

  const sql = `
    INSERT INTO businesses (
      business_uid, uid, registration_number, business_name, business_type, industry_category,
      description, contact_full_name, contact_role, contact_email, contact_phone, delivery_address
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      business_uid,
      uid,
      registration_number,
      business_name,
      business_type,
      industry_category,
      description,
      contact_full_name,
      contact_role,
      contact_email,
      contact_phone,
      delivery_address
    ],
    async (err, result) => {
      if (err) return res.status(500).json({ error: err });

      // Clear caches
      await redis.del("all_businesses");
      await redis.del(`business_reg_${registration_number}`);

      res.json({ success: true, id: result.insertId, business_uid });
    }
  );
};

// -----------------------------------------------------
// CHECK BUSINESS BY REGISTRATION NUMBER
// -----------------------------------------------------
exports.checkBusinessByRegNo = async (req, res) => {
  const { regno } = req.query;

  if (!regno) {
    return res.status(400).json({ error: "Registration number is required" });
  }

  const cacheKey = `business_reg_${regno}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    db.query(
      "SELECT * FROM businesses WHERE registration_number = ?",
      [regno],
      async (err, results) => {
        if (err) return res.status(500).json({ error: err });

        const exists = results.length > 0;
        const response = { exists, business: exists ? results[0] : null };

        await redis.setEx(cacheKey, 300, JSON.stringify(response));

        res.json(response);
      }
    );
  } catch (error) {
    res.status(500).json({ error });
  }
};








// -----------------------------------------------------
// CHECK BUSINESS BY UID
// -----------------------------------------------------
exports.checkBusinessByUID = async (req, res) => {
  const { uid } = req.query;

  if (!uid) {
    return res.status(400).json({ error: "UID is required" });
  }

  const cacheKey = `business_reg_${uid}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    db.query(
      "SELECT * FROM businesses WHERE uid = ?",
      [uid],
      async (err, results) => {
        if (err) return res.status(500).json({ error: err });

        const exists = results.length > 0;
        const response = { exists, business: exists ? results[0] : null };

        await redis.setEx(cacheKey, 300, JSON.stringify(response));

        res.json(response);
      }
    );
  } catch (error) {
    res.status(500).json({ error });
  }
};


// -----------------------------------------------------
// GET ALL BUSINESSES
// -----------------------------------------------------
exports.getAllBusinesses = async (req, res) => {
  try {
    const cached = await redis.get("all_businesses");
    if (cached) return res.json(JSON.parse(cached));

    db.query("SELECT * FROM businesses", async (err, results) => {
      if (err) return res.status(500).json({ error: err });

      await redis.setEx("all_businesses", 3600, JSON.stringify(results));
      res.json(results);
    });
  } catch (error) {
    res.status(500).json({ error });
  }
};

// -----------------------------------------------------
// GET BUSINESS BY ID
// -----------------------------------------------------
exports.getBusinessById = async (req, res) => {
  const { id } = req.params;

  const cacheKey = `business_id_${id}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    db.query(
      "SELECT * FROM businesses WHERE uid = ?",
      [id],
      async (err, results) => {
        if (err) return res.status(500).json({ error: err });
        if (results.length === 0)
          return res.status(404).json({ error: "Business not found" });

        await redis.setEx(cacheKey, 3600, JSON.stringify(results[0]));

        res.json(results[0]);
      }
    );
  } catch (error) {
    res.status(500).json({ error });
  }
};

// -----------------------------------------------------
// UPDATE BUSINESS
// -----------------------------------------------------
exports.updateBusiness = async (req, res) => {
  const { id } = req.params;
  const {
    business_name,
    business_type,
    industry_category,
    description,
    contact_full_name,
    contact_role,
    contact_email,
    contact_phone,
    delivery_address
  } = req.body;

  const sql = `
    UPDATE businesses SET
      business_name=?, business_type=?, industry_category=?, description=?,
      contact_full_name=?, contact_role=?, contact_email=?, contact_phone=?, delivery_address=?
    WHERE business_id=?
  `;

  db.query(
    sql,
    [
      business_name,
      business_type,
      industry_category,
      description,
      contact_full_name,
      contact_role,
      contact_email,
      contact_phone,
      delivery_address,
      id
    ],
    async (err) => {
      if (err) return res.status(500).json({ error: err });

      await redis.del("all_businesses");
      await redis.del(`business_id_${id}`);

      res.json({ success: true });
    }
  );
};

// -----------------------------------------------------
// DELETE BUSINESS
// -----------------------------------------------------
exports.deleteBusiness = async (req, res) => {
  const { id } = req.params;

  db.query(
    "DELETE FROM businesses WHERE business_id = ?",
    [id],
    async (err) => {
      if (err) return res.status(500).json({ error: err });

      await redis.del("all_businesses");
      await redis.del(`business_id_${id}`);

      res.json({ success: true });
    }
  );
};
