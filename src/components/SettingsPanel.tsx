import { WorldStats } from './WorldStats';
import { ProtectionPanel } from './ProtectionPanel';

export function SettingsPanel() {
  return (
    <div className="settings-panel">
      <div className="settings-heading">
        <p className="eyebrow">INFORMATIONS ET COMMANDES</p>
        <h2>Réglages</h2>
        <p>Retrouve ici les informations du monde et les touches de jeu.</p>
      </div>
      <WorldStats />
      <ProtectionPanel />
      <div className="controls-hint">
        <span><strong>WASD / FLÈCHES</strong> se déplacer / conduire</span>
        <span><strong>ESPACE</strong> sauter / remonter / voler</span>
        <span><strong>2× ESPACE</strong> activer / quitter le vol</span>
        <span><strong>MAJ</strong> accélérer</span>
        <span><strong>C</strong> plonger / descendre</span>
        <span><strong>B</strong> boutique</span>
        <span><strong>P / F5</strong> changer de caméra</span>
      </div>
    </div>
  );
}
