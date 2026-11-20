import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import webpush from 'npm:web-push@3.6.7'

// Morgen-Nachricht um 5 Uhr (Berlin): Termine, Hochschule, Müll, Fußball, Geburtstage, Montageaufträge (Noah), Prüfungen und Caritas-To-dos (Charleen), Lous fällige Pflege und offene Aufgaben des Tages.
// Wird per Cron um 03:02 und 04:02 UTC aufgerufen; gesendet wird nur, wenn es in Berlin 5 Uhr ist (Sommer-/Winterzeit).
// ?force=1 sendet unabhängig von der Uhrzeit, ?dry=1 zeigt nur den Text, ohne zu senden (mit &date=JJJJ-MM-TT für einen anderen Tag).

function sameSecret(left: string, right: string) {
  if (!left || left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}
function authorizeCron(request: Request): Response | null {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  const configured = Deno.env.get('CRON_SECRET') || ''
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!configured || !sameSecret(supplied, configured)) return new Response('Unauthorized', { status: 401 })
  return null
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
webpush.setVapidDetails('mailto:app@zuhause-familienapp.pages.dev', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)
const DAY_MS = 86400000

function berlinParts(date: Date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(part => [part.type, part.value])) as Record<string, string>
}
function addDays(value: string, amount: number) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10) }
function daysBetween(a: string, b: string) { return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / DAY_MS) }
function weekday(value: string) { return new Date(`${value}T12:00:00Z`).getUTCDay() || 7 }

function repeatsOn(event: any, recurrence: any, candidate: string) {
  if (!recurrence) return event.start_date <= candidate && candidate <= (event.end_date || event.start_date)
  if (candidate < event.start_date || (recurrence.ends_on && candidate > recurrence.ends_on)) return false
  const interval = Math.max(1, Number(recurrence.interval_count || 1)), delta = daysBetween(event.start_date, candidate)
  if (recurrence.frequency === 'daily') return delta % interval === 0
  if (recurrence.frequency === 'weekly') {
    const weeks = Math.floor(daysBetween(addDays(event.start_date, 1 - weekday(event.start_date)), addDays(candidate, 1 - weekday(candidate))) / 7)
    const weekdays = recurrence.weekdays?.length ? recurrence.weekdays : [weekday(event.start_date)]
    return weeks >= 0 && weeks % interval === 0 && weekdays.includes(weekday(candidate))
  }
  const start = new Date(`${event.start_date}T12:00:00Z`), current = new Date(`${candidate}T12:00:00Z`)
  if (recurrence.frequency === 'monthly') {
    const months = (current.getUTCFullYear() - start.getUTCFullYear()) * 12 + current.getUTCMonth() - start.getUTCMonth()
    // Monatlich am 31. → in kürzeren Monaten am Monatsletzten (wie in der App).
    const lastDay = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0)).getUTCDate()
    return months >= 0 && months % interval === 0 && current.getUTCDate() === Math.min(Number(recurrence.month_day || start.getUTCDate()), lastDay)
  }
  if (recurrence.frequency !== 'yearly' || (current.getUTCFullYear() - start.getUTCFullYear()) % interval !== 0 || current.getUTCMonth() !== start.getUTCMonth()) return false
  const leapFallback = start.getUTCMonth() === 1 && start.getUTCDate() === 29 && new Date(Date.UTC(current.getUTCFullYear(), 1, 29)).getUTCMonth() !== 1
  return current.getUTCDate() === (leapFallback ? 28 : start.getUTCDate())
}

const time = (value: string | null) => String(value || '').slice(0, 5)

