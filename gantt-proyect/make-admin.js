'use strict';

/**
 * make-admin.js - Promote an existing user to the global 'admin' role.
 *
 * Usage:
 *   node make-admin.js <email>
 */

const { Pool } = require('pg');

const email = process.argv[2];

if (!email || !email.includes('@')) {
  console.error('Usage: node make-admin.js <email>');
  process.exit(1);
}

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'gantt',
    password: process.env.DB_PASSWORD || 'gantt',
    database: process.env.DB_NAME || 'gantt',
  });

  try {
    const userResult = await pool.query(
      'SELECT id, email, username, role FROM users WHERE email = $1',
      [email]
    );

    const user = userResult.rows[0];
    if (!user) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }

    if (user.role === 'admin') {
      console.log(`User "${user.username}" (${email}) is already admin.`);
      process.exit(0);
    }

    const updateResult = await pool.query(
      "UPDATE users SET role = 'admin' WHERE email = $1",
      [email]
    );

    if ((updateResult.rowCount || 0) === 0) {
      console.error('No changes made. Verify email and try again.');
      process.exit(1);
    }

    console.log(`Done. User "${user.username}" (${email}) promoted to admin.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Failed to promote user:', err.message);
  process.exit(1);
});
