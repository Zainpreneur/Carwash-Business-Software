require('dotenv').config();
const { createClient } = require('@libsql/client');
const { drizzle } = require('drizzle-orm/libsql');
const schema = require('../db/schema');

const client = createClient({
  url: process.env.LIBSQL_URL || 'file:local.db',
  offline: true,
});

const db = drizzle(client, { schema });

const connectDB = async () => {
  await client.execute('SELECT 1');
};

module.exports = { client, db, connectDB };