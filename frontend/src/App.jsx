import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Menu from './pages/Menu';
import Login from './pages/Login';
import Perfil from './pages/Perfil';
import VisualizarTabs from './pages/VisualizarTabs';
import CriarTabs from './pages/CriarTabs';
import MontarTablatura from './pages/MontarTablatura';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/Perfil" element={<Perfil />} />
        <Route path="/VisualizarTabs" element={<VisualizarTabs />} />
        <Route path="/CriarTabs" element={<CriarTabs />} />
        <Route path="/MontarTablatura" element={<MontarTablatura />} />
      </Routes>
    </Router>
  );
}

export default App;