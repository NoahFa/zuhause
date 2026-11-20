import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import webpush from 'npm:web-push@3.6.7'

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

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
webpush.setVapidDetails('mailto:app@zuhause-familienapp.pages.dev', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

function berlinParts(date: Date) {
  return Object.fromEntries(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(part => [part.type, part.value]))
}
function berlinDate(date: Date) { const p = berlinParts(date); return `${p.year}-${p.month}-${p.day}` }
function naturalList(items: string[]) { return items.length < 2 ? items[0] : `${items.slice(0, -1).join(', ')} und ${items.at(-1)}` }

Deno.serve(async request => {
  const unauthorized = authorizeCron(request)
  if (unauthorized) return unauthorized
  const now = new Date(), local = berlinParts(now)
  if (local.hour !== '15' || Number(local.minute) >= 15) return Response.json({ skipped: true, reason: 'Außerhalb des 15-Uhr-Fensters' })
  const tomorrow = berlinDate(new Date(now.getTime() + 86400000))
  const { data: events, error } = await supabase.from('external_events').select('household_id,title').eq('kind', 'waste').eq('event_date', tomorrow).eq('status', 'scheduled')
  if (error) return new Response(error.message, { status: 500 })
  const byHousehold = new Map<string, Set<string>>()
  for (const event of events || []) { if (!byHousehold.has(event.household_id)) byHousehold.set(event.household_id, new Set()); byHousehold.get(event.household_id)!.add(event.title) }
  let sent = 0
  for (const [householdId, names] of byHousehold) {
    const bins = [...names], reminderKey = `waste:${tomorrow}`
    const { data: subscriptions } = await supabase.from('push_subscriptions').select('id,endpoint,p256dh,auth_key').eq('household_id', householdId).eq('enabled', true)
    for (const subscription of subscriptions || []) {
      const { data: prior } = await supabase.from('notification_deliveries').select('id').eq('subscription_id', subscription.id).eq('reminder_key', reminderKey).maybeSingle()
      if (prior) continue
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } }, JSON.stringify({ title: 'Müll rausstellen', body: `Morgen bitte ${naturalList(bins)} rausstellen.`, tag: reminderKey, url: `/?page=calendar&date=${tomorrow}` }), { urgency: 'high', TTL: 43200 })
        await supabase.from('notification_deliveries').insert({ household_id: householdId, subscription_id: subscription.id, reminder_key: reminderKey, event_date: tomorrow }); sent++
      } catch (pushError: any) {
        if ([404, 410].includes(pushError?.statusCode)) await supabase.from('push_subscriptions').update({ enabled: false, updated_at: new Date().toISOString() }).eq('id', subscription.id)
      }
    }
  }
  return Response.json({ sent, event_date: tomorrow })
})
