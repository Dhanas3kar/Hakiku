import * as fs from 'fs';

const logFile = 'C:\\Users\\Dhanasekar Murugesan\\.gemini\\antigravity-ide\\brain\\0c4b6639-9972-42b3-bddd-a4f4d99fecdd\\.system_generated\\tasks\\task-9410.log';
const emailArg = process.argv[2];

try {
  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.split('\n');
  let otp = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(/\[MOCK EMAIL\] To: (.*?) - Your SRM Connect OTP is: (\d{6})/);
    if (match) {
      if (emailArg && match[1] !== emailArg) continue;
      otp = match[2];
      break;
    }
  }
  console.log(otp ? otp : "OTP_NOT_FOUND");
} catch (e) {
  console.log("OTP_NOT_FOUND (Error reading log)");
}
