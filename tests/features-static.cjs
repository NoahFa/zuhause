const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');

const read = relative => fs.readFileSync(path.resolve(__dirname, relative), 'utf8');
const html = read('../dist/index.html');
const app = read('../dist/app.js');
const features = read('../dist/features.js');
const css = read('../dist/features.css');
const schema = read('../supabase/schema.sql');

assert.match(html, /features\.css\?v=10/);
assert.match(html, /features\.js\?v=10/);
assert.match(html, /workspaces\.js\?v=10/);
assert.match(html, /workspaces\.css\?v=10/);
assert.ok(html.indexOf('app.js?v=10') < html.indexOf('features.js?v=10'), 'features.js muss nach app.js geladen werden');
assert.match(app, /dueOn/);
assert.match(app, /recurrenceInterval/);
assert.match(features, /284318/);
assert.match(features, /api\.open-meteo\.com/);
assert.match(features, /Kassenbon wird gelesen/);
assert.match(features, /Noahs Montagebereich/);
assert.match(features, /Charleens Bereich/);
assert.match(features, /Mehrseitig scannen/);
assert.match(features, /prepareScanImage/);
assert.match(features, /originalFiles: files/);
assert.match(features, /Aktueller Ordner und Kategorie/);
assert.match(features, /vollständige Ausrüstung anzeigen/);
assert.match(css, /@media\(max-width:780px\)/);
assert.match(schema, /create table if not exists public\.task_series/);
assert.match(schema, /create table if not exists public\.task_instances/);
assert.match(schema, /add column if not exists ocr_text/);

console.log('Zuhause-v10-Strukturtest bestanden.');
