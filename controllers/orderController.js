const db = require("../config/db");
const redisClient = require("../config/redis");

const orderCacheKey = (userId) => `orders:${userId}`;

// ✅ Place an order (cart → order)
exports.placeOrder = (req, res) => {
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
  if (safeCartItems.length === 0) {
    return res.status(400).json({ message: "Cart is empty or invalid" });
  }

  if (!shipping_name || !country || !address || !payment_method) {
    return res.status(400).json({ message: "Missing required order fields" });
  }

  const totalAmount = safeCartItems.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
    0
  );

  db.getConnection((err, conn) => {
    if (err) {
      console.error("❌ Connection Error:", err);
      return res.status(500).json({ message: "Server error" });
    }

    conn.beginTransaction(err => {
      if (err) {
        conn.release();
        console.error("❌ Transaction Error:", err);
        return res.status(500).json({ message: "Server error" });
      }

      conn.query(
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
        ],
        (err, orderResult) => {
          if (err) {
            return conn.rollback(() => {
              conn.release();
              console.error("❌ Order Insert Error:", err);
              return res.status(500).json({ message: "Server error" });
            });
          }

          const orderId = orderResult.insertId;

          const itemsValues = safeCartItems.map(item => [
            orderId,
            item.product_id,
            item.quantity || 1,
            item.price || 0
          ]);

          conn.query(
            `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ?`,
            [itemsValues],
            (err) => {
              if (err) {
                return conn.rollback(() => {
                  conn.release();
                  console.error("❌ Order Items Insert Error:", err);
                  return res.status(500).json({ message: "Server error" });
                });
              }

              conn.commit(commitErr => {
                if (commitErr) {
                  return conn.rollback(() => {
                    conn.release();
                    console.error("❌ Commit Error:", commitErr);
                    return res.status(500).json({ message: "Server error" });
                  });
                }

                conn.release();

                if (uid) {
                  db.query(`DELETE FROM cart_items WHERE uid = ?`, [uid], () => {});
                  redisClient.del(`cart:${uid}`);
                  redisClient.del(orderCacheKey(uid));
                }

                return res.status(200).json({
                  message: "Order placed successfully",
                  order_id: orderId,
                  total_amount: totalAmount
                });
              });
            }
          );
        }
      );
    });
  });
};


exports.getOrderByOrderId = async (req, res) => {
  const { order_id } = req.params;

  try {
    // get main order
    const [[order]] = await db.query(
      `SELECT id, user_id, shipping_name, company_name, country, state, town,
              address, phone, email, order_type, total_amount, payment_method,
              status, fulfillment_status, created_at
       FROM orders
       WHERE id = ?`,
      [order_id]
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // get order items
    const [items] = await db.query(
      `SELECT product_id, quantity, price
       FROM order_items
       WHERE order_id = ?`,
      [order_id]
    );

    order.items = items;

    res.status(200).json(order);
  } catch (error) {
    console.error("Error getting order by order_id:", error);
    res.status(500).json({ message: "Server error" });
  }
};




// ✅ Get orders for a user
exports.getUserOrders = async (req, res) => {
  const { uid } = req.params;
  try {
    const cacheKey = orderCacheKey(uid);

    const cached = await redisClient.get(cacheKey);
    if (cached) return res.status(200).json(JSON.parse(cached));

    const [orders] = await db.query(
      `SELECT id, shipping_name, total_amount, payment_method, status, fulfillment_status, created_at
       FROM orders WHERE uid = ? ORDER BY created_at DESC`,
      [uid]
    );

    await redisClient.setEx(cacheKey, 600, JSON.stringify(orders));

    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Admin: Get all orders
exports.getAllOrders = async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.id, u.name AS customer_name,
              o.shipping_name, o.country, o.town,
              o.total_amount, o.status, o.fulfillment_status,
              o.payment_method, o.created_at
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC`
    );

    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Update status
exports.updateOrderStatus = async (req, res) => {
  const { order_id, status } = req.body;

  if (!order_id || !status)
    return res.status(400).json({ message: "Missing fields" });

  try {
    await db.query(
      `UPDATE orders SET status = ? WHERE id = ?`,
      [status, order_id]
    );

    res.status(200).json({ message: "Order status updated" });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Cancel order
exports.cancelOrder = async (req, res) => {
  const { order_id, user_id } = req.body;

  try {
    await db.query(
      `UPDATE orders 
       SET status = 'cancelled' 
       WHERE id = ? AND user_id = ?`,
      [order_id, user_id]
    );

    await redisClient.del(orderCacheKey(user_id));

    res.status(200).json({ message: "Order cancelled" });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ message: "Server error" });
  }
};
