const db = require("../config/db");
const redis = require("../config/redis");

// CREATE
exports.addProduct = async (req, res) => {
  try {
    const { supplier_id, name, sku, description, category, moq, stock, image_url,price,bulk_price,tag } = req.body;
    await db.query(
      "INSERT INTO products (supplier_id, name, sku, description, category, moq, stock, image_url,price,bulk_price,tag) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)",
      [supplier_id, name, sku, description, category, moq, stock, image_url,price,bulk_price,tag]
    );
    
    res.status(201).json({ message: "Product added successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ (with Redis caching)
exports.getProducts = async (req, res) => {
  try {
    // Check Redis cache first
    const cached = await redis.get("products:all");
    if (cached) {
      console.log("📦 Serving products from Redis cache");
      return res.status(200).json(JSON.parse(cached));
    }

    // Query MySQL normally
    db.query("SELECT * FROM products WHERE is_active = 1", async (err, rows) => {
      if (err) {
        console.error("❌ MySQL error:", err);
        return res.status(500).json({ error: err.message });
      }

      if (!rows || rows.length === 0) {
        return res.status(404).json({ message: "No products found" });
      }

      // Cache result in Redis for 5 minutes
      await redis.setEx("products:all", 300, JSON.stringify(rows));
      console.log("💾 Products cached in Redis");

      return res.status(200).json(rows);
    });
  } catch (err) {
    console.error("❌ Redis/MySQL exception:", err);
    return res.status(500).json({ error: err.message });
  }
};


// GET Active Products by Tag
exports.getProductsByTag = async (req, res) => {
  try {
    const { tag } = req.params;

    if (!tag) {
      return res.status(400).json({ error: "Tag is required" });
    }

    const cacheKey = `products:tag:${tag}`;

    // Check Redis cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log("📦 Serving tagged products from Redis cache");
      return res.status(200).json(JSON.parse(cached));
    }

    // Query MySQL
    db.query(
      "SELECT * FROM products WHERE is_active = 1 AND tag = ?",
      [tag],
      async (err, rows) => {
        if (err) {
          console.error("❌ MySQL error:", err);
          return res.status(500).json({ error: err.message });
        }

        if (!rows || rows.length === 0) {
          return res.status(404).json({ message: "No products found for this tag" });
        }

        // Cache for 5 minutes
        await redis.setEx(cacheKey, 300, JSON.stringify(rows));
        console.log("💾 Tagged products cached in Redis");

        return res.status(200).json(rows);
      }
    );
  } catch (err) {
    console.error("❌ Redis/MySQL exception:", err);
    return res.status(500).json({ error: err.message });
  }
};



// UPDATE
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, stock, moq, is_active } = req.body;
    await db.query(
      "UPDATE products SET name=?, price=?, stock=?, moq=?, is_active=? WHERE id=?",
      [name, price, stock, moq, is_active, id]
    );
    await redis.del("products:all");
    res.json({ message: "Product updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE
exports.deleteProduct = async (req, res) => {
  try {
    await db.query("DELETE FROM products WHERE id=?", [req.params.id]);
    await redis.del("products:all");
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



////......Search Products...../////
exports.searchProducts = async (req, res) => {
    const { query } = req.query; // Retrieve the search query from the client

    if (!query) {
        return res.status(400).send("Search query is required");
    }

    // Full-Text Search Query
    const cacheKey = `searchProducts/:${query}`;

    try {
        // Check Redis cache for the search results
        const cachedResults = await redis.get(cacheKey);
        if (cachedResults) {
            console.log('🔁 Serving search results from cache', cachedResults);
            return res.status(200).json(JSON.parse(cachedResults));
        }

        // Full-Text Search Query (MySQL)
        let sql = `
            SELECT supplier_id, name, sku, description, category, moq, stock, image_url,price,bulk_price
            FROM products
            WHERE MATCH(name, sku, description, category) AGAINST(? IN NATURAL LANGUAGE MODE)
        `;
        db.query(sql, query, async (err, results) => {
            if (err) {
                console.error('❌ Error searching Products:', err);
                return res.status(500).send("Error searching posts");
            }

            // Cache the results in Redis with an expiration of 1 minute
            await redis.setEx(cacheKey, 300, JSON.stringify(results));
            console.log('💾 Search results cached',results);

           return res.status(200).json(results);
        });
    } catch (error) {
        console.error('❌ Redis error:', error);
       return res.status(500).send("Server error");
    }


};

