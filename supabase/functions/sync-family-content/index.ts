import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

function sameSecret(left: string, right: string) {
  if (!left || left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

function authorizeCron(request: Request): Response | null {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }
  const configured = Deno.env.get('CRON_SECRET') || ''
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!configured || !sameSecret(supplied, configured)) {
    return new Response('Unauthorized', { status: 401 })
  }
  return null
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const wasteNames: Record<number, string> = { 0: 'Restmüll', 3: 'Biotonne', 4: 'Altpapier', 5: 'Gelbe Tonne' }
const wasteStreetId = Deno.env.get('WASTE_STREET_ID') || '284318'
const wasteSourceUrl = Deno.env.get('WASTE_SOURCE_URL') || 'https://www.bergischgladbach.de/abfuhrbezirksabfrage.aspx'
const footballTeamId = Deno.env.get('FOOTBALL_TEAM_ID') || '011MIFBN30000000VTVG0001VTR8C1K7'
const footballTeamName = Deno.env.get('FOOTBALL_TEAM_NAME') || 'SC 27'

function clean(value = '') {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#8203;/g, ' ').replace(/&amp;/g, '&').replace(/&ndash;|&mdash;/g, '–').replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü').replace(/&szlig;/g, 'ß').replace(/\s+/g, ' ').trim()
}

async function fetchWaste() {
  if (!wasteStreetId) throw new Error('WASTE_STREET_ID fehlt')
  const response = await fetch(`https://aw-bgl2-abfallapp.regioit.de/abfall-app-aw-bgl2/rest/strassen/${encodeURIComponent(wasteStreetId)}/termine`)
  if (!response.ok) throw new Error(`AWB antwortet mit ${response.status}`)
  const rows = await response.json()
  return rows.filter((row: any) => wasteNames[row.bezirk?.fraktionId]).map((row: any) => ({
    source: 'awb', external_id: String(row.id), event_date: row.datum, start_time: '06:00', title: wasteNames[row.bezirk.fraktionId], person: 'Gemeinsam', kind: 'waste', status: 'scheduled', note: 'Automatisch aktualisiert', source_url: wasteSourceUrl || null, metadata: { fraction_id: row.bezirk.fraktionId }, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }))
}

function germanDate(value: string) {
  const match = value.match(/(\d{2})\.(\d{2})\.(\d{4})/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : ''
}

async function fetchFootball() {
  if (!footballTeamId || !footballTeamName) throw new Error('FOOTBALL_TEAM_ID oder FOOTBALL_TEAM_NAME fehlt')
  const fromDate = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
  const untilDate = new Date(Date.now() + 240 * 86400000).toISOString().slice(0, 10)
  const url = `https://www.fussball.de/ajax.team.matchplan/-/datum-bis/${untilDate}/datum-von/${fromDate}/match-type/-1/mime-type/XML/show-venues/true/team-id/${encodeURIComponent(footballTeamId)}`
  const response = await fetch(url, { headers: { 'user-agent': 'Zuhause Familienkalender/1.0' } })
  if (!response.ok) throw new Error(`FUSSBALL.DE antwortet mit ${response.status}`)
  const html = await response.text()
  const pattern = /<tr class="row-headline visible-small">\s*<td[^>]*>(.*?)<\/td>[\s\S]*?<div class="club-name">\s*([\s\S]*?)\s*<\/div>[\s\S]*?<div class="club-name">\s*([\s\S]*?)\s*<\/div>[\s\S]*?<td class="column-score">[\s\S]*?<a href="([^"]+)"/g
  const events = []
  for (const match of html.matchAll(pattern)) {
    const headline = clean(match[1]), home = clean(match[2]), away = clean(match[3]), sourceUrl = match[4]
    const date = germanDate(headline), time = headline.match(/-\s*(\d{2}:\d{2})\s*Uhr/)?.[1] || null, competition = clean(headline.split('|')[1] || '')
    if (!date || (!home.includes(footballTeamName) && !away.includes(footballTeamName))) continue
    const externalId = sourceUrl.match(/\/spiel\/([^/]+)\/-\/spiel\/([^/?]+)/)?.[2] || sourceUrl
    const cancelled = /Ausfall|Absetzung|annulliert/i.test(headline)
    events.push({ source: 'fussball_de', external_id: externalId, event_date: date, start_time: time, title: `${home} – ${away}`, person: 'person1', kind: 'football', status: cancelled ? 'cancelled' : 'scheduled', note: competition, source_url: sourceUrl, metadata: { competition, home, away }, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  }
  if (!events.length) throw new Error('FUSSBALL.DE lieferte keine auswertbaren Spiele')
  return events
}

async function fetchGoodNews() {
  const response = await fetch('https://goodnews.eu/feed/', { headers: { 'user-agent': 'Zuhause Familienkalender/1.0' } })
  if (!response.ok) throw new Error(`Good News antwortet mit ${response.status}`)
  const xml = await response.text(), item = xml.match(/<item>([\s\S]*?)<\/item>/)?.[1]
  if (!item) throw new Error('Keine gute Nachricht gefunden')
  const title = clean(item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] || '')
  const link = clean(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '')
  const published = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]
  if (!title || !link) throw new Error('Gute Nachricht war unvollständig')
  return { headline: title, source_url: link, published_on: published ? new Date(published).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10) }
}

// ---- Hochschul-Kalender (Moodle-Export, ICS) für Charleen ----
// Der Link enthält einen persönlichen Schlüssel und liegt nur als Secret STUDY_CALENDAR_URL auf dem Server.
const studyCalendarUrl = Deno.env.get('STUDY_CALENDAR_URL') || ''
const studyHouseholdId = Deno.env.get('STUDY_HOUSEHOLD_ID') || ''

