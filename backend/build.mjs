// Makes backend/Code.gs from Code.template.gs with the same starting data as js/seed.js and the Client ID from js/config.js.
// Run from the repo folder:  node backend/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { seedData } from '../js/seed.js';
import { CONFIG } from '../js/config.js';
const tpl = readFileSync(new URL('./Code.template.gs', import.meta.url), 'utf8');
writeFileSync(new URL('./Code.gs', import.meta.url), tpl.replace('__SEED__', JSON.stringify(seedData())).replace('__CLIENT_ID__', CONFIG.CLIENT_ID || 'PASTE-THE-CLIENT-ID-HERE.apps.googleusercontent.com'));
console.log('backend/Code.gs written');
