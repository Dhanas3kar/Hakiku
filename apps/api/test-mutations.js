const jwt = require('jsonwebtoken');
const { Client } = require('pg');

const API_BASE = 'http://localhost:3001';
const DB_URL = 'postgres://postgres:postgres@127.0.0.1:5433/srm_connect';

async function runTests() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  try {
    // 1. Get user 1 and user 2
    const res = await client.query(`SELECT id, email, role FROM users LIMIT 2`);
    if (res.rows.length < 2) {
      console.error('Need at least 2 users in the database for security testing!');
      process.exit(1);
    }

    const userA = res.rows[0];
    const userB = res.rows[1];
    console.log(`User A (Owner): ${userA.email} (${userA.id})`);
    console.log(`User B (Attacker): ${userB.email} (${userB.id})`);

    // 2. Generate JWTs
    const tokenA = jwt.sign(
      { sub: userA.id, email: userA.email, role: userA.role },
      'dev-secret-key-that-should-be-changed',
      { expiresIn: '15m' }
    );
    const tokenB = jwt.sign(
      { sub: userB.id, email: userB.email, role: userB.role },
      'dev-secret-key-that-should-be-changed',
      { expiresIn: '15m' }
    );

    const baseHeadersA = { 'Authorization': `Bearer ${tokenA}` };
    const jsonHeadersA = { ...baseHeadersA, 'Content-Type': 'application/json' };
    
    const baseHeadersB = { 'Authorization': `Bearer ${tokenB}` };

    // 3. Create Post
    console.log('\n--- CREATING POST ---');
    const postRes = await fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: jsonHeadersA,
      body: JSON.stringify({
        content: 'This is a test post for the mutation matrix.',
        postType: 'TEXT',
        visibility: 'PUBLIC'
      })
    });
    const post = await postRes.json();
    if (postRes.status !== 201) throw new Error(`Create post failed: ${JSON.stringify(post)}`);
    console.log('Post created successfully:', post.id);

    // 4. Like Post
    console.log('\n--- LIKING POST ---');
    const likeRes = await fetch(`${API_BASE}/posts/${post.id}/like`, {
      method: 'POST',
      headers: jsonHeadersA,
      body: JSON.stringify({})
    });
    if (likeRes.status !== 200 && likeRes.status !== 201) throw new Error(`Like post failed: ${likeRes.status}`);
    console.log('Post liked successfully');

    // 5. Create Comment
    console.log('\n--- CREATING COMMENT ---');
    const commentRes = await fetch(`${API_BASE}/posts/${post.id}/comments`, {
      method: 'POST',
      headers: jsonHeadersA,
      body: JSON.stringify({
        content: 'This is a test comment.'
      })
    });
    const comment = await commentRes.json();
    if (commentRes.status !== 201) throw new Error(`Create comment failed: ${JSON.stringify(comment)}`);
    console.log('Comment created successfully:', comment.id);

    // 6. Delete Comment (ATTEMPT BY USER B - SHOULD FAIL)
    console.log('\n--- ATTEMPTING UNAUTHORIZED COMMENT DELETION ---');
    const failDelCommentRes = await fetch(`${API_BASE}/posts/comments/${comment.id}`, {
      method: 'DELETE',
      headers: baseHeadersB
    });
    if (failDelCommentRes.status === 200) throw new Error(`SECURITY VULNERABILITY: User B successfully deleted User A's comment!`);
    console.log(`Unauthorized comment deletion properly rejected with status: ${failDelCommentRes.status}`);

    // 7. Delete Comment (AUTHORIZED BY USER A)
    console.log('\n--- DELETING COMMENT ---');
    const delCommentRes = await fetch(`${API_BASE}/posts/comments/${comment.id}`, {
      method: 'DELETE',
      headers: baseHeadersA
    });
    if (delCommentRes.status !== 200) throw new Error(`Delete comment failed: ${delCommentRes.status}`);
    console.log('Comment deleted successfully');

    // 8. Delete Post (ATTEMPT BY USER B - SHOULD FAIL)
    console.log('\n--- ATTEMPTING UNAUTHORIZED POST DELETION ---');
    const failDelPostRes = await fetch(`${API_BASE}/posts/${post.id}`, {
      method: 'DELETE',
      headers: baseHeadersB
    });
    if (failDelPostRes.status === 200) throw new Error(`SECURITY VULNERABILITY: User B successfully deleted User A's post!`);
    console.log(`Unauthorized post deletion properly rejected with status: ${failDelPostRes.status}`);

    // 9. Delete Post (AUTHORIZED BY USER A)
    console.log('\n--- DELETING POST ---');
    const delPostRes = await fetch(`${API_BASE}/posts/${post.id}`, {
      method: 'DELETE',
      headers: baseHeadersA
    });
    if (delPostRes.status !== 200) throw new Error(`Delete post failed: ${delPostRes.status}`);
    console.log('Post deleted successfully');

    console.log('\n✅ ALL TESTS PASSED SUCCESSFULLY');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
  } finally {
    await client.end();
  }
}

runTests();
