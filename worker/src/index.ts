interface Env {
  DB: D1Database
  CODE_PEPPER: string
  ADMIN_SETUP_KEY: string
  FRONTEND_ORIGIN: string
}

type Session = { userId: string; userType: 'participant' | 'admin' }
type Participant = { id: string; full_name: string; created_at: string; is_active: number }
type Dish = { id: string; name: string; description: string | null; created_at: string }

const json = (data: unknown, status = 200, origin = '*') =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'content-type, authorization, x-admin-setup-key',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
  })

const id = () => crypto.randomUUID()
const randomBytes = (size: number) => {
  const value = new Uint8Array(size)
  crypto.getRandomValues(value)
  return value
}
const hex = (value: Uint8Array) => [...value].map((byte) => byte.toString(16).padStart(2, '0')).join('')
const digest = async (value: string) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
const hmac = async (value: string, secret: string) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))))
}
const sessionToken = () => hex(randomBytes(32))
const personalCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(randomBytes(10), (byte) => alphabet[byte % alphabet.length]).join('')
}
const bodyOf = async <T>(request: Request): Promise<T> => request.json<T>().catch(() => ({} as T))

async function passwordHash(password: string, salt: string) {
  let value = new TextEncoder().encode(`${salt}:${password}`)
  for (let iteration = 0; iteration < 10_000; iteration += 1) {
    value = new Uint8Array(await crypto.subtle.digest('SHA-256', value))
  }
  return hex(value)
}

async function createSession(env: Env, userId: string, userType: Session['userType']) {
  const raw = sessionToken()
  await env.DB.prepare("INSERT INTO sessions (id, token_hash, user_type, user_id, expires_at) VALUES (?, ?, ?, ?, datetime('now', '+12 hours'))")
    .bind(id(), await digest(raw), userType, userId).run()
  return raw
}

async function getSession(request: Request, env: Env): Promise<Session | null> {
  const raw = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!raw) return null
  const row = await env.DB.prepare("SELECT user_id, user_type FROM sessions WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP")
    .bind(await digest(raw)).first<{ user_id: string; user_type: Session['userType'] }>()
  return row ? { userId: row.user_id, userType: row.user_type } : null
}

async function requireAdmin(request: Request, env: Env, origin: string) {
  const current = await getSession(request, env)
  if (!current) return { response: json({ success: false, message: 'Sesión inválida o caducada.' }, 401, origin) }
  if (current.userType !== 'admin') return { response: json({ success: false, message: 'Permisos insuficientes.' }, 403, origin) }
  return { current }
}

async function participantLogin(request: Request, env: Env, origin: string) {
  const { code } = await bodyOf<{ code?: string }>(request)
  const normalized = code?.trim().toUpperCase()
  if (!normalized || normalized.length < 6) return json({ success: false, message: 'Código inválido.' }, 400, origin)
  const event = await env.DB.prepare("SELECT status FROM events WHERE id = 'main'").first<{ status: string }>()
  if (event?.status !== 'published') return json({ success: false, message: 'El evento todavía no está publicado.' }, 409, origin)
  const row = await env.DB.prepare('SELECT id, full_name FROM participants WHERE event_id = ? AND code_hash = ? AND is_active = 1')
    .bind('main', await hmac(normalized, env.CODE_PEPPER)).first<{ id: string; full_name: string }>()
  if (!row) return json({ success: false, message: 'El código no es válido.' }, 401, origin)
  return json({ success: true, data: { token: await createSession(env, row.id, 'participant'), participantName: row.full_name } }, 200, origin)
}

async function participantMe(request: Request, env: Env, origin: string) {
  const current = await getSession(request, env)
  if (!current || current.userType !== 'participant') return json({ success: false, message: 'Sesión inválida o caducada.' }, 401, origin)
  const participant = await env.DB.prepare('SELECT full_name FROM participants WHERE id = ? AND event_id = ?').bind(current.userId, 'main').first<{ full_name: string }>()
  if (!participant) return json({ success: false, message: 'Participante no encontrado.' }, 404, origin)
  return json({ success: true, data: { participantName: participant.full_name } }, 200, origin)
}

