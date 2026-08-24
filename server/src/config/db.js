require('dotenv').config();
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/carwash',
});

const db = drizzle(pool);

const connectDB = async () => {
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
};

module.exports = { pool, db, connectDB };
