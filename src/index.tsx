import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MultiPost from './multi-post'
// 主应用组件
function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<MultiPost />} />
        <Route path="/multi-post" element={<MultiPost />} />
      </Routes>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);