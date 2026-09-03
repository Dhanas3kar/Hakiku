import postgres from 'postgres'
import * as dotenv from 'dotenv'
import * as path from 'node:path'

dotenv.config({
  path: path.resolve(__dirname, '../.env'),
})

const DATABASE_URL = process.env.DATABASE_URL
const EXPECTED_DEV_DATABASE = 'srm_connect'

function assertSafeDevDatabase(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error(
      '[dev-reset] DATABASE_URL is not configured. Refusing to reset any database.',
    )
  }

  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error(`[dev-reset] Invalid DATABASE_URL: ${databaseUrl}`)
  }

  const databaseName = parsed.pathname.replace(/^\/+/, '')

  if (databaseName !== EXPECTED_DEV_DATABASE) {
    throw new Error(
      [
        '[dev-reset] REFUSING DESTRUCTIVE OPERATION.',
        `Expected database: ${EXPECTED_DEV_DATABASE}`,
        `Received database: ${databaseName || '<none>'}`,
      ].join('\n'),
    )
  }

  const allowedHosts = new Set(['127.0.0.1', 'localhost'])
  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error(
      [
        '[dev-reset] REFUSING DESTRUCTIVE OPERATION.',
        `Development database must be local.`,
        `Received host: ${parsed.hostname}`,
      ].join('\n'),
    )
  }

  return databaseUrl
}

async function resetDevDatabase(): Promise<void> {
  const databaseUrl = assertSafeDevDatabase(DATABASE_URL)

  console.log('[dev-reset] ----------------------------------------')
  console.log('[dev-reset] Development database reset')
  console.log('[dev-reset] ----------------------------------------')
  console.log(`[dev-reset] Database: ${EXPECTED_DEV_DATABASE}`)
  console.log('[dev-reset] Host: localhost')
  console.log('[dev-reset] Operation: TRUNCATE ... CASCADE')
  console.log('[dev-reset] ----------------------------------------')

  const sql = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 10,
  })

  try {
    const result = await sql<{ database: string }[]>`
      SELECT current_database() AS database
    `

    const actualDatabase = result[0]?.database

    if (actualDatabase !== EXPECTED_DEV_DATABASE) {
      throw new Error(
        `[dev-reset] Database verification failed. ` +
        `Expected "${EXPECTED_DEV_DATABASE}", ` +
        `got "${actualDatabase ?? '<unknown>'}".`,
      )
    }

    console.log('[dev-reset] Database identity verified.')

    await sql.begin(async (transaction) => {
      // Safely delete generated QA accounts.
      // This implicitly cascades to all their data (posts, confessions, etc.) due to foreign keys.
      // Legitimate developer accounts are preserved.
      await transaction.unsafe(`
        DELETE FROM users
        WHERE email LIKE 'qa_%'
           OR email LIKE 'test_lockout_%'
           OR email LIKE 'bench_%'
           OR email LIKE 'connectx@gmail.com'
           OR id IN (
             SELECT user_id FROM profiles 
             WHERE username LIKE 'qa_user_%'
                OR username LIKE 'qa_onboard_%'
                OR username LIKE 'qa_resp_%'
                OR username LIKE 'qa_%'
                OR username LIKE 'bench_%'
                OR username LIKE 'connectx'
           )
      `)
    })

    console.log('[dev-reset] Development data successfully cleared.')
    console.log('[dev-reset] Database schema preserved.')
    console.log('[dev-reset] Sequences restarted.')
    console.log('[dev-reset] ----------------------------------------')
    console.log('[dev-reset] RESET COMPLETE')
    console.log('[dev-reset] ----------------------------------------')
  } finally {
    await sql.end({ timeout: 5 })
  }
}

resetDevDatabase().catch((error: unknown) => {
  console.error('[dev-reset] RESET FAILED')

  if (error instanceof Error) {
    console.error(error.message)
  } else {
    console.error(error)
  }

  process.exitCode = 1
})
