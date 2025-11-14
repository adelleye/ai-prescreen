export type MigrationStatus = {
  version: number;
  name: string;
};

export class MigrationRunner {
  // Minimal placeholder to satisfy TypeScript for build; real implementation can be added as needed.
  constructor(public migrationsDir: string) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async migrate(): Promise<void> {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async rollback(): Promise<void> {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async status(): Promise<{
    applied: MigrationStatus[];
    pending: MigrationStatus[];
  }> {
    return { applied: [], pending: [] };
  }
}
