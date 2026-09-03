const { Client } = require('pg');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const apiRoot = path.resolve(__dirname, '..');
if (fs.existsSync(path.join(apiRoot, '.env'))) {
  dotenv.config({ path: path.join(apiRoot, '.env') });
}

const dbBaseUrl = 'postgres://postgres:postgres@127.0.0.1:5433/postgres';
const testDbUrl = 'postgres://postgres:postgres@127.0.0.1:5433/srm_connect_test';

async function ensureTestDatabase() {
  const client = new Client({ connectionString: dbBaseUrl });
  await client.connect();
  const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'srm_connect_test'");
  if (res.rowCount === 0) {
    await client.query('CREATE DATABASE srm_connect_test');
  }
  await client.end();
}

function runCommand(command, args, env, shell = false) {
  const result = spawnSync(command, args, {
    cwd: apiRoot,
    env,
    stdio: 'inherit',
    shell,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

(async () => {
  await ensureTestDatabase();

  const drizzleEnv = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testDbUrl,
    REDIS_URL: 'redis://127.0.0.1:6379',
  };

  if (process.platform === 'win32') {
    runCommand('npx', ['drizzle-kit', 'push', '--config=drizzle.config.ts'], drizzleEnv, true);
    runCommand('npx', ['tsx', 'scripts/qa-reset.ts'], drizzleEnv, true);
    runCommand('npx', ['tsx', 'scripts/provision-official.ts'], drizzleEnv, true);
  } else {
    runCommand('npx', ['drizzle-kit', 'push', '--config=drizzle.config.ts'], drizzleEnv, false);
    runCommand('npx', ['tsx', 'scripts/qa-reset.ts'], drizzleEnv, false);
    runCommand('npx', ['tsx', 'scripts/provision-official.ts'], drizzleEnv, false);
  }

  const jestEnv = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testDbUrl,
    REDIS_URL: 'redis://127.0.0.1:6379',
  };

  runCommand(
    process.execPath,
    [
      '--experimental-vm-modules',
      require.resolve('jest/bin/jest'),
      '--config',
      './test/jest-e2e.json',
      '--runInBand',
      '--forceExit',
    ],
    jestEnv,
  );
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
