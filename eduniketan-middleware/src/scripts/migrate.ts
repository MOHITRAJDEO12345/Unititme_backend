import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

async function migrate() {
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL not found in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase PostgreSQL');

    const migrationPath = path.resolve(__dirname, '../../../database_schema/supa_migrations.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('⏳ Applying migrations...');
    await client.query(sql);
    console.log('🎉 Database Schema Applied Successfully!');

  } catch (err: any) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

migrate();
