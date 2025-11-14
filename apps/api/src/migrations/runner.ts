import { readdirSync, readFileSync } from 'fs';
import { join, extname } from 'path';
import { getPool, query } from '../db';
import { logger } from '../logger';

interface MigrationFile {
  version: number;
  name: string;
  path: string;
  up: string;
  down?: string;
}

/**
 * Migration framework for tracking and applying database schema changes.
 * Supports idempotent migrations and rollback capability.
 */
export class MigrationRunner {
  private migrationsDir: string;

  constructor(migrationsDir: string) {
    this.migrationsDir = migrationsDir;
  }

  /**
   * Ensures the migrations table exists.
   */
  private async ensureMigrationsTable(): Promise<void> {
    await query(`
      create table if not exists schema_migrations (
        version integer primary key,
        name text not null,
        applied_at timestamptz not null default now()
      )
    `);
  }

  /**
   * Loads all migration files from the migrations directory.
   */
  private loadMigrations(): MigrationFile[] {
    try {
      const files = readdirSync(this.migrationsDir)
        .filter((f) => extname(f) === '.sql')
        .sort();

    return files.map((file) => {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        throw new Error(`Invalid migration file name: ${file}. Expected format: NNN_name.sql`);
      }
      const version = parseInt(match[1], 10);
      const name = match[2];
      const path = join(this.migrationsDir, file);
      const content = readFileSync(path, 'utf8');

      // Split content into up and down migrations (separated by -- DOWN)
      const parts = content.split(/^--\s*DOWN\s*$/im);
      const up = parts[0].trim();
      const down = parts[1]?.trim();

      return { version, name, path, up, down };
    });
    } catch (err) {
      throw new Error(`Failed to read migrations directory: ${this.migrationsDir}. ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Gets list of already applied migrations.
   */
  private async getAppliedMigrations(): Promise<Set<number>> {
    const { rows } = await query<{ version: number }>(
      'select version from schema_migrations order by version',
    );
    return new Set(rows.map((r) => r.version));
  }

  /**
   * Applies a single migration.
   */
  private async applyMigration(migration: MigrationFile): Promise<void> {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      
      // Check if already applied (idempotent check)
      const { rows } = await client.query<{ version: number }>(
        'select version from schema_migrations where version = $1',
        [migration.version],
      );
      
      if (rows.length > 0) {
        logger.info({ version: migration.version, name: migration.name }, 'Migration already applied, skipping');
        await client.query('COMMIT');
        return;
      }

      // Execute migration SQL
      await client.query(migration.up);
      
      // Record migration
      await client.query(
        'insert into schema_migrations (version, name) values ($1, $2)',
        [migration.version, migration.name],
      );

      await client.query('COMMIT');
      logger.info({ version: migration.version, name: migration.name }, 'Migration applied successfully');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Rolls back a single migration.
   */
  private async rollbackMigration(migration: MigrationFile): Promise<void> {
    if (!migration.down) {
      throw new Error(`Migration ${migration.version}_${migration.name} has no rollback SQL`);
    }

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      
      // Check if migration is applied
      const { rows } = await client.query<{ version: number }>(
        'select version from schema_migrations where version = $1',
        [migration.version],
      );
      
      if (rows.length === 0) {
        logger.info({ version: migration.version, name: migration.name }, 'Migration not applied, skipping rollback');
        await client.query('COMMIT');
        return;
      }

      // Execute rollback SQL
      await client.query(migration.down);
      
      // Remove migration record
      await client.query('delete from schema_migrations where version = $1', [migration.version]);

      await client.query('COMMIT');
      logger.info({ version: migration.version, name: migration.name }, 'Migration rolled back successfully');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Applies all pending migrations.
   */
  async migrate(): Promise<void> {
    await this.ensureMigrationsTable();
    const migrations = this.loadMigrations();
    const applied = await this.getAppliedMigrations();

    const pending = migrations.filter((m) => !applied.has(m.version));

    if (pending.length === 0) {
      logger.info('No pending migrations');
      return;
    }

    logger.info({ count: pending.length }, 'Applying pending migrations');

    for (const migration of pending) {
      try {
        await this.applyMigration(migration);
      } catch (err) {
        logger.error({ migration: migration.name, version: migration.version, error: err }, 'Migration failed');
        throw err;
      }
    }

    logger.info({ count: pending.length }, 'All migrations applied successfully');
  }

  /**
   * Rolls back the last applied migration.
   */
  async rollback(): Promise<void> {
    await this.ensureMigrationsTable();
    const migrations = this.loadMigrations();
    const applied = await this.getAppliedMigrations();

    // Find the highest applied migration
    const appliedMigrations = migrations
      .filter((m) => applied.has(m.version))
      .sort((a, b) => b.version - a.version);

    if (appliedMigrations.length === 0) {
      logger.info('No migrations to rollback');
      return;
    }

    const lastMigration = appliedMigrations[0];
    logger.info({ version: lastMigration.version, name: lastMigration.name }, 'Rolling back last migration');

    try {
      await this.rollbackMigration(lastMigration);
    } catch (err) {
      logger.error({ migration: lastMigration.name, version: lastMigration.version, error: err }, 'Rollback failed');
      throw err;
    }
  }

  /**
   * Gets migration status.
   */
  async status(): Promise<{ applied: MigrationFile[]; pending: MigrationFile[] }> {
    await this.ensureMigrationsTable();
    const migrations = this.loadMigrations();
    const applied = await this.getAppliedMigrations();

    return {
      applied: migrations.filter((m) => applied.has(m.version)),
      pending: migrations.filter((m) => !applied.has(m.version)),
    };
  }
}