// Wetter des Tages für Bergisch Gladbach (dieselbe Quelle wie die Wetterkarte in der App). Fehlt es, kommt die Nachricht trotzdem.
const WEATHER: Record<number, [string, string]> = { 0: ['☀️', 'sonnig'], 1: ['🌤', 'überwiegend sonnig'], 2: ['⛅', 'teils bewölkt'], 3: ['☁️', 'bewölkt'], 45: ['🌫', 'neblig'], 48: ['🌫', 'neblig mit Reif'], 51: ['🌦', 'leichter Niesel'], 53: ['🌦', 'Niesel'], 55: ['🌧', 'starker Niesel'], 56: ['🌧', 'gefrierender Niesel'], 57: ['🌧', 'gefrierender Niesel'], 61: ['🌦', 'leichter Regen'], 63: ['🌧', 'Regen'], 65: ['🌧', 'starker Regen'], 66: ['🌧', 'gefrierender Regen – Glätte'], 67: ['🌧', 'gefrierender Regen – Glätte'], 71: ['🌨', 'leichter Schnee'], 73: ['🌨', 'Schnee'], 75: ['❄️', 'starker Schnee'], 77: ['🌨', 'Schneegriesel'], 80: ['🌦', 'Regenschauer'], 81: ['🌧', 'Regenschauer'], 82: ['⛈', 'heftige Schauer'], 85: ['🌨', 'Schneeschauer'], 86: ['🌨', 'starke Schneeschauer'], 95: ['⛈', 'Gewitter'], 96: ['⛈', 'Gewitter mit Hagel'], 99: ['⛈', 'Gewitter mit Hagel'] }
async function weatherLine(): Promise<string> {
  try {
    const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=50.9856&longitude=7.13298&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FBerlin&forecast_days=1', { signal: AbortSignal.timeout(8000) })
    if (!response.ok) return ''
    const daily = (await response.json())?.daily
    const code = Number(daily?.weather_code?.[0]), min = Math.round(daily?.temperature_2m_min?.[0]), max = Math.round(daily?.temperature_2m_max?.[0]), rain = Number(daily?.precipitation_probability_max?.[0])
    if (!Number.isFinite(min) || !Number.isFinite(max)) return ''
    const [icon, text] = WEATHER[code] || ['🌡', '']
    return `${icon} ${min}–${max} °C${text ? `, ${text}` : ''}${Number.isFinite(rain) && rain >= 30 && !/regen|schauer|niesel|gewitter|schnee/i.test(text) ? `, Regen möglich (${rain} %)` : ''}`
  } catch { return '' }
}

