
const { createClient } = require('redis');
require('dotenv').config();

// Create Redis client using REDIS_URL (from Railway)
const client = createClient({
  url: process.env.REDIS_URL,  // use full URL
});

// Event: Connected
client.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

// Event: Error
client.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
});

// Connect and test
(async () => {
  try {
    await client.connect();
    const pong = await client.ping();
    console.log('✅ Redis PING:', pong); // Should print "PONG"
  } catch (err) {
    console.error('❌ Redis error:', err.message);
  }
})();

// Export client
module.exports = client;

// const redis = require("redis");
// const client = redis.createClient();
// client.connect()
//   .then(() => console.log("📦 Redis Connected"))
//   .catch(err => console.error("❌ Redis Error:", err));
// module.exports = client;
