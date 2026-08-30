import AnimatedMenuBar, { TOPBAR_CLEARANCE } from './AnimatedMenuBar';
import { limparSnapshotMenu } from '../utils/menuSnapshot';

export { TOPBAR_CLEARANCE };

// Barra de menu horizontal fixa no topo, usada em todas as páginas exceto a
// inicial. É um componente controlado: a própria página instancia
// `useAnimatedNavigate(true)` (começa expandida) e repassa `expanded` +
// `navigateAnimated` aqui — assim a página pode reusar o MESMO
// `navigateAnimated` para suas próprias navegações (redirecionamentos após
// salvar/excluir, links "Voltar ao menu" etc.), garantindo que a barra e o
// fade do conteúdo fiquem sempre em sincronia com qualquer navegação da tela,
// não só o clique no título.
//
// Clicar no título "HarmonicaTabs" encolhe a barra e só depois navega para
// "/" (mesma animação de encolhimento usada na tela inicial). onLogoClick,
// se passado, substitui esse comportamento por completo (usado por telas que
// precisam resetar estado local em vez de só navegar).
export default function TopBar({ expanded, navigateAnimated, onLogoClick }) {
  // Clicar no título é "ir pra home do zero": descarta o snapshot da tela de
  // resultados (senão o Menu remontaria com a última busca restaurada).
  const handleTitleClick = onLogoClick || (() => {
    limparSnapshotMenu();
    navigateAnimated('/', { expand: false });
  });

  return (
    <AnimatedMenuBar
      expanded={expanded}
      onTitleClick={handleTitleClick}
      onProfileClick={() => navigateAnimated('/Perfil', { expand: true })}
      onLoginClick={() => navigateAnimated('/login', { expand: true })}
    />
  );
}
