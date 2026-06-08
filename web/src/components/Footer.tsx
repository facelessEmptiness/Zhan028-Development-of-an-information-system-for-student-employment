import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const GITHUB_URL =
  'https://github.com/Zhan028/Zhan028-Development-of-an-information-system-for-student-employment';

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

          {/* Project */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('footer.project')}</h3>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.21 3.44 9.62 8.21 11.18.6.11.82-.25.82-.56 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.37-1.34-1.74-1.34-1.74-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.21 1.84 1.21 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.57-2.67-.3-5.47-1.31-5.47-5.81 0-1.28.47-2.33 1.24-3.15-.13-.3-.54-1.51.11-3.15 0 0 1.01-.32 3.3 1.2.96-.26 1.98-.39 3-.4 1.02.01 2.04.14 3 .4 2.28-1.52 3.29-1.2 3.29-1.2.65 1.64.24 2.85.12 3.15.77.82 1.23 1.87 1.23 3.15 0 4.51-2.81 5.5-5.49 5.79.43.36.81 1.09.81 2.2 0 1.59-.01 2.87-.01 3.26 0 .31.21.68.83.56C20.56 21.9 24 17.5 24 12.29 24 5.78 18.63.5 12 .5z" />
              </svg>
              {t('footer.sourceCode')}
            </a>
          </div>
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
