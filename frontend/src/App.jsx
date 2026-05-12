import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Menu from './pages/Menu';
import Login from './pages/Login';
import Perfil from './pages/Perfil';
import VisualizarTabs from './pages/VisualizarTabs';
import CriarTabs from './pages/CriarTabs';
import EditarTabs from './pages/EditarTabs';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/login" element={<Login />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/VisualizarTabs" element={<VisualizarTabs />} />
        <Route path="/CriarTabs" element={<CriarTabs />} />
        <Route path="/EditarTabs" element={<EditarTabs />} />
      </Routes>
    </Router>
  );
}

export default App;