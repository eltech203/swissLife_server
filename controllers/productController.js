const db = require("../config/db");
const redis = require("../config/redis");

// CREATE
exports.addProduct = async (req, res) => {
  try {
    const {
      supplier_id, name, sku, description, category, moq, stock,
      image_url, price, bulk_price, tag
    } = req.body;

    await db.query(
      `INSERT INTO products 
       (supplier_id, name, sku, description, category, moq, stock, image_url, price, bulk_price, tag)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [supplier_id, name, sku, description, category, moq, stock, image_url, price, bulk_price, tag]
    );

    res.status(201).json({ message: "Product added successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ (with Redis caching)
exports.getProducts = async (req, res) => {
  try {
    const cached = await redis.get("products:all");

    if (cached) {
      console.log("📦 Serving products from Redis cache");
      return res.status(200).json(JSON.parse(cached));
    }

    const [rows] = await db.query("SELECT * FROM products WHERE is_active = 1");

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "No products found" });
    }

    await redis.setEx("products:all", 300, JSON.stringify(rows));
    console.log("💾 Products cached in Redis");

    return res.status(200).json(rows);
  } catch (err) {
    console.error("❌ Redis/MySQL exception:", err);
    res.status(500).json({ error: err.message });
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
    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log("📦 Serving tagged products from Redis cache");
      return res.status(200).json(JSON.parse(cached));
    }

    const [rows] = await db.query(
      "SELECT * FROM products WHERE is_active = 1 AND tag = ?",
      [tag]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "No products found for this tag" });
    }

    await redis.setEx(cacheKey, 300, JSON.stringify(rows));
    console.log("💾 Tagged products cached in Redis");

    return res.status(200).json(rows);
  } catch (err) {
    console.error("❌ Redis/MySQL exception:", err);
    res.status(500).json({ error: err.message });
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

// SEARCH PRODUCTS
exports.searchProducts = async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).send("Search query is required");
  }

  const cacheKey = `searchProducts:${query}`;

  try {
    const cachedResults = await redis.get(cacheKey);

    if (cachedResults) {
      console.log("🔁 Serving search results from cache");
      return res.status(200).json(JSON.parse(cachedResults));
    }

    const [results] = await db.query(
      `
      SELECT supplier_id, name, sku, description, category, moq, stock, image_url, price, bulk_price
      FROM products
      WHERE MATCH(name, sku, description, category)
      AGAINST(? IN NATURAL LANGUAGE MODE)
      `,
      [query]
    );

    await redis.setEx(cacheKey, 300, JSON.stringify(results));
    console.log("💾 Search results cached");

    return res.status(200).json(results);
  } catch (error) {
    console.error("❌ Redis/MySQL error:", error);
    return res.status(500).send("Server error");
  }
};
