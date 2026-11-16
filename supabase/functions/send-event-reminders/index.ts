import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { authorizeCron } from '../_shared/cron-auth.ts'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
webpush.setVapidDetails('mailto:app@zuhause-familienapp.pages.dev', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)
const DAY_MS = 86400000

function berlinParts(date: Date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(part => [part.type, part.value])) as Record<string, string>
}
function isoDate(date: Date) { return date.toISOString().slice(0, 10) }
function addDays(value: string, amount: number) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return isoDate(date) }
function daysBetween(a: string, b: string) { return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / DAY_MS) }
function weekday(value: string) { const day = new Date(`${value}T12:00:00Z`).getUTCDay(); return day || 7 }

// Wandelt eine Berliner Wandzeit ohne Abhaengigkeit von der Server-Zeitzone in UTC um.
function berlinWallTime(date: string, hour: number, minute: number) {
  const [year, month, day] = date.split('-').map(Number)
  const desired = Date.UTC(year, month - 1, day, hour, minute)
  let guess = desired
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const actual = berlinParts(new Date(guess))
    const shown = Date.UTC(Number(actual.year), Number(actual.month) - 1, Number(actual.day), Number(actual.hour), Number(actual.minute))
    guess += desired - shown
  }
  return new Date(guess)
}

function repeatsOn(event: any, recurrence: any, candidate: string) {
  if (!recurrence) return candidate === event.start_date
  if (candidate < event.start_date || (recurrence.ends_on && candidate > recurrence.ends_on)) return false
  const interval = Math.max(1, Number(recurrence.interval_count || 1)), delta = daysBetween(event.start_date, candidate)
  if (recurrence.frequency === 'daily') return delta % interval === 0
  if (recurrence.frequency === 'weekly') {
    const startMonday = addDays(event.start_date, 1 - weekday(event.start_date)), candidateMonday = addDays(candidate, 1 - weekday(candidate))
    const weeks = Math.floor(daysBetween(startMonday, candidateMonday) / 7)
    const weekdays = recurrence.weekdays?.length ? recurrence.weekdays : [weekday(event.start_date)]
    return weeks >= 0 && weeks % interval === 0 && weekdays.includes(weekday(candidate))
  }
  const start = new Date(`${event.start_date}T12:00:00Z`), current = new Date(`${candidate}T12:00:00Z`)
  if (recurrence.frequency === 'monthly') {
    const months = (current.getUTCFullYear() - start.getUTCFullYear()) * 12 + current.getUTCMonth() - start.getUTCMonth()
    return months >= 0 && months % interval === 0 && current.getUTCDate() === Number(recurrence.month_day || start.getUTCDate())
  }
  if (recurrence.frequency !== 'yearly' || (current.getUTCFullYear() - start.getUTCFullYear()) % interval !== 0 || current.getUTCMonth() !== start.getUTCMonth()) return false
  // Geburtstag am 29. Februar: in Nicht-Schaltjahren am 28. Februar erinnern.
  const leapFallback = start.getUTCMonth() === 1 && start.getUTCDate() === 29 && new Date(Date.UTC(current.getUTCFullYear(), 1, 29)).getUTCMonth() !== 1
  return current.getUTCDate() === (leapFallback ? 28 : start.getUTCDate())
}

function reminderMoment(event: any, occurrenceDate: string, minutesBefore: number) {
  if (event.all_day) {
    const daysBefore = minutesBefore === 0 ? 0 : Math.max(1, Math.ceil(minutesBefore / 1440))
    return berlinWallTime(addDays(occurrenceDate, -daysBefore), 9, 0)
  }
  const [hour, minute] = String(event.start_time || '09:00').slice(0, 5).split(':').map(Number)
  return new Date(berlinWallTime(occurrenceDate, hour, minute).getTime() - minutesBefore * 60000)
}

Deno.serve(async request => {
  const unauthorized = authorizeCron(request)
  if (unauthorized) return unauthorized
  const now = new Date(), local = berlinParts(now), today = `${local.year}-${local.month}-${local.day}`
  const windowStart = now.getTime() - 2 * 60000, windowEnd = now.getTime() + 4 * 60000
  const [{ data: reminders, error: reminderError }, { data: events, error: eventError }, { data: recurrences }, { data: exceptions }] = await Promise.all([
    supabase.from('event_reminders').select('event_id,household_id,user_id,minutes_before'),
    supabase.from('calendar_events').select('id,household_id,title,all_day,start_date,start_time'),
    supabase.from('event_recurrences').select('event_id,frequency,interval_count,weekdays,month_day,ends_on'),
    supabase.from('event_exceptions').select('series_event_id,occurrence_date,action'),
  ])
  if (reminderError || eventError) return new Response((reminderError || eventError)!.message, { status: 500 })
  const eventsById = new Map((events || []).map((event: any) => [event.id, event]))
  const recurrenceById = new Map((recurrences || []).map((recurrence: any) => [recurrence.event_id, recurrence]))
  const skipped = new Set((exceptions || []).filter((item: any) => item.action === 'skip' || item.action === 'replace').map((item: any) => `${item.series_event_id}:${item.occurrence_date}`))
  let sent = 0
  for (const reminder of reminders || []) {
    const event: any = eventsById.get(reminder.event_id)
    if (!event) continue
    const recurrence = recurrenceById.get(event.id)
    for (let offset = -1; offset <= 8; offset += 1) {
      const occurrenceDate = addDays(today, offset)
      if (!repeatsOn(event, recurrence, occurrenceDate) || skipped.has(`${event.id}:${occurrenceDate}`)) continue
      const due = reminderMoment(event, occurrenceDate, Number(reminder.minutes_before)).getTime()
      if (due < windowStart || due >= windowEnd) continue
      const { data: subscriptions } = await supabase.from('push_subscriptions').select('id,endpoint,p256dh,auth_key').eq('household_id', reminder.household_id).eq('user_id', reminder.user_id).eq('enabled', true)
      for (const subscription of subscriptions || []) {
        const delivery = { household_id: reminder.household_id, event_id: event.id, user_id: reminder.user_id, subscription_id: subscription.id, occurrence_date: occurrenceDate, minutes_before: reminder.minutes_before }
        const { data: prior } = await supabase.from('event_notification_deliveries').select('id').match(delivery).maybeSingle()
        if (prior) continue
        try {
          const tag = `event:${event.id}:${occurrenceDate}:${reminder.minutes_before}`
          const dateLabel = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(`${occurrenceDate}T12:00:00Z`))
          await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } }, JSON.stringify({ title: event.title, body: event.all_day ? `${dateLabel} · ganztägig` : `${dateLabel} um ${String(event.start_time).slice(0, 5)} Uhr`, tag, url: `/?page=calendar&date=${occurrenceDate}` }))
          await supabase.from('event_notification_deliveries').insert(delivery)
          sent += 1
        } catch (pushError: any) {
          if ([404, 410].includes(pushError?.statusCode)) await supabase.from('push_subscriptions').update({ enabled: false, updated_at: new Date().toISOString() }).eq('id', subscription.id)
        }
      }
    }
  }
  return Response.json({ sent, checked_at: now.toISOString() })
})
