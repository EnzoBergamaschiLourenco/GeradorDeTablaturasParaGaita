import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Menu from './pages/Menu';
import Login from './pages/Login';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/login" element={<Login />} />
        {/* Futuramente adicione aqui rotas para cadastro e recuperação */}
      </Routes>
    </Router>
  );
}

export default App;