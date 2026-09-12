require('dotenv').config();
const db = require('./src/services/db.service');

async function run() {
  const client = await db.getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallet_deposits (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('wallet_deposits table created successfully');
  } catch (err) {
    console.error('Error creating table:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
