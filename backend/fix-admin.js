require('dotenv').config();
const db = require('./src/services/db.service');
const bcrypt = require('bcrypt');

async function fix() {
  try {
    const hash = await bcrypt.hash('password123', 10);
    console.log('New hash generated:', hash);
    await db.query(`UPDATE users SET password_hash = $1 WHERE email = 'admin@solarlink.com'`, [hash]);
    console.log('Successfully updated admin@solarlink.com password to "password123"');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

fix();
