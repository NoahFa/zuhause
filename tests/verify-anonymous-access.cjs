const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync((fs.existsSync(path.join(__dirname, '../dist/app.js')) ? path.join(__dirname, '../dist/app.js') : path.join(__dirname, '../app.js')), 'utf8');
const base = source.match(/const SUPABASE_URL='([^']+)'/)[1];
const key = source.match(/const SUPABASE_KEY='([^']+)'/)[1];
const tables = ['households','household_members','app_state','documents','calendars','calendar_events','event_participants','event_recurrences','event_exceptions','event_reminders','push_subscriptions','external_events','daily_content','task_series','task_instances'];
(async () => {
  const results = await Promise.all(tables.map(async table => {
    const response = await fetch(`${base}/rest/v1/${table}?select=*&limit=1`, { headers: { apikey: key } });
    const data = await response.json();
    return { table, status: response.status, rows: Array.isArray(data) ? data.length : 0, denied: response.status === 401 || response.status === 403 || (response.ok && Array.isArray(data) && data.length === 0) };
  }));
  console.log(JSON.stringify(results));
  if (results.some(result => !result.denied)) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
