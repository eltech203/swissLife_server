const redis = require("redis");
const client = redis.createClient();
client.connect()
  .then(() => console.log("📦 Redis Connected"))
  .catch(err => console.error("❌ Redis Error:", err));
module.exports = client;
