import packageJson from '../../package.json';
import './Footer.css';

export default function Footer() {
  const version = packageJson.version ?? '1.0.0';

  return (
    <footer className="footer">
      <div className="footer-inner">
        <span>Technisch Beheer KPS 2026. Programmed by: A. Levens</span>
        <span className="footer-version">v{version}</span>
      </div>
    </footer>
  );
}
