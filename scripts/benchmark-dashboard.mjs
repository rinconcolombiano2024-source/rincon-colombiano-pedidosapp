// Deterministic work counters plus local CPU sample; not a whole-app CPU benchmark.
import {readFileSync} from 'node:fs';
import {dashboardHarness} from '../tests/support/dashboard-harness.mjs';
const source=process.argv[2] ? readFileSync(process.argv[2],'utf8') : readFileSync('centro-integraciones-status.js','utf8');
const h=dashboardHarness(source),before=h.stats(),start=process.cpuUsage();
for(let i=0;i<100;i++)await h.load();
const cpu=process.cpuUsage(start),after=h.stats();
console.log(JSON.stringify({staticNodes:200,refreshes:100,translationCalls:after.translations-before.translations,textWrites:after.writes-before.writes,requests:after.requests-before.requests,cpuMicroseconds:cpu.user+cpu.system}));
