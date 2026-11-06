import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, ChefHat, Gift, KeyRound, LockKeyhole, LogOut, ShieldCheck, Sparkles, UtensilsCrossed, Users, WandSparkles } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import './App.css'

type View = 'home' | 'login' | 'dashboard' | 'admin-login' | 'admin'
type Reveal = 'angelito' | 'food'
type AdminData = {
  event: { status: 'draft' | 'published'; name: string }
  participants: { id: string; full_name: string }[]
  dishes: { id: string; name: string; description: string | null }[]
  progress: { total: number; angelito: number; food: number } | null
}
const API_URL = import.meta.env.VITE_API_URL ?? ''

async function request<T>(path: string, options: RequestInit = {}, token?: string) {
  if (!API_URL) throw new Error('La API no está configurada.')
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  const payload = await response.json() as { success?: boolean; message?: string; data?: T }
  if (!response.ok || !payload.success) throw new Error(payload.message ?? 'La operación no pudo completarse.')
  return payload.data as T
}

function App() {
  const [view, setView] = useState<View>('login')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revealed, setRevealed] = useState<Partial<Record<Reveal, string>>>({})
  const [participantName, setParticipantName] = useState('')

  const participantLogin = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (code.trim().length < 6) { setError('Escribe tu código personal.'); return }
    setBusy(true)
    try { const data = await request<{ token: string; participantName: string }>('/api/auth/participant', { method: 'POST', body: JSON.stringify({ code }) }); sessionStorage.setItem('navidad_session', data.token); setParticipantName(data.participantName); setView('dashboard') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No pudimos iniciar sesión.') }
    finally { setBusy(false) }
  }
  const reveal = async (kind: Reveal) => {
    const data = await request<{ result: string }>(`/api/participant/reveal/${kind}`, { method: 'POST' }, sessionStorage.getItem('navidad_session') ?? undefined)
    setRevealed((current) => ({ ...current, [kind]: data.result }))
  }

  return <main className="app-shell">
    <div className="ambient ambient-left" /><div className="ambient ambient-right" />
    <header className="topbar">
      <button className="brand" onClick={() => setView('login')}><span className="brand-mark"><Sparkles size={16} /></span><span>Navidad <strong>Colmadon 2.0</strong></span></button>
      <div className="topbar-actions">
        {view !== 'login' && view !== 'home' && <button className="quiet-button" onClick={() => setView('admin-login')}><WandSparkles size={15} /> Organizador</button>}
        {view !== 'login' && view !== 'admin' && <button className="quiet-button" onClick={() => setView('login')}>Acceso</button>}
        {(view === 'dashboard' || view === 'admin') && <button className="quiet-button" onClick={() => { sessionStorage.removeItem(view === 'admin' ? 'navidad_admin_session' : 'navidad_session'); setView('login') }}><LogOut size={15} /> Salir</button>}
      </div>
    </header>
    <AnimatePresence mode="wait">
      {view === 'login' && <Login title="Entra a tu experiencia" subtitle="Usa el código personal que te entregó el organizador." label="Código personal" value={code} onChange={(value) => setCode(value.toUpperCase())} onSubmit={participantLogin} error={error} busy={busy} onOrganizer={() => setView('admin-login')} />}
      {view === 'dashboard' && <ParticipantDashboard name={participantName} revealed={revealed} onReveal={reveal} />}
      {view === 'admin-login' && <AdminLogin onSuccess={() => setView('admin')} />}
      {view === 'admin' && <AdminDashboard onError={setError} />}
    </AnimatePresence>
    {error && view === 'admin' && <div className="toast error-message">{error}</div>}
  </main>
}

