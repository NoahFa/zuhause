function sameSecret(left: string, right: string) {
  if (!left || left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

export function authorizeCron(request: Request): Response | null {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  const configured = Deno.env.get('CRON_SECRET') || ''
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!configured || !sameSecret(supplied, configured)) return new Response('Unauthorized', { status: 401 })
  return null
}