async function setupAdmin(request: Request, env: Env, origin: string) {
  if (request.headers.get('x-admin-setup-key') !== env.ADMIN_SETUP_KEY) return json({ success: false, message: 'Clave de configuración inválida.' }, 401, origin)
  const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM admin_users').first<{ count: number }>()
  if (count?.count) return json({ success: false, message: 'El administrador ya fue configurado.' }, 409, origin)
  const { username, password } = await bodyOf<{ username?: string; password?: string }>(request)
  if (!username?.trim() || !password || password.length < 12) return json({ success: false, message: 'Usuario y contraseña de al menos 12 caracteres son obligatorios.' }, 400, origin)
  const salt = hex(randomBytes(16))
  await env.DB.prepare('INSERT INTO admin_users (id, username, password_hash, password_salt) VALUES (?, ?, ?, ?)')
    .bind(id(), username.trim(), await passwordHash(password, salt), salt).run()
  return json({ success: true, message: 'Administrador configurado.' }, 201, origin)
}

async function adminLogin(request: Request, env: Env, origin: string) {
  const { username, password } = await bodyOf<{ username?: string; password?: string }>(request)
  if (!username || !password) return json({ success: false, message: 'Usuario y contraseña son obligatorios.' }, 400, origin)
  const admin = await env.DB.prepare('SELECT id, password_hash, password_salt FROM admin_users WHERE username = ? AND is_active = 1')
    .bind(username.trim()).first<{ id: string; password_hash: string; password_salt: string }>()
  if (!admin || await passwordHash(password, admin.password_salt) !== admin.password_hash) return json({ success: false, message: 'Credenciales inválidas.' }, 401, origin)
  return json({ success: true, data: { token: await createSession(env, admin.id, 'admin') } }, 200, origin)
}

async function adminDashboard(env: Env, origin: string) {
  const [event, participants, dishes, progress] = await Promise.all([
    env.DB.prepare("SELECT id, name, status, created_at, published_at FROM events WHERE id = 'main'").first(),
    env.DB.prepare('SELECT id, full_name, created_at, is_active FROM participants WHERE event_id = ? ORDER BY created_at').bind('main').all<Participant>(),
    env.DB.prepare('SELECT id, name, description, created_at FROM dishes WHERE event_id = ? ORDER BY created_at').bind('main').all<Dish>(),
    env.DB.prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN angelito_revealed_at IS NOT NULL THEN 1 ELSE 0 END) AS angelito, SUM(CASE WHEN food_revealed_at IS NOT NULL THEN 1 ELSE 0 END) AS food FROM assignments WHERE event_id = ?').bind('main').first(),
  ])
  return json({ success: true, data: { event, participants: participants.results, dishes: dishes.results, progress } }, 200, origin)
}

async function addParticipant(request: Request, env: Env, origin: string) {
  const event = await env.DB.prepare("SELECT status FROM events WHERE id = 'main'").first<{ status: string }>()
  const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM participants WHERE event_id = ?').bind('main').first<{ count: number }>()
  const { fullName } = await bodyOf<{ fullName?: string }>(request)
  if (event?.status !== 'draft') return json({ success: false, message: 'El evento ya está publicado.' }, 409, origin)
  if ((count?.count ?? 0) >= 10) return json({ success: false, message: 'Solo se permiten 10 participantes.' }, 409, origin)
  if (!fullName?.trim()) return json({ success: false, message: 'El nombre es obligatorio.' }, 400, origin)
  const code = personalCode()
  try {
    const result = await env.DB.prepare('INSERT INTO participants (id, event_id, full_name, code_hash) VALUES (?, ?, ?, ?)')
      .bind(id(), 'main', fullName.trim(), await hmac(code, env.CODE_PEPPER)).run()
    return json({ success: true, data: { id: result.meta.last_row_id, fullName: fullName.trim(), code } }, 201, origin)
  } catch {
    return json({ success: false, message: 'Ese participante ya existe.' }, 409, origin)
  }
}

