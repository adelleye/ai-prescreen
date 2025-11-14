const config = {
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    headless: true,
    actionTimeout: 10_000,
    navigationTimeout: 10_000,
  },
  reporter: [['list']],
} as const;

export default config;
