import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const tokens = new SharedArray('jwt tokens', function () {
  return JSON.parse(open('./tokens.json'));
});

// Viral post scenario: huge spike in reads and comments on a single post
export const options = {
  scenarios: {
    viral_post: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 1000,
      maxVUs: 5000,
      stages: [
        { duration: '10s', target: 50 }, // warm up
        { duration: '30s', target: 1000 }, // sudden viral spike: 1000 req/sec
        { duration: '1m', target: 1000 }, // sustain
        { duration: '30s', target: 0 }, // drop off
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'], 
    http_req_failed: ['rate<0.05'], // Accept up to 5% failure in burst
  },
};

const BASE_URL = 'http://host.docker.internal:3001';
const VIRAL_POST_ID = '00000000-0000-0000-0000-000000000001'; // Mock ID, replace if necessary or let the script discover one.

export function setup() {
  // Let's dynamically find a post to go viral
  const token = tokens[0];
  const params = {
    headers: { Authorization: `Bearer ${token}` }
  };
  const res = http.get(`${BASE_URL}/feed?limit=5`, params);
  try {
    const feed = JSON.parse(res.body);
    if (feed && feed.length > 0) {
      return { viralPostId: feed[0].id };
    }
  } catch(e) {}
  return { viralPostId: null };
}

export default function (data) {
  if (!data.viralPostId) return; // Skip if no post found
  
  const token = tokens[__VU % tokens.length];
  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  // 1. Read the viral post
  let res = http.get(`${BASE_URL}/posts/${data.viralPostId}`, params);
  check(res, { 'read viral post': (r) => r.status === 200 });

  // 2. High chance to like
  if (Math.random() < 0.3) {
    res = http.post(`${BASE_URL}/posts/${data.viralPostId}/like`, '{}', params);
    check(res, { 'liked viral post': (r) => r.status === 201 || r.status === 200 });
  }

  // 3. Medium chance to comment
  if (Math.random() < 0.1) {
    const payload = JSON.stringify({ content: 'This is crazy! 🚀' });
    res = http.post(`${BASE_URL}/posts/${data.viralPostId}/comments`, payload, params);
    check(res, { 'commented on viral post': (r) => r.status === 201 });
  }
}
