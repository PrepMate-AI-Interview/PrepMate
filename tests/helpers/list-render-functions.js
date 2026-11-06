const fs = require('fs');

const js = fs.readFileSync('FE/features/report/report.js', 'utf8');

// Find all functions in report.js that start with render
const regex = /function\s+(render[A-Za-z0-9_]+)\s*\(([^)]*)\)/g;
let match;
console.log('--- ALL RENDER FUNCTIONS IN REPORT.JS ---');
while ((match = regex.exec(js)) !== null) {
    console.log(`${match[1]}(${match[2]})`);
}