async function addDish(request: Request, env: Env, origin: string) {
  const event = await env.DB.prepare("SELECT status FROM events WHERE id = 'main'").first<{ status: string }>()
  const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM dishes WHERE event_id = ?').bind('main').first<{ count: number }>()
  const { name, description } = await bodyOf<{ name?: string; description?: string }>(request)
  if (event?.status !== 'draft') return json({ success: false, message: 'El evento ya está publicado.' }, 409, origin)
  if ((count?.count ?? 0) >= 10) return json({ success: false, message: 'Solo se permiten 10 platos.' }, 409, origin)
  if (!name?.trim()) return json({ success: false, message: 'El nombre del plato es obligatorio.' }, 400, origin)
  try {
    await env.DB.prepare('INSERT INTO dishes (id, event_id, name, description) VALUES (?, ?, ?, ?)').bind(id(), 'main', name.trim(), description?.trim() || null).run()
    return json({ success: true, message: 'Plato agregado.' }, 201, origin)
  } catch {
    return json({ success: false, message: 'Ese plato ya existe.' }, 409, origin)
  }
}

async function removeDraftItem(request: Request, env: Env, origin: string, kind: 'participants' | 'dishes', itemId: string) {
  const event = await env.DB.prepare("SELECT status FROM events WHERE id = 'main'").first<{ status: string }>()
  if (event?.status !== 'draft') return json({ success: false, message: 'El evento ya está publicado.' }, 409, origin)
  const table = kind === 'participants' ? 'participants' : 'dishes'
  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ? AND event_id = ?`).bind(itemId, 'main').run()
  return json({ success: true, message: 'Registro eliminado.' }, 200, origin)
}

async function adminResults(env: Env, origin: string) {
  const rows = await env.DB.prepare(`SELECT p.full_name AS participant, r.full_name AS angelito, d.name AS dish,
    a.angelito_revealed_at, a.food_revealed_at
    FROM assignments a
    JOIN participants p ON p.id = a.participant_id
    JOIN participants r ON r.id = a.angelito_recipient_id
    JOIN dishes d ON d.id = a.food_dish_id
    WHERE a.event_id = ? ORDER BY p.full_name`).bind('main').all()
  return json({ success: true, data: rows.results }, 200, origin)
}

function shuffle<T>(values: T[]) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const random = new Uint32Array(1)
    crypto.getRandomValues(random)
    const target = random[0] % (index + 1)
    ;[values[index], values[target]] = [values[target], values[index]]
  }
  return values
}

async function publish(env: Env, origin: string) {
  const event = await env.DB.prepare("SELECT status FROM events WHERE id = 'main'").first<{ status: string }>()
  const participants = (await env.DB.prepare('SELECT id FROM participants WHERE event_id = ? ORDER BY id').bind('main').all<{ id: string }>()).results.map((row) => row.id)
  const dishes = (await env.DB.prepare('SELECT id FROM dishes WHERE event_id = ? ORDER BY id').bind('main').all<{ id: string }>()).results.map((row) => row.id)
  if (event?.status !== 'draft') return json({ success: false, message: 'El evento ya fue publicado.' }, 409, origin)
  if (participants.length !== 10 || dishes.length !== 10) return json({ success: false, message: 'Necesitas exactamente 10 participantes y 10 platos.' }, 409, origin)
  let recipients: string[] = []
  do {
    recipients = shuffle([...participants])
  } while (recipients.some((recipient, index) => recipient === participants[index]))
  const statements = participants.map((participant, index) =>
    env.DB.prepare('INSERT INTO assignments (id, event_id, participant_id, angelito_recipient_id, food_dish_id) VALUES (?, ?, ?, ?, ?)')
      .bind(id(), 'main', participant, recipients[index], dishes[index]))
  statements.push(env.DB.prepare("UPDATE events SET status = 'published', published_at = CURRENT_TIMESTAMP WHERE id = 'main'"))
  await env.DB.batch(statements)
  return json({ success: true, message: 'Evento publicado y sorteos fijados.' }, 200, origin)
}

async function resetEvent(env: Env, origin: string) {
  const event = await env.DB.prepare("SELECT status FROM events WHERE id = 'main'").first<{ status: string }>()
  if (event?.status !== 'published') return json({ success: false, message: 'El evento ya está en borrador.' }, 409, origin)
  await env.DB.batch([
    env.DB.prepare("DELETE FROM assignments WHERE event_id = 'main'"),
    env.DB.prepare("UPDATE events SET status = 'draft', published_at = NULL WHERE id = 'main'"),
  ])
  return json({ success: true, message: 'Sorteo reiniciado. Participantes y platos fueron conservados.' }, 200, origin)
}

async function reveal(env: Env, kind: 'angelito' | 'food', current: Session, origin: string) {
  const revealed = kind === 'angelito' ? 'angelito_revealed_at' : 'food_revealed_at'
  const label = kind === 'angelito' ? 'p.full_name AS result' : 'd.name AS result'
  const join = kind === 'angelito' ? 'JOIN participants p ON p.id = a.angelito_recipient_id' : 'JOIN dishes d ON d.id = a.food_dish_id'
  const existing = await env.DB.prepare(`SELECT ${label}, a.${revealed} AS revealed FROM assignments a ${join} WHERE a.participant_id = ? AND a.event_id = ?`)
    .bind(current.userId, 'main').first<{ result: string; revealed: string | null }>()
  if (!existing) return json({ success: false, message: 'Asignación no encontrada.' }, 404, origin)
  await env.DB.prepare(`UPDATE assignments SET ${revealed} = CURRENT_TIMESTAMP WHERE participant_id = ? AND event_id = ? AND ${revealed} IS NULL`).bind(current.userId, 'main').run()
  return json({ success: true, data: { result: existing.result, revealed: existing.revealed ?? new Date().toISOString() } }, 200, origin)
}

export default {
  async fetch(request: Request, env: Env) {
    const origin = env.FRONTEND_ORIGIN || '*'
    if (request.method === 'OPTIONS') return json({ success: true }, 200, origin)
    const url = new URL(request.url)
    try {
      if (url.pathname === '/api/auth/participant' && request.method === 'POST') return participantLogin(request, env, origin)
      if (url.pathname === '/api/participant/me' && request.method === 'GET') return participantMe(request, env, origin)
      if (url.pathname === '/api/admin/setup' && request.method === 'POST') return setupAdmin(request, env, origin)
      if (url.pathname === '/api/admin/login' && request.method === 'POST') return adminLogin(request, env, origin)
      const current = await getSession(request, env)
      if (!current) return json({ success: false, message: 'Sesión inválida o caducada.' }, 401, origin)
      if (url.pathname === '/api/participant/reveal/angelito' && request.method === 'POST' && current.userType === 'participant') return reveal(env, 'angelito', current, origin)
      if (url.pathname === '/api/participant/reveal/food' && request.method === 'POST' && current.userType === 'participant') return reveal(env, 'food', current, origin)
      const admin = await requireAdmin(request, env, origin)
      if ('response' in admin) return admin.response
      if (url.pathname === '/api/admin/dashboard' && request.method === 'GET') return adminDashboard(env, origin)
      if (url.pathname === '/api/admin/participants' && request.method === 'POST') return addParticipant(request, env, origin)
      if (url.pathname === '/api/admin/dishes' && request.method === 'POST') return addDish(request, env, origin)
      if (url.pathname === '/api/admin/results' && request.method === 'GET') return adminResults(env, origin)
      const participantMatch = url.pathname.match(/^\/api\/admin\/participants\/([^/]+)$/)
      if (participantMatch && request.method === 'DELETE') return removeDraftItem(request, env, origin, 'participants', participantMatch[1])
      const dishMatch = url.pathname.match(/^\/api\/admin\/dishes\/([^/]+)$/)
      if (dishMatch && request.method === 'DELETE') return removeDraftItem(request, env, origin, 'dishes', dishMatch[1])
      if (url.pathname === '/api/admin/events/main/reset' && request.method === 'POST') return resetEvent(env, origin)
      if (url.pathname === '/api/admin/events/main/publish' && request.method === 'POST') return publish(env, origin)
      return json({ success: false, message: 'Ruta no encontrada.' }, 404, origin)
    } catch (error) {
      console.error('request_failed', error instanceof Error ? error.message : String(error))
      return json({ success: false, message: 'Error interno del servidor.' }, 500, origin)
    }
  },
}
