const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/solarlink',
});

async function initDb() {
  try {
    await pool.query(`
      ALTER TABLE grid_zones ADD COLUMN IF NOT EXISTS throttled BOOLEAN DEFAULT FALSE;
      ALTER TABLE grid_zones ADD COLUMN IF NOT EXISTS curtailment_active BOOLEAN DEFAULT FALSE;
      ALTER TABLE trades ADD COLUMN IF NOT EXISTS compliance_flagged BOOLEAN DEFAULT FALSE;
      ALTER TABLE trades ADD COLUMN IF NOT EXISTS compliance_note TEXT;
      ALTER TABLE trades ADD COLUMN IF NOT EXISTS flagged_by UUID;
    `);
    console.log('Database schema auto-migrations applied successfully');
  } catch (err) {
    console.error('Error applying DB migrations:', err.message);
  }
}

// Run DB migrations immediately on module load
initDb();

module.exports = {
  query: (text, params) => pool.query(text, params),
  getPool: () => pool,
  initDb
};

