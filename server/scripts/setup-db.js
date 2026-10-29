/**
 * Creates the Code Mentor tables in the database from DATABASE_URL.
 * Usage: npm run db:setup
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

async function main() {
    if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('postgres')) {
        console.error('DATABASE_URL in server/.env is not set to a Postgres connection string.');
        process.exit(1);
    }

    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
    await pool.query(sql);

    const { rows } = await pool.query(
        `select table_name from information_schema.tables
         where table_schema = 'public' order by table_name`
    );
    console.log('Database ready. Tables:', rows.map((r) => r.table_name).join(', '));
}

main()
    .catch((err) => {
        console.error('Database setup failed:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
