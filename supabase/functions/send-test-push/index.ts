import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import webpush from 'npm:web-push@3.6.7'

// Probe-Mitteilung an DIESES Gerät (Mehr → Mitteilungen → „Probe senden“).
// Nur für angemeldete Haushaltsmitglieder (verify_jwt + Mitgliedschaft), nur an ein eigenes, beim Server bekanntes Abo.
// Antwortet sofort und sendet nach `delay` Sekunden (höchstens 30), damit man das iPhone vorher sperren kann.

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
webpush.setVapidDetails('mailto:app@zuhause-familienapp.pages.dev', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)
const ORIGINS = ['https://noahfa.github.io']
function cors(request: Request) {
  const origin = request.headers.get('origin') || ''
  const allowed = ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  return { 'Access-Control-Allow-Origin': allowed ? origin : ORIGINS[0], 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }
}
const reply = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors(request), 'Content-Type': 'application/json' } })

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(request) })
  if (request.method !== 'POST') return reply(request, { error: 'Nur POST.' }, 405)
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: user } = await supabase.auth.getUser(token)
  if (!user?.user) return reply(request, { error: 'Bitte anmelden.' }, 401)
  let body: any = {}
  try { body = await request.json() } catch { return reply(request, { error: 'Ungültige Anfrage.' }, 400) }
  const endpoint = String(body?.endpoint || '').slice(0, 1000), delay = Math.max(0, Math.min(30, Number(body?.delay) || 0))
  const { data: subscription } = await supabase.from('push_subscriptions').select('id,endpoint,p256dh,auth_key,household_id').eq('user_id', user.user.id).eq('endpoint', endpoint).eq('enabled', true).maybeSingle()
  if (!subscription) return reply(request, { error: 'Dieses Gerät ist beim Server nicht angemeldet. Bitte Mitteilungen neu einschalten.' }, 404)
  const { count } = await supabase.from('household_members').select('household_id', { count: 'exact', head: true }).eq('user_id', user.user.id).eq('household_id', subscription.household_id)
  if (!count) return reply(request, { error: 'Kein Zugriff.' }, 403)
  const send = async () => {
    await new Promise(resolve => setTimeout(resolve, delay * 1000))
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } }, JSON.stringify({ title: 'Probe-Mitteilung', body: 'Mitteilungen kommen auf diesem iPhone an. ✓', tag: `test:${Date.now()}`, url: './?page=more' }), { urgency: 'high', TTL: 600 })
    } catch (error: any) {
      if ([404, 410].includes(error?.statusCode)) await supabase.from('push_subscriptions').update({ enabled: false, updated_at: new Date().toISOString() }).eq('id', subscription.id)
    }
  }
  // @ts-ignore EdgeRuntime gibt es nur bei Supabase
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(send()); else await send()
  return reply(request, { ok: true, delay })
})