function Login({ title, subtitle, label, value, onChange, onSubmit, error, busy, onOrganizer }: { title: string; subtitle: string; label: string; value: string; onChange: (value: string) => void; onSubmit: (event: FormEvent) => void; error: string; busy: boolean; onOrganizer: () => void }) {
  return <motion.section className="center-page" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><div className="login-card"><div className="login-emblem"><LockKeyhole size={25} /></div><span className="eyebrow">Navidad “Colmadon 2.0”</span><h2>{title}</h2><p>{subtitle}</p><form onSubmit={onSubmit}><label htmlFor="access">{label}</label><input id="access" value={value} onChange={(event) => onChange(event.target.value)} autoComplete="one-time-code" placeholder="Escribe tu código" />{error && <div className="error-message" role="alert">{error}</div>}<button className="primary-button full" disabled={busy}>{busy ? 'VALIDANDO…' : 'INGRESAR'} <ArrowRight size={17} /></button></form><div className="privacy-note"><ShieldCheck size={16} /><span>Tu acceso es privado y seguro.</span></div><div className="organizer-entry"><span>¿Eres el organizador?</span><button className="link-button" onClick={onOrganizer}><WandSparkles size={13} /> Entrar al panel</button></div></div></motion.section>
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [setup, setSetup] = useState(false); const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [setupKey, setSetupKey] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { if (setup) { await request('/api/admin/setup', { method: 'POST', headers: { 'x-admin-setup-key': setupKey }, body: JSON.stringify({ username, password }) }); setSetup(false); setError('Administrador creado. Ahora inicia sesión.'); } else { const data = await request<{ token: string }>('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) }); sessionStorage.setItem('navidad_admin_session', data.token); onSuccess() } } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo completar el acceso.') } finally { setBusy(false) } }
  return <motion.section className="center-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="login-card"><div className="card-icon"><KeyRound size={22} /></div><span className="eyebrow">Área del organizador</span><h2>{setup ? 'Configurar administrador' : 'Panel administrativo'}</h2><p>{setup ? 'Usa la clave de configuración de Cloudflare solo una vez.' : 'Gestiona participantes, platos y publicación del evento.'}</p><form onSubmit={submit}><label>Usuario</label><input value={username} onChange={(event) => setUsername(event.target.value)} required /><label>Contraseña</label><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />{setup && <><label>ADMIN_SETUP_KEY</label><input type="password" value={setupKey} onChange={(event) => setSetupKey(event.target.value)} required /></>}{error && <div className="error-message">{error}</div>}<button className="primary-button full" disabled={busy}>{busy ? 'PROCESANDO…' : setup ? 'CREAR ADMINISTRADOR' : 'ENTRAR AL PANEL'} <ArrowRight size={17} /></button></form><button className="link-button" onClick={() => { setSetup(!setup); setError('') }}>{setup ? 'Ya tengo administrador' : 'Configuración inicial'}</button></div></motion.section>
}

function ParticipantDashboard({ name, revealed, onReveal }: { name: string; revealed: Partial<Record<Reveal, string>>; onReveal: (kind: Reveal) => Promise<void> }) {
  return <motion.section className="dashboard-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="dashboard-heading"><div><h2>Hola, <em>{name}</em></h2></div><div className="status-pill"><span /> Evento publicado</div></div><div className="experience-grid"><ExperienceCard type="angelito" result={revealed.angelito} onReveal={onReveal} /><ExperienceCard type="food" result={revealed.food} onReveal={onReveal} /></div></motion.section>
}

function ExperienceCard({ type, result, onReveal }: { type: Reveal; result?: string; onReveal: (kind: Reveal) => Promise<void> }) {
  const angelito = type === 'angelito'; const [busy, setBusy] = useState(false)
  const click = async () => { setBusy(true); try { await onReveal(type) } finally { setBusy(false) } }
  return <motion.article className={`experience-card ${angelito ? 'card-green' : 'card-red'}`} whileHover={{ y: -5 }}><div className="card-topline"><span>{result ? <><Check size={14} /> Revelado</> : 'Pendiente'}</span></div><div className="experience-icon">{angelito ? <Gift size={26} /> : <ChefHat size={26} />}</div><h3>{angelito ? 'Mi Angelito' : 'Mi plato navideño'}</h3><p>{angelito ? 'Descubre a quién tendrás que sorprender. El precio mínimo del regalo es RD$500.' : 'Descubre qué plato te corresponde llevar a la celebración y comparte tu aporte.'}</p>{result ? <div className="revealed-result"><Sparkles size={17} /><span><strong>{result}</strong><small>{angelito ? 'Tu Angelito' : 'Tu plato navideño'}</small></span></div> : <button className="outline-button" disabled={busy} onClick={() => void click()}>{busy ? 'CARGANDO…' : angelito ? 'GIRAR RULETA' : 'DESCUBRIR MI PLATO'} <ArrowRight size={16} /></button>}</motion.article>
}

