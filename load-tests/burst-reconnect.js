import { ws } from 'k6/ws';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const tokens = new SharedArray('jwt tokens', function () {
  return JSON.parse(open('./tokens.json'));
});

// Mass reconnect scenario: brief network drop causes everyone to reconnect to websockets
export const options = {
  scenarios: {
    mass_reconnect: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 5000 }, // sudden spike of 5000 concurrent reconnects in 10s
        { duration: '20s', target: 5000 }, // sustain
        { duration: '10s', target: 0 },
      ],
    },
  },
};

const WS_URL = 'ws://host.docker.internal:3001';

export default function () {
  const token = tokens[__VU % tokens.length];
  const url = `${WS_URL}/socket.io/?EIO=4&transport=websocket&auth=${token}`;

  const res = ws.connect(url, function (socket) {
    socket.on('open', function () {
      // successful connection
      sleep(5); // hold connection for a bit
      socket.close();
    });

    socket.on('error', function (e) {
      console.log('Socket Error:', e.error());
    });
  });

  check(res, { 'status is 101': (r) => r && r.status === 101 });
}
