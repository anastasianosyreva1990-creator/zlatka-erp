import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Production from './pages/Production'
import Batches from './pages/Batches'
import Purchases from './pages/Purchases'
import Wildberries from './pages/Wildberries'
import Finance from './pages/Finance'
import Documents from './pages/Documents'

function App() {
  return (
    <BrowserRouter>
      <div style={{display:'flex',minHeight:'100vh',fontFamily:'system-ui,sans-serif'}}>
        <nav style={{width:200,background:'#1a1a2e',padding:'1rem',flexShrink:0}}>
          <div style={{color:'#5DCAA5',fontSize:18,fontWeight:600,marginBottom:24}}>
            Златка
          </div>
          {[
            {to:'/',label:'Производство'},
            {to:'/batches',label:'Партии'},
            {to:'/purchases',label:'Закупки'},
            {to:'/wb',label:'Wildberries'},
            {to:'/finance',label:'Финансы'},
            {to:'/docs',label:'Документы'},
          ].map(item=>(
            <NavLink key={item.to} to={item.to} end={item.to==='/'} style={({isActive})=>({
              display:'block',padding:'8px 12px',marginBottom:4,borderRadius:8,
              color:isActive?'#5DCAA5':'#aaa',background:isActive?'rgba(93,202,165,0.1)':'transparent',
              textDecoration:'none',fontSize:14
            })}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main style={{flex:1,padding:'1.5rem',background:'#f8f9fa',overflowY:'auto'}}>
          <Routes>
            <Route path="/" element={<Production/>}/>
            <Route path="/batches" element={<Batches/>}/>
            <Route path="/purchases" element={<Purchases/>}/>
            <Route path="/wb" element={<Wildberries/>}/>
            <Route path="/finance" element={<Finance/>}/>
            <Route path="/docs" element={<Documents/>}/>
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
