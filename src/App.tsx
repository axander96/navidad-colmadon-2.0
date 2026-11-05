import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  ChefHat,
  Gift,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  WandSparkles,
} from 'lucide-react'
import { useState } from 'react'
import './App.css'

type View = 'home' | 'login' | 'dashboard' | 'admin'
type Reveal = 'angelito' | 'food'

const API_URL = import.meta.env.VITE_API_URL ?? ''

async function authenticate(code: string) {
  if (!API_URL) {
    throw new Error('La API todavía no está configurada. Define VITE_API_URL para conectar Cloudflare Workers.')
  }
  const response = await fetch(`${API_URL}/api/auth/participant`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  const payload = (await response.json()) as { success?: boolean; message?: string; data?: { token: string } }
  if (!response.ok || !payload.success) throw new Error(payload.message ?? 'No pudimos validar tu código.')
  return payload.data as { token: string }
}

function App() {
  const [view, setView] = useState<View>('home')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revealed, setRevealed] = useState<Reveal | null>(null)
  const [results, setResults] = useState<Partial<Record<Reveal, string>>>({})

  const login = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (code.trim().length < 6) {
      setError('Escribe el código personal que te entregó el organizador.')
      return
    }
    setBusy(true)
    try {
      const session = await authenticate(code.trim())
      sessionStorage.setItem('navidad_session', session.token)
      setView('dashboard')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos iniciar sesión.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <header className="topbar">
        <button className="brand" onClick={() => setView('home')} aria-label="Volver al inicio">
          <span className="brand-mark"><Sparkles size={16} /></span>
          <span>Navidad <strong>Colmadon 2.0</strong></span>
        </button>
        <div className="topbar-actions">
          {view !== 'home' && <button className="quiet-button" onClick={() => setView('home')}>Inicio</button>}
          {view === 'dashboard' && <button className="quiet-button" onClick={() => { setView('home'); setCode('') }}><LogOut size={15} /> Salir</button>}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {view === 'home' && (
          <motion.section className="hero-page" key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="hero-copy">
              <span className="eyebrow"><span className="eyebrow-dot" /> Una celebración para compartir</span>
              <h1>La magia de la Navidad<br /><em>se vive juntos.</em></h1>
              <p className="hero-description">Un momento especial, dos sorpresas y toda la alegría de nuestro Colmadón. Descubre tu misión para esta Navidad.</p>
              <button className="primary-button" onClick={() => setView('login')}>
                ENTRAR A LA EXPERIENCIA <ArrowRight size={18} />
              </button>
              <p className="helper-text"><LockKeyhole size={13} /> Tu código personal mantiene tu sorpresa privada</p>
            </div>
            <div className="hero-art" aria-label="Ilustración navideña">
              <div className="orbit orbit-one" /><div className="orbit orbit-two" />
              <motion.div className="gift gift-back" animate={{ y: [0, -8, 0], rotate: [-3, 0, -3] }} transition={{ duration: 4, repeat: Infinity }}><Gift size={62} /></motion.div>
              <motion.div className="tree" animate={{ y: [0, -5, 0] }} transition={{ duration: 5, repeat: Infinity }}>
                <div className="star">✦</div><div className="tree-layer layer-one" /><div className="tree-layer layer-two" /><div className="tree-layer layer-three" /><div className="tree-trunk" />
              </motion.div>
              <motion.div className="gift gift-front" animate={{ y: [0, 7, 0] }} transition={{ duration: 3.5, repeat: Infinity }}><Gift size={48} /></motion.div>
              <div className="art-label"><Sparkles size={14} /> Felices fiestas</div>
            </div>
          </motion.section>
        )}

        {view === 'login' && (
          <motion.section className="center-page" key="login" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <div className="login-card">
              <div className="card-icon"><LockKeyhole size={22} /></div>
              <span className="eyebrow">Acceso privado</span>
              <h2>Tu sorpresa te espera</h2>
              <p>Introduce el código personal que recibiste para entrar a la experiencia.</p>
              <form onSubmit={login}>
                <label htmlFor="code">Código personal</label>
                <input id="code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Ej. NAVIDAD2025" autoComplete="one-time-code" />
                {error && <div className="error-message" role="alert">{error}</div>}
                <button className="primary-button full" disabled={busy}>{busy ? 'VALIDANDO…' : 'INGRESAR'} <ArrowRight size={17} /></button>
              </form>
              <div className="privacy-note"><ShieldCheck size={16} /><span>Solo tú podrás ver tus resultados.</span></div>
            </div>
          </motion.section>
        )}

        {view === 'dashboard' && (
          <motion.section className="dashboard-page" key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="dashboard-heading">
              <div><span className="eyebrow">Tu espacio personal</span><h2>Hola, <em>participante.</em></h2><p>Tu Navidad comienza con dos pequeñas sorpresas.</p></div>
              <div className="status-pill"><span /> Evento publicado</div>
            </div>
            <div className="experience-grid">
              <ExperienceCard type="angelito" revealed={revealed === 'angelito'} result={results.angelito} onReveal={async () => {
                const result = await revealResult('angelito')
                setResults((current) => ({ ...current, angelito: result }))
                setRevealed('angelito')
              }} />
              <ExperienceCard type="food" revealed={revealed === 'food'} result={results.food} onReveal={async () => {
                const result = await revealResult('food')
                setResults((current) => ({ ...current, food: result }))
                setRevealed('food')
              }} />
            </div>
            <div className="dashboard-footer"><ShieldCheck size={15} /> Los resultados son definitivos y están protegidos en el servidor.</div>
          </motion.section>
        )}

        {view === 'admin' && <AdminPreview key="admin" />}
      </AnimatePresence>

      <footer className="footer"><span>Navidad “Colmadon 2.0”</span><span>Hecho para compartir lo que importa <span className="heart">♥</span></span></footer>
    </main>
  )
}