function icsText(value = '') { return value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim() }
function berlinDateTime(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/)
  if (!match) return null
  const utc = Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +(match[6] || 0))
  if (!match[7]) return { date: `${match[1]}-${match[2]}-${match[3]}`, time: `${match[4]}:${match[5]}`, ms: utc }
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(utc)).map(part => [part.type, part.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, ms: utc }
}
function minutesOf(time: string) { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute }

async function fetchStudy() {
  if (!studyCalendarUrl || !studyHouseholdId) throw new Error('STUDY_CALENDAR_URL oder STUDY_HOUSEHOLD_ID fehlt')
  const response = await fetch(studyCalendarUrl, { headers: { 'user-agent': 'Zuhause Familienkalender/1.0' } })
  if (!response.ok) throw new Error(`Hochschule antwortet mit ${response.status}`)
  const text = (await response.text()).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '')
  const blocks: any[] = []
  for (const chunk of text.split('BEGIN:VEVENT').slice(1)) {
    const field = (name: string) => chunk.match(new RegExp(`^${name}(?:;[^:\\n]*)?:(.*)$`, 'm'))?.[1] || ''
    if (/^STATUS:CANCELLED/m.test(chunk)) continue
    const start = berlinDateTime(field('DTSTART').trim()), end = berlinDateTime(field('DTEND').trim())
    const title = icsText(field('SUMMARY')).replace(/\s*-\s*dual\s*$/i, '').slice(0, 150)
    if (!start || !title) continue
    const description = icsText(field('DESCRIPTION'))
    blocks.push({ title, date: start.date, start: start.time, end: end && end.date === start.date ? end.time : start.time, ms: start.ms, category: icsText(field('CATEGORIES')), location: icsText(field('LOCATION')), online: /^online/i.test(description), link: description.match(/https:\/\/[^\s\]>)]+/)?.[0] || null })
  }
  blocks.sort((a, b) => a.ms - b.ms)
  // Aufeinanderfolgende Blöcke desselben Fachs am selben Tag zu einem Termin zusammenfassen.
  const merged: any[] = []
  for (const block of blocks) {
    const last = merged[merged.length - 1]
    if (last && last.date === block.date && last.title === block.title && minutesOf(block.start) - minutesOf(last.end) <= 90) { last.end = block.end; last.blocks.push(`${block.start}–${block.end}`); last.link ||= block.link; continue }
    merged.push({ ...block, blocks: [`${block.start}–${block.end}`] })
  }
  const now = new Date().toISOString()
  return merged.map(item => ({
    source: 'hochschule', external_id: `${item.date}:${item.start}:${item.title}`.slice(0, 200), event_date: item.date, start_time: item.start,
    title: `🎓 ${item.title}`, person: 'person2', kind: 'study', status: 'scheduled',
    note: [item.online ? 'Online' : item.location, item.blocks.length > 1 ? `Blöcke: ${item.blocks.join(' · ')}` : ''].filter(Boolean).join(' · ') || null,
    source_url: item.link, metadata: { end_time: item.end, blocks: item.blocks, category: item.category }, last_seen_at: now, updated_at: now,
  }))
}

async function log(source: string, status: 'ok' | 'error', itemCount: number, message?: string) {
  await supabase.from('sync_runs').insert({ source, status, item_count: itemCount, message: message?.slice(0, 500) })
}

Deno.serve(async request => {
  const unauthorized = authorizeCron(request)
  if (unauthorized) return unauthorized
  const requested = new Set((new URL(request.url).searchParams.get('jobs') || 'waste,football,good_news').split(','))
  const results: Record<string, unknown> = {}
  const { data: households, error: householdError } = await supabase.from('households').select('id')
  if (householdError) return new Response(householdError.message, { status: 500 })
  for (const job of [{ name: 'waste', run: fetchWaste }, { name: 'football', run: fetchFootball }]) {
    if (!requested.has(job.name)) continue
    try {
      const items = await job.run()
      for (const household of households || []) await supabase.from('external_events').upsert(items.map((item: any) => ({ ...item, household_id: household.id })), { onConflict: 'household_id,source,external_id' })
      await log(job.name, 'ok', items.length); results[job.name] = items.length
    } catch (error) { await log(job.name, 'error', 0, String(error)); results[job.name] = String(error) }
  }
  if (requested.has('study')) try {
    const runStarted = new Date().toISOString(), today = new Date().toISOString().slice(0, 10)
    const items = await fetchStudy()
    if (items.length) {
      const { error } = await supabase.from('external_events').upsert(items.map((item: any) => ({ ...item, household_id: studyHouseholdId })), { onConflict: 'household_id,source,external_id' })
      if (error) throw error
      // Termine, die in der Hochschule entfallen sind, ab heute wieder entfernen.
      await supabase.from('external_events').delete().eq('household_id', studyHouseholdId).eq('source', 'hochschule').gte('event_date', today).lt('last_seen_at', runStarted)
    }
    await log('study', 'ok', items.length); results.study = items.length
  } catch (error) { await log('study', 'error', 0, String(error)); results.study = String(error) }
  if (requested.has('good_news')) try {
    const news = await fetchGoodNews(), contentDate = new Date().toISOString().slice(0, 10)
    for (const household of households || []) await supabase.from('daily_content').upsert({ household_id: household.id, content_date: contentDate, source_name: 'Good News', fetched_at: new Date().toISOString(), ...news }, { onConflict: 'household_id,content_date' })
    await log('good_news', 'ok', 1); results.good_news = news.headline
  } catch (error) { await log('good_news', 'error', 0, String(error)); results.good_news = String(error) }
  return Response.json(results)
})
