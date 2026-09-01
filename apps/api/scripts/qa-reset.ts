import postgres from 'postgres'
import * as dotenv from 'dotenv'
import * as path from 'node:path'

// Load test environment only if DATABASE_URL has not already been
// explicitly configured as a test database.
const configuredUrl = process.env.DATABASE_URL

if (!configuredUrl || !configuredUrl.includes('_test')) {
  dotenv.config({
    path: path.resolve(__dirname, '../.env.test'),
  })
}

const DATABASE_URL = process.env.DATABASE_URL

/**
 * Expected isolated E2E database.
 *
 * This script is destructive by design.
 * It must NEVER be allowed to operate on the development/production DB.
 */
const EXPECTED_TEST_DATABASE = 'srm_connect_test'

function assertSafeTestDatabase(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error(
      '[qa-reset] DATABASE_URL is not configured. Refusing to reset any database.',
    )
  }

  let parsed: URL

  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error(
      `[qa-reset] Invalid DATABASE_URL: ${databaseUrl}`,
    )
  }

  const databaseName = parsed.pathname.replace(/^\/+/, '')

  // Fail closed: only the canonical test database is allowed.
  if (databaseName !== EXPECTED_TEST_DATABASE) {
    throw new Error(
      [
        '[qa-reset] REFUSING DESTRUCTIVE OPERATION.',
        `Expected database: ${EXPECTED_TEST_DATABASE}`,
        `Received database: ${databaseName || '<none>'}`,
      ].join('\n'),
    )
  }

  // Additional protection against accidentally targeting a remote
  // database with a misleading database name.
  const allowedHosts = new Set([
    '127.0.0.1',
    'localhost',
  ])

  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error(
      [
        '[qa-reset] REFUSING DESTRUCTIVE OPERATION.',
        `Test database must be local.`,
        `Received host: ${parsed.hostname}`,
      ].join('\n'),
    )
  }

  return databaseUrl
}

async function resetTestDatabase(): Promise<void> {
  const databaseUrl = assertSafeTestDatabase(DATABASE_URL)

  console.log('[qa-reset] ----------------------------------------')
  console.log('[qa-reset] Test database reset')
  console.log('[qa-reset] ----------------------------------------')
  console.log(`[qa-reset] Database: ${EXPECTED_TEST_DATABASE}`)
  console.log('[qa-reset] Host: localhost')
  console.log('[qa-reset] Operation: TRUNCATE ... CASCADE')
  console.log('[qa-reset] ----------------------------------------')

  const sql = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 10,
  })

  try {
    // Verify the connection and the actual database before performing
    // any destructive operation.
    const result = await sql<{ database: string }[]>`
      SELECT current_database() AS database
    `

    const actualDatabase = result[0]?.database

    if (actualDatabase !== EXPECTED_TEST_DATABASE) {
      throw new Error(
        `[qa-reset] Database verification failed. ` +
        `Expected "${EXPECTED_TEST_DATABASE}", ` +
        `got "${actualDatabase ?? '<unknown>'}".`,
      )
    }

    console.log('[qa-reset] Database identity verified.')

    /*
     * users is the root entity for the majority of application data.
     *
     * CASCADE removes rows from dependent tables such as:
     * profiles
     * follows
     * connections
     * connection_requests
     * blocks
     * posts
     * comments
     * likes
     * notifications
     * messages
     * conversations
     * auth_sessions
     * audit_logs
     * etc.
     *
     * RESTART IDENTITY resets sequences while preserving:
     * schema
     * tables
     * indexes
     * constraints
     * enums
     * migrations
     */
    await sql.begin(async (transaction) => {
      await transaction.unsafe(`
        TRUNCATE TABLE users
        RESTART IDENTITY
        CASCADE
      `)

      /*
       * These tables may not necessarily be reachable through users
       * depending on the current schema/FK topology, so explicitly
       * clear them as well.
       *
       * CASCADE is intentional because these are test-only databases.
       */
      await transaction.unsafe(`
        TRUNCATE TABLE
          confessions,
          polls,
          community_reports,
          admin_credentials
        RESTART IDENTITY
        CASCADE
      `)
    })

    console.log('[qa-reset] Test data successfully cleared.')
    console.log('[qa-reset] Database schema preserved.')
    console.log('[qa-reset] Sequences restarted.')
    console.log('[qa-reset] ----------------------------------------')
    console.log('[qa-reset] RESET COMPLETE')
    console.log('[qa-reset] ----------------------------------------')
  } finally {
    await sql.end({ timeout: 5 })
  }
}

resetTestDatabase().catch((error: unknown) => {
  console.error('[qa-reset] RESET FAILED')

  if (error instanceof Error) {
    console.error(error.message)
  } else {
    console.error(error)
  }

  process.exitCode = 1
})