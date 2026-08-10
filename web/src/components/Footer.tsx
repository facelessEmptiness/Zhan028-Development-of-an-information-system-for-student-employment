import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';



/* ─── Brand mark (matches the header logo) ─────────────────── */
function FooterLogo() {
  return (
    <svg viewBox="0 0 32 32" width={28} height={28} style={{ flexShrink: 0 }}>
      <rect width="32" height="32" rx="8" fill="#2563EB" />
      <path d="M10 13c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2v1h3v10H7V14h3v-1zm2 0v1h8v-1h-8z" fill="white" />
      <circle cx="16" cy="19" r="1.5" fill="#2563EB" />
    </svg>
  );
}

export default function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  const sectionLinks = [
    { to: '/',         label: t('footer.home')     },
    { to: '/jobs',     label: t('footer.jobs')     },
    { to: '/login',    label: t('footer.login')    },
    { to: '/register', label: t('footer.register') },
  ];

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">

          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2">
              <FooterLogo />
              <span className="text-lg font-bold">
                <span className="text-gray-900">Career</span>
                <span className="text-blue-600">Bond</span>
              </span>
            </Link>
            <p className="text-sm text-gray-500 mt-3 max-w-xs">{t('footer.tagline')}</p>
          </div>

          {/* Sections */}
          <nav>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('footer.sections')}</h3>
            <ul className="space-y-2">
              {sectionLinks.map(l => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center sm:text-left">
          <p className="text-xs text-gray-400">
            © {year} CareerBond. {t('footer.rights')}
          </p>
        </div>
      </div>
    </footer>
  );
}
