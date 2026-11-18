// Rezept aus einem Link übernehmen (Rezeptkatalog Schritt 2, 18.11.2026).
// Der Browser darf fremde Seiten nicht selbst laden – diese Funktion ruft die Seite ab, liest die schema.org-Recipe-Daten
// (JSON-LD) und gibt Titel, Portionen, Zutaten, Schritte und ein verkleinertes Foto zurück. Gespeichert wird erst in der App.
// Bewusste Grenze: Deno kann einen Abruf nicht an die geprüfte IP-Adresse binden; ein präparierter Name könnte zwischen Prüfung
// und Abruf anders antworten (DNS-Rebinding). Gering, weil nur Haushaltsmitglieder aufrufen und Weiterleitungen einzeln geprüft werden.
// Absicherung: nur angemeldete Mitglieder eines Haushalts (verify_jwt + Mitgliedschaft), nur http/https auf Port 80/443,
// keine internen/privaten Adressen (auch nicht nach Weiterleitungen), Zeit- und Größenlimits. Instagram bewusst nicht.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

// Eigene Fehlerart: nur diese (deutschen) Meldungen gehen an die App, alles andere wird zu einer allgemeinen Meldung
class ImportError extends Error {}
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const ORIGINS = ['https://noahfa.github.io']
const PAGE_LIMIT = 3 * 1024 * 1024, IMAGE_LIMIT = 5 * 1024 * 1024, TIMEOUT = 8000, MAX_REDIRECTS = 4

function cors(request: Request) {
  const origin = request.headers.get('origin') || ''
  const allowed = ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  return { 'Access-Control-Allow-Origin': allowed ? origin : ORIGINS[0], 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }
}
const reply = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors(request), 'Content-Type': 'application/json' } })
const fail = (request: Request, message: string, status = 400) => reply(request, { error: message }, status)

// ---------- Schutz vor internen Adressen ----------
function privateIPv4(ip: string) {
  const p = ip.split('.').map(Number); if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a, b] = p
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224
}
function privateIPv6(ip: string) {
  const v = ip.toLowerCase()
  if (v === '::' || v === '::1') return true
  if (v.startsWith('::ffff:')) return privateIPv4(v.slice(7))
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v) || v.startsWith('64:ff9b') || v.startsWith('2001:db8')
}
async function checkUrl(raw: string): Promise<URL> {
  let url: URL
  try { url = new URL(raw) } catch { throw new ImportError('Das ist kein gültiger Link.') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new ImportError('Nur Links mit http:// oder https:// gehen.')
  if (url.username || url.password) throw new ImportError('Links mit Zugangsdaten gehen nicht.')
  if (url.port && !['80', '443'].includes(url.port)) throw new ImportError('Dieser Link geht nicht (ungewöhnlicher Port).')
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.+$/, '') // Punkt am Ende („instagram.com.“) entfernen
  if (!host.includes('.') || /(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/.test(host)) throw new ImportError('Interne Adressen gehen nicht.')
  if (/(^|\.)(instagram\.com|instagr\.am)$/.test(host)) throw new ImportError('Instagram-Links werden nicht übernommen.')
  if (/^[\d.]+$/.test(host)) { if (privateIPv4(host)) throw new ImportError('Interne Adressen gehen nicht.'); return url }
  if (host.includes(':')) { if (privateIPv6(host)) throw new ImportError('Interne Adressen gehen nicht.'); return url }
  // Name auflösen und jede Adresse prüfen (sonst könnte ein Name auf ein internes Netz zeigen)
  const [v4, v6] = await Promise.all([Deno.resolveDns(host, 'A').catch(() => [] as string[]), Deno.resolveDns(host, 'AAAA').catch(() => [] as string[])])
  if (!v4.length && !v6.length) throw new ImportError('Diese Seite wurde nicht gefunden.')
  if (v4.some(privateIPv4) || v6.some(privateIPv6)) throw new ImportError('Interne Adressen gehen nicht.')
  return url
}
// Abruf mit Weiterleitungen (jede wird erneut geprüft), Zeit- und Größenlimit
async function safeFetch(raw: string, limit: number, accept: string) {
  let url = await checkUrl(raw)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZuhauseRezeptImport/1.0)', Accept: accept, 'Accept-Language': 'de-DE,de;q=0.9' } })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = response.headers.get('location'); await response.body?.cancel()
      if (!next) throw new ImportError('Die Seite leitet ins Leere weiter.')
      url = await checkUrl(new URL(next, url).href); continue
    }
    if (!response.ok) { await response.body?.cancel(); throw new ImportError(response.status === 403 ? 'Die Seite lässt den Abruf nicht zu.' : `Die Seite antwortet nicht richtig (${response.status}).`) }
    const length = Number(response.headers.get('content-length') || 0)
    if (length > limit) { await response.body?.cancel(); throw new ImportError('Die Seite ist zu groß.') }
    const reader = response.body!.getReader(), chunks: Uint8Array[] = []; let size = 0
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new ImportError('Die Seite ist zu groß.') } chunks.push(value) }
    const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length }
    return { bytes, url, type: (response.headers.get('content-type') || '').toLowerCase() }
  }
  throw new ImportError('Zu viele Weiterleitungen.')
}

