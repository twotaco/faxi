import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { db } from './connection';

export async function runMigrations(): Promise<void> {
  try {
    console.log('Running database migrations...');
    
    // Run base schema first
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    console.log('Running base schema...');
    try {
      await db.query(schema);
      console.log('Base schema completed');
    } catch (error: any) {
      // Ignore errors for already existing objects
      if (error.code === '42P07' || error.code === '42710') {
        console.log('Base schema already exists, continuing with migrations...');
      } else {
        throw error;
      }
    }
    
    // Run additional migrations in order
    const migrationsDir = join(__dirname, 'migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}`);
      const migrationPath = join(migrationsDir, file);
      const migration = readFileSync(migrationPath, 'utf-8');
      
      try {
        await db.query(migration);
        console.log(`✓ ${file} completed`);
      } catch (error: any) {
        // Ignore errors for already existing objects or known issues
        // 42P07: duplicate table, 42710: duplicate object, 42704: undefined object
        // 42P01: undefined table, 42701: duplicate column, 42703: undefined column
        if (error.code === '42P07' || error.code === '42710' || error.code === '42704' || 
            error.code === '42P01' || error.code === '42701' || error.code === '42703') {
          console.log(`⊘ ${file} skipped (${error.message})`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migrations complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}
