import http from 'k6/http';
import { check, sleep } from 'k6';

// Login burst: simulate a sudden influx of users sending OTP requests (e.g. at the start of a semester)
export const options = {
  scenarios: {
    login_burst: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 500,
      maxVUs: 2000,
      stages: [
        { duration: '10s', target: 10 }, 
        { duration: '30s', target: 500 }, // 500 logins per sec
        { duration: '30s', target: 500 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'], // Login operations can be slightly slower
  },
};

const BASE_URL = 'http://host.docker.internal:3001';

export default function () {
  const email = `testuser_${__VU}_${Math.floor(Math.random() * 10000)}@srmist.edu.in`;
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const payload = JSON.stringify({ email });

  const res = http.post(`${BASE_URL}/auth/send-otp`, payload, params);
  
  // Note: we're only hitting send-otp because checking the actual OTP requires reading from a database/file 
  // which is complicated for 500 req/sec in this mocked environment. 
  // Hitting send-otp simulates the rate-limiting and email-sending bottleneck.
  check(res, {
    'otp sent': (r) => r.status === 200 || r.status === 429, // 429 is rate limit (which is good if it triggers!)
  });
}
