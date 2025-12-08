const db = require("../config/db");
const redisClient = require("../config/redis");

const cartCacheKey = (uid) => `cart:${uid}`;

/* ✅ Add or Update Cart Item */
exports.addToCart = async (req, res) => {
  const { uid, product_id, quantity, price, image_url } = req.body;

  if (!uid || !product_id || !quantity || !price)
    return res.status(400).json({ message: "Missing required fields" });

  try {
    // 🧩 Insert or update existing item (avoid duplicates for same user + product)
    const sql = `
      INSERT INTO cart_items (uid, product_id, quantity, price, image_url)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        quantity = VALUES(quantity), 
        price = VALUES(price),
        image_url = VALUES(image_url)
    `;

    await new Promise((resolve, reject) => {
      db.query(sql, [uid, product_id, quantity, price, image_url], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    return res.status(201).json({
      message: "✅ Item added or updated successfully",
    });
  } catch (error) {
    console.error("❌ Error adding to cart:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


/* ✅ Helper: Fetch cart from DB */
async function getCartFromDB(uid) {
  return new Promise((resolve, reject) => {
    db.query(
      `
      SELECT 
        c.id,
        c.uid,
        c.product_id,
        p.name,
        p.image_url,
        c.quantity,
        c.price,
        (c.quantity * c.price) AS total
      FROM cart_items c
      JOIN products p ON c.product_id = p.id
      WHERE c.uid = ?
      ORDER BY c.id DESC
      `,
      [uid],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

/* ✅ Get Cart Items (from Redis or DB) */
exports.getCart = async (req, res) => {
  const { uid } = req.params;
  if (!uid) return res.status(400).json({ message: "Missing user UID" });

  try {
    const cacheKey = cartCacheKey(uid);

    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log("📦 Serving cart from Redis cache");
      return res.status(200).json(JSON.parse(cached));
    }

    const rows = await getCartFromDB(uid);
    await redisClient.setEx(cacheKey, 600, JSON.stringify(rows));

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching cart:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ✅ Get Cart Total (MySQL version) */
exports.getCartTotal = async (req, res) => {
  const { uid } = req.params;
  if (!uid) return res.status(400).json({ message: "Missing user UID" });

  try {
    const rows = await new Promise((resolve, reject) => {
      db.query(
        `
        SELECT 
          c.product_id,
          p.name,
          c.quantity,
          c.price,
          c.image_url,
          (c.quantity * c.price) AS total
        FROM cart_items c
        JOIN products p ON c.product_id = p.id
        WHERE c.uid = ?
        `,
        [uid],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    if (!rows || rows.length === 0) {
      return res.status(200).json({ totalItems: 0, totalAmount: 0, items: [] });
    }

    // 🧮 Calculate totals
    const totalAmount = rows.reduce(
      (sum, item) => sum + parseFloat(item.total || 0),
      0
    );
    const totalItems = rows.reduce(
      (sum, item) => sum + parseInt(item.quantity || 0),
      0
    );

    return res.status(200).json({
      totalItems,
      totalAmount,
      items: rows,
    });
  } catch (error) {
    console.error("❌ Error calculating cart total:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ✅ Remove single item — no Redis, no cache */
exports.removeFromCart = (req, res) => {
  const { uid, product_id } = req.body;

  if (!uid || !product_id) {
    return res.status(400).json({ message: "Missing uid or product_id" });
  }

  const sql = "DELETE FROM cart_items WHERE uid = ? AND product_id = ?";

  db.query(sql, [uid, product_id], (err, result) => {
    if (err) {
      console.error("❌ MySQL error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    return res.status(200).json({ message: "✅ Item removed successfully" });
  });
};
/* ✅ Remove single item — compatible with mysql (not mysql2) */



/* ✅ Clear entire cart */
exports.clearCart = async (req, res) => {
  const { uid } = req.body;

  try {
    await new Promise((resolve, reject) => {
      db.query(`DELETE FROM cart_items WHERE uid = ?`, [uid], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    await redisClient.del(cartCacheKey(uid));

    res.status(200).json({ message: "Cart cleared successfully" });
  } catch (error) {
    console.error("Error clearing cart:", error);
    res.status(500).json({ message: "Server error" });
  }
};
