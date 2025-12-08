const db = require("../config/db");
const redisClient = require("../config/redis");

// Unique redis key for B2B carts
const cartCacheKey = (uid) => `cart:b2b:${uid}`;

/* -------------------------------------------
   HELPER: Fetch cart from DB (grouped items)
--------------------------------------------*/
function getCartFromDB(uid) {
  return new Promise((resolve, reject) => {
    db.query(
      `
      SELECT 
        c.product_id,
        p.name,
        p.image_url,
        SUM(c.quantity) AS quantity,
        c.price AS unit_price,
        SUM(c.quantity * c.price) AS total
      FROM cart_items c
      JOIN products p ON c.product_id = p.id
      WHERE c.uid = ?
      GROUP BY c.product_id, p.name, p.image_url, c.price
      ORDER BY p.name ASC
      `,
      [uid],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      }
    );
  });
}


/* -------------------------------------------
   ADD OR UPDATE SINGLE B2B CART ITEM
--------------------------------------------*/
exports.addToB2BCart = async (req, res) => {
  const { uid, product_id, quantity, price, image_url } = req.body;
  
    if (!uid || !product_id || !quantity || !price)
      return res.status(400).json({ message: "Missing required fields", uid,product_id ,quantity,price,image_url});
  
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


/* -------------------------------------------
   BULK ADD ITEMS (SAVE ALL)
--------------------------------------------*/
exports.bulkAddToB2BCart = async (req, res) => {
  const { uid, items } = req.body;

  if (!uid || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Missing uid or items list" });
  }

  // Validate items before SQL
  for (const it of items) {
    if (!it.product_id || !it.quantity || !it.price) {
      return res.status(400).json({ message: "Missing fields in items" });
    }
    if (it.moq && Number(it.quantity) < Number(it.moq)) {
      return res.status(400).json({
        message: `Product ${it.product_id} requires MOQ of ${it.moq}`,
      });
    }
  }

  try {
    // Build placeholders
    const values = [];
    const placeholders = items
      .map((it) => {
        values.push(uid, it.product_id, it.quantity, it.price, it.image_url || null);
        return "(?, ?, ?, ?, ?)";
      })
      .join(", ");

    const sql = `
      INSERT INTO cart_items (uid, product_id, quantity, price, image_url)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        quantity = VALUES(quantity),
        price = VALUES(price),
        image_url = VALUES(image_url)
    `;

    await new Promise((resolve, reject) => {
      db.query(sql, values, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    return res.status(201).json({ message: "Bulk add successful" });
  } catch (err) {
    console.error("❌ bulkAddToB2BCart Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


/* -------------------------------------------
   GET B2B CART (REDIS FIRST)
--------------------------------------------*/
exports.getB2BCart = async (req, res) => {
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


/* -------------------------------------------
   REMOVE ONE ITEM
--------------------------------------------*/
exports.removeFromB2BCart = (req, res) => {
  const { uid, product_id } = req.body;

  if (!uid || !product_id) {
    return res.status(400).json({ message: "Missing uid or product_id" });
  }

  const sql = `DELETE FROM cart_items WHERE uid = ? AND product_id = ?`;

  db.query(sql, [uid, product_id], (err, result) => {
    if (err) {
      console.error("❌ MySQL error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Item not found" });
    }

    return res.status(200).json({ message: "Item removed successfully" });
  });
};


/* -------------------------------------------
   CLEAR CART
--------------------------------------------*/
exports.clearB2BCart = async (req, res) => {
  const { uid } = req.body;

  try {
    await new Promise((resolve, reject) => {
      db.query(`DELETE FROM cart_items WHERE uid = ?`, [uid], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    await redisClient.del(cartCacheKey(uid));

    return res.status(200).json({ message: "B2B Cart cleared successfully" });
  } catch (error) {
    console.error("❌ clearB2BCart Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