async function revealResult(kind: Reveal) {
  const session = sessionStorage.getItem('navidad_session')
  if (!API_URL || !session) throw new Error('Tu sesión ha caducado. Vuelve a ingresar.')
  const response = await fetch(`${API_URL}/api/participant/reveal/${kind}`, { method: 'POST', headers: { authorization: `Bearer ${session}` } })
  const payload = (await response.json()) as { success?: boolean; message?: string; data?: { result: string } }
  if (!response.ok || !payload.success || !payload.data) throw new Error(payload.message ?? 'No pudimos revelar tu resultado.')
  return payload.data.result
}

function ExperienceCard({ type, revealed, result, onReveal }: { type: Reveal; revealed: boolean; result?: string; onReveal: () => Promise<void> }) {
  const angelito = type === 'angelito'
  return (
    <motion.article className={`experience-card ${angelito ? 'card-green' : 'card-gold'}`} whileHover={{ y: -5 }}>
      <div className="card-topline"><span className="card-number">0{angelito ? 1 : 2}</span><span>{revealed ? <><Check size={14} /> Revelado</> : 'Pendiente'}</span></div>
      <div className="experience-icon">{angelito ? <Gift size={26} /> : <ChefHat size={26} />}</div>
      <h3>{angelito ? 'Mi Angelito' : 'Mi plato navideño'}</h3>
      <p>{angelito ? 'Descubre a quién tendrás que sorprender con un regalo esta Navidad.' : 'Descubre qué plato te corresponde llevar a la celebración.'}</p>
      {revealed ? <div className="revealed-result"><Sparkles size={17} /><span><strong>{result}</strong><small>{angelito ? 'Tu Angelito' : 'Tu plato navideño'}</small></span></div> : <button className="outline-button" onClick={() => void onReveal()}>{angelito ? 'GIRAR RULETA' : 'DESCUBRIR MI PLATO'} <ArrowRight size={16} /></button>}
    </motion.article>
  )
}

function AdminPreview() {
  return <motion.section className="center-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="login-card"><div className="card-icon"><WandSparkles size={22} /></div><span className="eyebrow">Administración</span><h2>Panel de organización</h2><p>El panel administrativo se habilita cuando conectes el Worker y configures el acceso inicial.</p><div className="privacy-note"><UtensilsCrossed size={16} /><span>La configuración no utiliza datos ficticios.</span></div></div></motion.section>
}

export default App
