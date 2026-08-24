require('dotenv').config();

module.exports = {
  dialect: 'postgresql',
  schema: './src/db/schema.js',
  out: './drizzle',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      `postgres://${process.env.PGUSER || process.env.USER || 'root'}@localhost:5432/carwash`,
  },
};
