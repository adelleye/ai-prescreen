import { join } from 'path';
import { MigrationRunner } from '../src/migrations/runner';

async function main() {
  const command = process.argv[2] || 'migrate';
  const migrationsDir = join(process.cwd(), 'migrations');
  const runner = new MigrationRunner(migrationsDir);

  try {
    switch (command) {
      case 'migrate':
        await runner.migrate();
        break;
      case 'rollback':
        await runner.rollback();
        break;
      case 'status':
        const status = await runner.status();
        // eslint-disable-next-line no-console
        console.log('Applied migrations:', status.applied.map((m) => `${m.version}_${m.name}`).join(', '));
        // eslint-disable-next-line no-console
        console.log('Pending migrations:', status.pending.map((m) => `${m.version}_${m.name}`).join(', ') || 'None');
        break;
      default:
        // eslint-disable-next-line no-console
        console.error(`Unknown command: ${command}. Use 'migrate', 'rollback', or 'status'`);
        process.exit(1);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Migration error:', err);
    process.exit(1);
  }
}

main();