function AdminDashboard({ onError }: { onError: (message: string) => void }) {
  const [data, setData] = useState<AdminData | null>(null); const [name, setName] = useState(''); const [dish, setDish] = useState(''); const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const adminToken = sessionStorage.getItem('navidad_admin_session') ?? ''
  const load = async () => { try { setData(await request<AdminData>('/api/admin/dashboard', {}, adminToken)) } catch (caught) { onError(caught instanceof Error ? caught.message : 'No se pudo cargar el panel.') } }
  useEffect(() => { void load() }, [])
  const add = async (kind: 'participant' | 'dish') => { setBusy(true); try { if (kind === 'participant') { const result = await request<{ code: string }>('/api/admin/participants', { method: 'POST', body: JSON.stringify({ fullName: name }) }, adminToken); setCode(result.code); setName('') } else { await request('/api/admin/dishes', { method: 'POST', body: JSON.stringify({ name: dish }) }, adminToken); setDish('') }; await load() } catch (caught) { onError(caught instanceof Error ? caught.message : 'No se pudo guardar.') } finally { setBusy(false) } }
  const publish = async () => { if (!window.confirm('¿Publicar el evento? Esta acción fija ambos sorteos.')) return; setBusy(true); try { await request('/api/admin/events/main/publish', { method: 'POST' }, adminToken); await load() } catch (caught) { onError(caught instanceof Error ? caught.message : 'No se pudo publicar.') } finally { setBusy(false) } }
  const reset = async () => { if (!window.confirm('¿Reiniciar el sorteo? Se eliminarán todos los resultados, pero se conservarán participantes y platos. Esta acción no se puede deshacer.')) return; setBusy(true); try { await request('/api/admin/events/main/reset', { method: 'POST' }, adminToken); await load() } catch (caught) { onError(caught instanceof Error ? caught.message : 'No se pudo reiniciar.') } finally { setBusy(false) } }
  if (!data) return <section className="center-page"><div className="login-card"><p>Cargando panel…</p></div></section>
  const draft = data.event.status === 'draft'
  const remove = async (kind: 'participants' | 'dishes', itemId: string) => { if (!window.confirm('¿Eliminar este registro?')) return; try { await request(`/api/admin/${kind}/${itemId}`, { method: 'DELETE' }, adminToken); await load() } catch (caught) { onError(caught instanceof Error ? caught.message : 'No se pudo eliminar.') } }
  return <motion.section className="admin-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="dashboard-heading"><div><span className="eyebrow">Área del organizador</span><h2>Panel de <em>control.</em></h2><p>{data.event.name}</p></div><div className={`status-pill ${draft ? '' : 'published'}`}><span /> {draft ? 'Borrador' : 'Publicado'}</div></div><div className="admin-stats"><Stat icon={<Users size={18} />} label="Participantes" value={`${data.participants.length}/10`} /><Stat icon={<UtensilsCrossed size={18} />} label="Platos" value={`${data.dishes.length}/10`} /><Stat icon={<Gift size={18} />} label="Angelitos revelados" value={`${data.progress?.angelito ?? 0}/10`} /><Stat icon={<ChefHat size={18} />} label="Platos revelados" value={`${data.progress?.food ?? 0}/10`} /></div><div className="admin-grid"><section className="admin-panel"><h3>Participantes</h3>{draft && <div className="admin-form"><input placeholder="Nombre completo" value={name} onChange={(event) => setName(event.target.value)} /><button className="outline-button" disabled={busy || !name.trim()} onClick={() => void add('participant')}>AGREGAR</button></div>}{code && <div className="generated-code"><span>Código generado: <strong>{code}</strong></span><button className="link-button" onClick={() => void navigator.clipboard.writeText(code)}>Copiar</button></div>}<ul className="admin-list">{data.participants.map((participant, index) => <li key={participant.id}><span>{index + 1}. {participant.full_name}</span>{draft ? <button className="link-button danger" onClick={() => void remove('participants', participant.id)}>Eliminar</button> : <Check size={15} />}</li>)}</ul></section><section className="admin-panel"><h3>Platos navideños</h3>{draft && <div className="admin-form"><input placeholder="Nombre del plato" value={dish} onChange={(event) => setDish(event.target.value)} /><button className="outline-button" disabled={busy || !dish.trim()} onClick={() => void add('dish')}>AGREGAR</button></div>}<ul className="admin-list">{data.dishes.map((item, index) => <li key={item.id}><span>{index + 1}. {item.name}</span>{draft ? <button className="link-button danger" onClick={() => void remove('dishes', item.id)}>Eliminar</button> : <Check size={15} />}</li>)}</ul></section></div>{draft ? <button className="primary-button publish-button" disabled={busy || data.participants.length !== 10 || data.dishes.length !== 10} onClick={() => void publish()}>{busy ? 'PROCESANDO…' : 'PUBLICAR EVENTO Y GENERAR SORTEOS'} <WandSparkles size={17} /></button> : <button className="reset-button" disabled={busy} onClick={() => void reset()}>{busy ? 'REINICIANDO…' : 'REINICIAR SORTEO'} <WandSparkles size={17} /></button>}</motion.section>
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="stat-card">{icon}<small>{label}</small><strong>{value}</strong></div> }

export default App
