import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// Load tokens from the provisioned file
const tokens = new SharedArray('jwt tokens', function () {
  return JSON.parse(open('./tokens.json'));
});

// Configure the load test execution
export const options = {
  scenarios: {
    steady_state: {
      executor: 'ramping-vus',
      startVUs: 100,
      stages: [
        { duration: '30s', target: 500 },
        { duration: '30s', target: 1000 },
        { duration: '30s', target: 2500 },
        { duration: '30s', target: 5000 },
        { duration: '30s', target: 7500 },
        { duration: '1m', target: 10000 },
        { duration: '2m', target: 10000 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate must be less than 1%
  },
};

const BASE_URL = 'http://host.docker.internal:3001';

export default function () {
  // Pick a random token based on the VU ID or random index
  const token = tokens[__VU % tokens.length];

  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  // 1. Fetch the user's profile
  let res = http.get(`${BASE_URL}/profile/me`, params);
  check(res, {
    'profile loaded successfully': (r) => r.status === 200,
  });
  sleep(1);

  // 2. Fetch the feed (simulates scrolling)
  res = http.get(`${BASE_URL}/feed?page=1&limit=20`, params);
  check(res, {
    'feed loaded successfully': (r) => r.status === 200,
  });
  
  // Parse feed to find a post to interact with occasionally
  let feedData = [];
  try {
    feedData = JSON.parse(res.body);
  } catch(e) {}

  sleep(Math.random() * 3 + 2); // Idle reading for 2-5 seconds

  // 3. Occasional actions (10% chance to like a post if available)
  if (Math.random() < 0.1 && feedData && feedData.length > 0) {
    const randomPost = feedData[Math.floor(Math.random() * feedData.length)];
    if (randomPost && randomPost.id) {
      res = http.post(`${BASE_URL}/posts/${randomPost.id}/like`, '{}', params);
      check(res, {
        'post liked successfully': (r) => r.status === 201 || r.status === 200,
      });
    }
  }

  // 4. Occasional profile view of another user (20% chance)
  if (Math.random() < 0.2 && feedData && feedData.length > 0) {
    const randomPost = feedData[Math.floor(Math.random() * feedData.length)];
    if (randomPost && randomPost.author && randomPost.author.username) {
      res = http.get(`${BASE_URL}/profile/${randomPost.author.username}`, params);
      check(res, {
        'author profile loaded': (r) => r.status === 200,
      });
    }
  }

  // Long sleep to simulate real user pacing between full page refreshes / app foregrounding
  sleep(Math.random() * 10 + 5);
}
