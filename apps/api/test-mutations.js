const jwt = require('jsonwebtoken');
const { Client } = require('pg');

const API_BASE = 'http://localhost:3001';
const DB_URL = 'postgres://postgres:postgres@127.0.0.1:5433/srm_connect';

async function runTests() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  try {
    // 1. Get user dm5245@srmist.edu.in
    const res = await client.query(`SELECT id, email, role FROM users WHERE email = 'dm5245@srmist.edu.in' LIMIT 1`);
    if (res.rows.length === 0) {
      console.error('Test user not found!');
      process.exit(1);
    }

    const user = res.rows[0];
    console.log(`Testing as User: ${user.email} (${user.id})`);

    // 2. Generate JWT
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      'dev-secret-key-that-should-be-changed',
      { expiresIn: '15m' }
    );

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 3. Create Post
    console.log('\n--- CREATING POST ---');
    const postRes = await fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers,
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
      headers
    });
    if (likeRes.status !== 200 && likeRes.status !== 201) throw new Error(`Like post failed: ${likeRes.status}`);
    console.log('Post liked successfully');

    // 5. Create Comment
    console.log('\n--- CREATING COMMENT ---');
    const commentRes = await fetch(`${API_BASE}/posts/${post.id}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: 'This is a test comment.'
      })
    });
    const comment = await commentRes.json();
    if (commentRes.status !== 201) throw new Error(`Create comment failed: ${JSON.stringify(comment)}`);
    console.log('Comment created successfully:', comment.id);

    // 6. Delete Comment
    console.log('\n--- DELETING COMMENT ---');
    const delCommentRes = await fetch(`${API_BASE}/posts/comments/${comment.id}`, {
      method: 'DELETE',
      headers
    });
    if (delCommentRes.status !== 200) throw new Error(`Delete comment failed: ${delCommentRes.status}`);
    console.log('Comment deleted successfully');

    // 7. Delete Post
    console.log('\n--- DELETING POST ---');
    const delPostRes = await fetch(`${API_BASE}/posts/${post.id}`, {
      method: 'DELETE',
      headers
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
