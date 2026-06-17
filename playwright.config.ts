import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // ... your existing configuration (testDir, retries, reporters, etc.)
  
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // This bypasses the barebones open-source Chromium binary 
        // and uses the host machine's licensed Google Chrome build instead.
        channel: 'chrome', 
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});