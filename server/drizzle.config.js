require('dotenv').config();

module.exports = {
  dialect: 'sqlite',
  schema: './src/db/schema.js',
  out: './drizzle',
  dbCredentials: {
    url: process.env.LIBSQL_URL || 'file:local.db',
  },
};