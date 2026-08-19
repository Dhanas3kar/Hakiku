import { db } from './src/db';
import { users, profiles } from './src/db/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

const QA_USERS = [
  {
    email: 'qa_user_a@srmist.edu.in',
    studentId: 'RA2011000000QAA',
    username: 'qa_user_a',
    displayName: 'QA User A',
    batchYear: 2020,
    graduationYear: 2024,
  },
  {
    email: 'qa_user_b@srmist.edu.in',
    studentId: 'RA2011000000QAB',
    username: 'qa_user_b',
    displayName: 'QA User B',
    batchYear: 2021,
    graduationYear: 2025,
  },
  {
    email: 'qa_user_c@srmist.edu.in',
    studentId: 'RA2011000000QAC',
    username: 'qa_user_c',
    displayName: 'QA User C',
    batchYear: 2022,
    graduationYear: 2026,
  }
];

async function seed() {
  console.log('Seeding QA Users...');
  for (const user of QA_USERS) {
    let dbUser = await db.query.users.findFirst({
      where: eq(users.email, user.email)
    });

    if (!dbUser) {
      const [newUser] = await db.insert(users).values({
        email: user.email,
        studentId: user.studentId,
        isVerified: true,
      }).returning();
      dbUser = newUser;
      console.log(`Created user ${user.email}`);
    }

    const dbProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, dbUser.id)
    });

    if (!dbProfile) {
      await db.insert(profiles).values({
        userId: dbUser.id,
        username: user.username,
        displayName: user.displayName,
        campus: 'KTR',
        department: 'Computer Science',
        degreeProgram: 'B.Tech',
        batchYear: user.batchYear,
        graduationYear: user.graduationYear,
        isProfileCompleted: true,
        completionPercentage: 100,
      });
      console.log(`Created profile for ${user.username}`);
    }
  }
  console.log('QA Seeding Complete.');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
