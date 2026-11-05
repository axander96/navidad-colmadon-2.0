interface Env { DB: D1Database; CODE_PEPPER: string; ADMIN_SETUP_KEY: string; FRONTEND_ORIGIN: string }
type Session = { userId: string; userType: 'participant' | 'admin' }
const json = (data: unknown, status = 200, origin = '*') => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS' } })
const id = () => crypto.randomUUID()
const bytes = (size: number) => { const value = new Uint8Array(size); crypto.getRandomValues(value); return value }
const hex = (value: Uint8Array) => [...value].map((byte) => byte.toString(16).padStart(2, '0')).join('')
const digest = async (value: string) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
const hmac = async (value: string, secret: string) => { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))) }
const token = () => hex(bytes(32))
async function session(request: Request, env: Env): Promise<Session | null> {
  const raw = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!raw) return null
  const row = await env.DB.prepare('SELECT user_id, user_type FROM sessions WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP').bind(await digest(raw)).first<{ user_id: string; user_type: 'participant' | 'admin' }>()
  return row ? { userId: row.user_id, userType: row.user_type } : null
}
async function participantLogin(request: Request, env: Env) {
  const body = await request.json<{ code?: string }>().catch(() => ({ code: undefined }))
  const code = body.code?.trim().toUpperCase()
  if (!code || code.length < 6) return json({ success: false, message: 'Código inválido.' }, 400, env.FRONTEND_ORIGIN)
  const row = await env.DB.prepare('SELECT id FROM participants WHERE event_id = ? AND code_hash = ? AND is_active = 1').bind('main', await hmac(code, env.CODE_PEPPER)).first<{ id: string }>()
  if (!row) return json({ success: false, message: 'El código no es válido.' }, 401, env.FRONTEND_ORIGIN)
  const raw = token()
  await env.DB.prepare("INSERT INTO sessions (id, token_hash, user_type, user_id, expires_at) VALUES (?, ?, 'participant', ?, datetime('now', '+12 hours'))").bind(id(), await digest(raw), row.id).run()
  return json({ success: true, data: { token: raw } }, 200, env.FRONTEND_ORIGIN)
}
async function reveal(request: Request, env: Env, kind: 'angelito' | 'food', current: Session) {
  const revealed = kind === 'angelito' ? 'angelito_revealed_at' : 'food_revealed_at'
  const label = kind === 'angelito' ? 'p.full_name AS result' : 'd.name AS result'
  const join = kind === 'angelito' ? 'JOIN participants p ON p.id = a.angelito_recipient_id' : 'JOIN dishes d ON d.id = a.food_dish_id'
  const existing = await env.DB.prepare(`SELECT ${label}, a.${revealed} AS revealed FROM assignments a ${join} WHERE a.participant_id = ? AND a.event_id = ?`).bind(current.userId, 'main').first<{ result: string; revealed: string | null }>()
  if (!existing) return json({ success: false, message: 'Asignación no encontrada.' }, 404, env.FRONTEND_ORIGIN)
  await env.DB.prepare(`UPDATE assignments SET ${revealed} = CURRENT_TIMESTAMP WHERE participant_id = ? AND event_id = ? AND ${revealed} IS NULL`).bind(current.userId, 'main').run()
  return json({ success: true, data: { result: existing.result, revealed: existing.revealed ?? new Date().toISOString() } }, 200, env.FRONTEND_ORIGIN)
}
export default { async fetch(request: Request, env: Env): Promise<Response> {
  const origin = env.FRONTEND_ORIGIN || '*'
  if (request.method === 'OPTIONS') return json(null, 204, origin)
  const url = new URL(request.url)
  try {
    if (url.pathname === '/api/auth/participant' && request.method === 'POST') return participantLogin(request, env)
    const current = await session(request, env)
    if (!current) return json({ success: false, message: 'Sesión inválida o caducada.' }, 401, origin)
    if (current.userType !== 'participant') return json({ success: false, message: 'Permisos insuficientes.' }, 403, origin)
    if (url.pathname === '/api/participant/reveal/angelito' && request.method === 'POST') return reveal(request, env, 'angelito', current)
    if (url.pathname === '/api/participant/reveal/food' && request.method === 'POST') return reveal(request, env, 'food', current)
    return json({ success: false, message: 'Ruta no encontrada.' }, 404, origin)
  } catch (error) { console.error(error); return json({ success: false, message: 'Error interno.' }, 500, origin) }
} }