Deno.serve(async request => {
  const unauthorized = authorizeCron(request)
  if (unauthorized) return unauthorized
  const params = new URL(request.url).searchParams, force = params.get('force') === '1', dry = params.get('dry') === '1'
  const now = new Date(), local = berlinParts(now), requestedDate = params.get('date')
  const today = dry && requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : `${local.year}-${local.month}-${local.day}`
  if (!force && !dry && Number(local.hour) !== 5) return Response.json({ skipped: true, reason: 'Außerhalb von 5 Uhr (Berlin)' })

  const [members, subscriptions, events, recurrences, exceptions, participants, calendars, external, states] = await Promise.all([
    supabase.from('household_members').select('household_id,user_id,display_name,role'),
    supabase.from('push_subscriptions').select('id,household_id,user_id,endpoint,p256dh,auth_key').eq('enabled', true),
    supabase.from('calendar_events').select('id,household_id,calendar_id,title,all_day,start_date,end_date,start_time,end_time').lte('start_date', today),
    supabase.from('event_recurrences').select('event_id,frequency,interval_count,weekdays,month_day,ends_on'),
    supabase.from('event_exceptions').select('series_event_id,occurrence_date,action'),
    supabase.from('event_participants').select('event_id,user_id'),
    supabase.from('calendars').select('id,calendar_key'),
    supabase.from('external_events').select('household_id,title,person,kind,status,event_date,start_time,metadata').eq('event_date', today),
    supabase.from('app_state').select('household_id,data'),
  ])
  const failed = [members, subscriptions, events, recurrences, exceptions, participants, calendars, external, states].find(result => result.error)
  if (failed) return new Response(failed.error!.message, { status: 500 })

  const recurrenceById = new Map((recurrences.data || []).map((row: any) => [row.event_id, row]))
  const skipped = new Set((exceptions.data || []).filter((row: any) => row.action === 'skip' || row.action === 'replace').map((row: any) => `${row.series_event_id}:${row.occurrence_date}`))
  const calendarKey = new Map((calendars.data || []).map((row: any) => [row.id, row.calendar_key]))
  const participantsByEvent = new Map<string, Set<string>>()
  for (const row of participants.data || []) { if (!participantsByEvent.has(row.event_id)) participantsByEvent.set(row.event_id, new Set()); participantsByEvent.get(row.event_id)!.add(row.user_id) }
  const stateByHousehold = new Map((states.data || []).map((row: any) => [row.household_id, row.data || {}]))

  let sent = 0
  const previews: any[] = []
  const weather = await weatherLine()
  for (const member of members.data || []) {
    const personKey = member.role === 'owner' ? 'person1' : 'person2'
    const items: { sort: string; text: string }[] = []
    for (const event of events.data || []) {
      if (event.household_id !== member.household_id) continue
      const recurrence = recurrenceById.get(event.id)
      if (!repeatsOn(event, recurrence, today) || skipped.has(`${event.id}:${today}`)) continue
      const key = calendarKey.get(event.calendar_id) || 'shared', people = participantsByEvent.get(event.id)
      if (key !== 'shared' && key !== personKey && !people?.has(member.user_id)) continue
      if (String(event.title).startsWith('🎂') && recurrence?.frequency === 'yearly') {
        const age = Number(today.slice(0, 4)) - Number(event.start_date.slice(0, 4))
        items.push({ sort: '00:00', text: age >= 1 ? `${event.title} wird ${age}` : event.title }); continue
      }
      items.push({ sort: event.all_day ? '00:01' : time(event.start_time), text: event.all_day ? `📅 ${event.title} (ganztägig)` : `📅 ${time(event.start_time)} ${event.title}` })
    }
    const waste: string[] = []
    for (const row of external.data || []) {
      if (row.household_id !== member.household_id || row.status === 'cancelled') continue
      if (row.kind === 'waste') { waste.push(row.title); continue }
      if (row.person && row.person !== 'Gemeinsam' && row.person !== personKey) continue
      const end = row.metadata?.end_time ? `–${row.metadata.end_time}` : ''
      items.push({ sort: time(row.start_time) || '00:02', text: row.kind === 'football' ? `⚽ ${time(row.start_time)} ${row.title}` : `${row.title} ${time(row.start_time)}${end}`.trim() })
    }
    if (waste.length) items.push({ sort: '00:03', text: `🗑 Heute Abholung: ${waste.join(', ')}` })
    const tasks = (stateByHousehold.get(member.household_id)?.householdTasks || []).filter((task: any) => !task.done && !task.skipped && task.dueOn && task.dueOn <= today && (!task.person || task.person === 'Gemeinsam' || task.person === personKey))
    if (tasks.length) {
      const overdue = tasks.filter((task: any) => task.dueOn < today).length
      items.push({ sort: '99:99', text: tasks.length === 1 ? `✓ Aufgabe: ${tasks[0].title}${overdue ? ' (überfällig)' : ''}` : `✓ ${tasks.length} Aufgaben offen${overdue ? ` (${overdue} überfällig)` : ''}` })
    }
    if (personKey === 'person1') for (const job of stateByHousehold.get(member.household_id)?.montageJobs || []) {
      if (job?.date === today && job.status !== 'done') items.push({ sort: '00:04', text: `🔧 Montage: ${job.title}${job.status === 'ready' ? ' (vorbereitet)' : ''}` })
    }
    if (personKey === 'person2') {
      const charleen = stateByHousehold.get(member.household_id)?.charleen || {}
      const inDays = (n: number) => addDays(today, n)
      for (const module of charleen.modules || []) for (const exam of module.exams || []) {
        if (!exam?.date || (exam.status && exam.status !== 'open')) continue
        const label = `${module.name} – ${exam.type}`
        if (exam.date === today) items.push({ sort: '00:05', text: `📝 Heute: ${label}` })
        else if (exam.date === inDays(1)) items.push({ sort: '00:06', text: `📝 Morgen: ${label}` })
        else if (exam.date === inDays(7)) items.push({ sort: '00:07', text: `📝 In einer Woche: ${label}` })
      }
      const work = (charleen.work || []).filter((todo: any) => !todo.done && todo.dueOn && todo.dueOn <= today)
      if (work.length) items.push({ sort: '99:97', text: work.length === 1 ? `🤝 Caritas: ${work[0].title}` : `🤝 Caritas: ${work.length} To-dos fällig` })
    }
    for (const care of stateByHousehold.get(member.household_id)?.lou?.care || []) {
      if (care?.nextDue && care.nextDue <= today) items.push({ sort: '99:98', text: `🐾 Lou: ${care.title}${care.nextDue < today ? ' (überfällig)' : ' ist heute dran'}` })
    }
    // Nachricht kommt jeden Morgen (Wunsch Noah, 18.11.2026): mit Wetter, an leeren Tagen „Heute steht nichts an.“
    items.sort((a, b) => a.sort.localeCompare(b.sort))
    const lines = [...(weather ? [weather] : []), ...items.slice(0, 5).map(item => item.text)]
    if (items.length > 5) lines.push(`… und ${items.length - 5} weitere`)
    if (!items.length) lines.push('Heute steht nichts an.')
    const message = { title: `Guten Morgen, ${member.display_name || ''}!`.replace(', !', '!'), body: lines.join('\n'), tag: `morning:${today}`, url: './?page=today' }
    if (dry) { previews.push({ name: member.display_name, ...message }); continue }
    for (const subscription of (subscriptions.data || []).filter((row: any) => row.user_id === member.user_id && row.household_id === member.household_id)) {
      const reminderKey = `morning:${today}`
      const { data: prior } = await supabase.from('notification_deliveries').select('id').eq('subscription_id', subscription.id).eq('reminder_key', reminderKey).maybeSingle()
      if (prior) continue
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } }, JSON.stringify(message), { urgency: 'high', TTL: 21600 })
        await supabase.from('notification_deliveries').insert({ household_id: member.household_id, subscription_id: subscription.id, reminder_key: reminderKey, event_date: today })
        sent += 1
      } catch (pushError: any) {
        if ([404, 410].includes(pushError?.statusCode)) await supabase.from('push_subscriptions').update({ enabled: false, updated_at: new Date().toISOString() }).eq('id', subscription.id)
      }
    }
  }
  return Response.json(dry ? { today, previews } : { sent, today })
})
