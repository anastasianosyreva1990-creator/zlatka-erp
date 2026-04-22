import { useState } from 'react'
import { signIn } from '../lib/auth'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email || !password) { setError('Заполните все поля'); return }
    setLoading(true)
    setError('')
    try {
      await signIn(email, password)
      onLogin()
    } catch(e) {
      setError('Неверный email или пароль')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F0EBE1', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:360 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <svg width="60" height="32" viewBox="0 0 60 32" fill="none" style={{ display:'block', margin:'0 auto 12px' }}>
            <path d="M18 28 Q30 8 42 28" stroke="rgba(196,168,130,0.8)" strokeWidth="1.5" fill="rgba(196,168,130,0.1)"/>
            <line x1="13" y1="28" x2="47" y2="28" stroke="#C4A882" strokeWidth="2"/>
            <circle cx="30" cy="9" r="2.5" fill="rgba(196,168,130,0.6)"/>
          </svg>
          <div style={{ fontSize:28, fontWeight:800, color:'#1C2E26' }}>
            Злат<span style={{ color:'#C4A882' }}>ка</span>
          </div>
          <div style={{ fontSize:11, color:'#7A6A5A', letterSpacing:2.5, textTransform:'uppercase', marginTop:4, fontWeight:600 }}>
            Производство · Учёт
          </div>
        </div>
        <div style={{ background:'#fff', borderRadius:16, border:'0.5px solid rgba(74,111,82,0.15)', padding:'28px' }}>
          <div style={{ fontSize:16, fontWeight:700, color:'#1C2E26', marginBottom:20, textAlign:'center' }}>Вход в систему</div>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:'#4A3A2A', fontWeight:700, marginBottom:4 }}>Email</div>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="your@email.ru" onKeyDown={e=>e.key==='Enter'&&handleLogin()}
              style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(74,111,82,0.25)', borderRadius:8, fontSize:13 }}/>
          </div>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, color:'#4A3A2A', fontWeight:700, marginBottom:4 }}>Пароль</div>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&handleLogin()}
              style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(74,111,82,0.25)', borderRadius:8, fontSize:13 }}/>
          </div>
          {error && <div style={{ fontSize:12, color:'#6A1030', background:'#EED4DD', padding:'8px 12px', borderRadius:8, marginBottom:14, fontWeight:600 }}>{error}</div>}
          <button onClick={handleLogin} disabled={loading}
            style={{ width:'100%', padding:'10px', background:'#1C2E26', color:'#C4A882', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer' }}>
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </div>
        <div style={{ textAlign:'center', fontSize:11, color:'#9A8878', marginTop:20, fontWeight:600 }}>ЗЛАТКА · ERP · 2026</div>
      </div>
    </div>
  )
}