// ---------- schema.org Recipe lesen ----------
// Zeichen-Codes sicher umwandeln: kaputte Codes (z. B. &#99999999;) werden übersprungen statt den Import abzubrechen
const codePoint = (n: number) => Number.isInteger(n) && n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : ''
const decode = (s: string) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d{1,8});/g, (_, n) => codePoint(Number(n))).replace(/&#x([0-9a-f]{1,6});/gi, (_, n) => codePoint(parseInt(n, 16)))
const clean = (s: unknown) => decode(String(s ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
const isRecipe = (node: any) => node && typeof node === 'object' && [].concat(node['@type'] || []).some((t: string) => String(t).toLowerCase() === 'recipe')
function findRecipe(node: any, depth = 0): any {
  if (!node || depth > 6) return null
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n, depth + 1); if (r) return r } return null }
  if (typeof node !== 'object') return null
  if (isRecipe(node)) return node
  for (const key of ['@graph', 'mainEntity', 'itemListElement', 'item']) { const r = findRecipe(node[key], depth + 1); if (r) return r }
  return null
}
function steps(value: any, depth = 0): string[] {
  if (!value || depth > 4) return []
  if (typeof value === 'string') return value.split(/\r?\n+/).map(clean).filter(Boolean)
  if (Array.isArray(value)) return value.flatMap(v => steps(v, depth + 1))
  if (typeof value === 'object') {
    const type = [].concat(value['@type'] || []).join(' ')
    if (/HowToSection/i.test(type)) return [...(value.name ? [`${clean(value.name)}:`] : []), ...steps(value.itemListElement, depth + 1)]
    return [clean(value.text || value.name || '')].filter(Boolean)
  }
  return []
}
function image(value: any): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return image(value[0])
  return String(value.url || value.contentUrl || '')
}
function servings(value: any): number | null {
  const text = Array.isArray(value) ? value.map(String).join(' ') : String(value ?? '')
  const m = text.match(/\d+/); const n = m ? Number(m[0]) : NaN
  return Number.isFinite(n) && n > 0 && n < 100 ? n : null
}
function parsePage(html: string, pageUrl: URL) {
  const blocks = [...html.matchAll(/<script[^>]+type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1])
  let recipe: any = null
  for (const block of blocks) {
    try { recipe = findRecipe(JSON.parse(block.trim())) } catch { try { recipe = findRecipe(JSON.parse(block.trim().replace(/[\u0000-\u001f]+/g, ' '))) } catch {} }
    if (recipe) break
  }
  if (!recipe) return null
  const keywords = [recipe.recipeCategory, recipe.recipeCuisine].flat().filter(Boolean).flatMap(k => clean(k).split(/\s*[,;]\s*/)).filter(k => k && k.length <= 40)
  const imageUrl = image(recipe.image)
  return {
    title: clean(recipe.name).slice(0, 200),
    servings: servings(recipe.recipeYield),
    ingredients: [].concat(recipe.recipeIngredient || recipe.ingredients || []).map(clean).filter(Boolean).slice(0, 200),
    steps: steps(recipe.recipeInstructions).slice(0, 100),
    categories: [...new Set(keywords)].slice(0, 6),
    imageUrl: imageUrl ? new URL(imageUrl, pageUrl).href : '',
  }
}
function toBase64(bytes: Uint8Array) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s) }

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(request) })
  if (request.method !== 'POST') return fail(request, 'Nur POST.', 405)
  // angemeldet (Signatur prüft schon die Plattform, verify_jwt) und Mitglied eines Haushalts
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: user } = await supabase.auth.getUser(token)
  if (!user?.user) return fail(request, 'Bitte anmelden.', 401)
  const { count } = await supabase.from('household_members').select('household_id', { count: 'exact', head: true }).eq('user_id', user.user.id)
  if (!count) return fail(request, 'Kein Zugriff.', 403)

  let body: any = {}
  try { body = await request.json() } catch { return fail(request, 'Ungültige Anfrage.') }
  const link = String(body?.url || '').trim().slice(0, 2000)
  if (!link) return fail(request, 'Bitte einen Link einfügen.')
  try {
    const page = await safeFetch(link, PAGE_LIMIT, 'text/html,application/xhtml+xml')
    if (page.type && !/html|xml/.test(page.type)) return fail(request, 'Unter diesem Link liegt keine Webseite.')
    const recipe = parsePage(new TextDecoder().decode(page.bytes), page.url)
    if (!recipe || (!recipe.ingredients.length && !recipe.steps.length)) return fail(request, 'Auf dieser Seite wurden keine Rezeptdaten gefunden. Das Rezept bitte selbst eintippen.', 422)
    // Foto mitliefern (die App verkleinert und speichert es geschützt); fehlt es oder ist es zu groß, geht es ohne
    let photo = ''
    if (recipe.imageUrl) {
      try {
        const img = await safeFetch(recipe.imageUrl, IMAGE_LIMIT, 'image/jpeg,image/png,image/webp')
        const type = img.type.split(';')[0].trim()
        if (['image/jpeg', 'image/png', 'image/webp'].includes(type)) photo = `data:${type};base64,${toBase64(img.bytes)}`
      } catch { /* ohne Foto weiter */ }
    }
    const { imageUrl: _, ...rest } = recipe
    return reply(request, { ...rest, source: page.url.href, photo })
  } catch (error) {
    const message = error instanceof ImportError ? error.message : 'Die Seite konnte gerade nicht geladen werden.'
    return fail(request, message, 422)
  }
})
