'use strict';

/**
 * make-admin.js — Promueve un usuario existente al rol 'admin'.
 *
 * Uso:
 *   node make-admin.js <email>
 *
 * Ejemplos:
 *   node make-admin.js tu@email.com
 *   DATABASE_PATH=/app/data/gantt.db node make-admin.js tu@email.com
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const email = process.argv[2];

if (!email || !email.includes('@')) {
  console.error('Uso: node make-admin.js <email>');
  process.exit(1);
}

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'gantt.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Base de datos no encontrada en: ${dbPath}`);
  console.error('Verifica la ruta o define DATABASE_PATH.');
  process.exit(1);
}

const db = new Database(dbPath);

const user = db.prepare('SELECT id, email, username, role FROM users WHERE email = ?').get(email);

if (!user) {
  console.error(`No se encontró ningún usuario con email: ${email}`);
  db.close();
  process.exit(1);
}

if (user.role === 'admin') {
  console.log(`El usuario "${user.username}" (${email}) ya tiene rol admin.`);
  db.close();
  process.exit(0);
}

const result = db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email);

if (result.changes === 0) {
  console.error('No se realizaron cambios. Comprueba el email e inténtalo de nuevo.');
  db.close();
  process.exit(1);
}

console.log(`Listo. Usuario "${user.username}" (${email}) promovido a admin.`);
db.close();
