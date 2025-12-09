const db = require("../config/db");
const redisClient = require("../config/redis");
const util = require("util");

const query = util.promisify(db.query).bind(db); // Wrap db.query
const orderCacheKey = (userId) => `orders:${userId}`;

// ✅ Place an order (cart → order)
exports.placeOrder = async (req, res) => {
  const {
    uid,
    user_id,
    shipping_name,
    company_name,
    country,
    state,
    town,
    address,
    phone,
    email,
    order_type,
    payment_method,
    cartItems
  } = req.body;

  const safeCartItems = Array.isArray(cartItems) ? cartItems : [];
  if (safeCartItems.length === 0) return res.status(400).json({ message: "Cart is empty" });
  if (!shipping_name || !country || !address || !payment_method)
    return res.status(400).json({ message: "Missing required order fields" });

  const totalAmount = safeCartItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);

  try {
    // Insert order
    const result = await query(
      `INSERT INTO orders (
        uid, user_id, shipping_name, company_name, country, state, town,
        address, phone, email, order_type, total_amount, payment_method,
        status, fulfillment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')`,
      [
        uid || null,
        user_id || null,
        shipping_name,
        company_name || null,
        country,
        state || null,
        town || null,
        address,
        phone || null,
        email || null,
        order_type || "b2b",
        totalAmount,
        payment_method
      ]
    );

    const orderId = result.insertId;

    // Insert order items
    if (safeCartItems.length > 0) {
      const itemsValues = safeCartItems.map(item => [
        orderId,
        item.product_id,
        item.quantity || 1,
        item.price || 0
      ]);

      await query(
        `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ?`,
        [itemsValues]
      );
    }

    // Clear cart & Redis
    if (uid) {
      await query(`DELETE FROM cart_items WHERE uid = ?`, [uid]);
      await redisClient.del(`cart:${uid}`);
      await redisClient.del(orderCacheKey(uid));
    }

    res.status(200).json({ message: "Order placed successfully", order_id: orderId, total_amount: totalAmount });
  } catch (err) {
    console.error("❌ Place order error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get orders for a user with items and product info
exports.getUserOrders = async (req, res) => {
  const { uid } = req.params;

  try {
    const cacheKey = orderCacheKey(uid);
    const cached = await redisClient.get(cacheKey);
    if (cached) return res.status(200).json(JSON.parse(cached));

    // Get orders for the user
    const orders = await query(
      `SELECT id, shipping_name, total_amount, payment_method, status, fulfillment_status, created_at
       FROM orders 
       WHERE uid = ? 
       ORDER BY created_at DESC`,
      [uid]
    );

    // Fetch items for each order
    for (const order of orders) {
      const items = await query(
        `SELECT oi.product_id, p.name, p.image_url, oi.quantity, oi.price
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    // Cache the result in Redis
    await redisClient.setEx(cacheKey, 600, JSON.stringify(orders));

    res.status(200).json(orders);
  } catch (error) {
    console.error("❌ Error fetching user orders with items:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get order by order ID
exports.getOrderByOrderId = async (req, res) => {
  const { order_id } = req.params;

  try {
    const [order] = await query(
      `SELECT id, user_id, shipping_name, company_name, country, state, town,
              address, phone, email, order_type, total_amount, payment_method,
              status, fulfillment_status, created_at
       FROM orders
       WHERE id = ?`,
      [order_id]
    );

    if (!order) return res.status(404).json({ message: "Order not found" });

    const items = await query(
      `SELECT product_id, quantity, price FROM order_items WHERE order_id = ?`,
      [order_id]
    );

    order.items = items;
    res.status(200).json(order);
  } catch (error) {
    console.error("❌ Error getting order by ID:", error);
    res.status(500).json({ message: "Server error" });
  }
};
