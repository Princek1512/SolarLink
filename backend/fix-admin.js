require('dotenv').config();
const db = require('./src/services/db.service');
const bcrypt = require('bcrypt');

async function fix() {
  try {
    const hash = await bcrypt.hash('password123', 10);
    console.log('New hash generated:', hash);
    await db.query(`UPDATE users SET password_hash = $1;`, [hash]);
    console.log('Successfully updated all users passwords to "password123"');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

fix();

