const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const zipPath = path.join(__dirname, '../test-results/post-lifecycle-2-POST-LIFE-9ab0b-eate-edit-and-delete-a-post-chromium/trace.zip');
const zip = new AdmZip(zipPath);
const zipEntries = zip.getEntries();

let traceData = '';
zipEntries.forEach((zipEntry) => {
    if (zipEntry.entryName === 'trace.trace') {
        traceData = zip.readAsText(zipEntry);
    }
});

const lines = traceData.split('\n');
for (const line of lines) {
    if (!line.trim()) continue;
    try {
        const t = JSON.parse(line);
        if (t.type === 'resource-snapshot') {
            const req = t.snapshot.request;
            const res = t.snapshot.response;
            if (req.url.includes('/posts')) {
                console.log(`${req.method} ${req.url} - ${res.status}`);
                if (req.method === 'PATCH') {
                    console.log('PATCH response headers:', res.headers);
                    console.log('PATCH postData:', req.postData);
                }
            }
        }
    } catch (e) { }
}
