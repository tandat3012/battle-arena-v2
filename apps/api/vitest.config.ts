import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test' },
    fileParallelism: false, // tất cả test dùng chung 1 Redis test instance
    testTimeout: 15000,
  },
});
