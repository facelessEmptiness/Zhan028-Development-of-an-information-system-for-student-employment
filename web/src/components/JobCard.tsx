import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MatchIndex from './MatchIndex';

interface JobCardProps {
  id: string | number;
  title: string;
  company: string;
  location: string;
  salary: { min: number; max: number };
  type: 'Full-time' | 'Part-time' | 'Internship' | 'Contract';
  matchIndex?: number;
  description: string;
  skills: string[];
  postedDate: string;
  applicants?: number;
  onClick?: () => void;
}

function getCompanyColor(company: string): string {
  const colors = ['#EF2D30','#00B74F','#FF7A00','#0033A0','#7C3AED','#2563EB','#E11D48','#0891B2'];
  return colors[company.charCodeAt(0) % colors.length];
}

const JobCard = ({ id, title, company, location, salary, type, matchIndex, description, skills, postedDate, onClick }: JobCardProps) => {
  const { t } = useTranslation();
  const color = getCompanyColor(company);
  const salaryText = salary.min > 0 || salary.max > 0
    ? `${salary.min > 0 ? salary.min.toLocaleString() : ''}${salary.min > 0 && salary.max > 0 ? ' – ' : ''}${salary.max > 0 ? salary.max.toLocaleString() + ' ₸' : ''}`
    : null;

  return (
    <Link
      to={`/job/${id}`}
      onClick={onClick}
      className="block bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all"
    >
      {/* Banner */}
      <div className="h-14 relative" style={{ background: `linear-gradient(135deg, ${color}30 0%, ${color}08 100%)` }}>
        <div className="absolute -bottom-5 left-5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm" style={{ background: color }}>
            {company.charAt(0).toUpperCase()}
          </div>
        </div>
        {matchIndex !== undefined && (
          <div className="absolute top-2 right-3">
            <MatchIndex percentage={matchIndex} size="sm" showLabel={false} />
          </div>
        )}
      </div>

      <div className="px-5 pt-7 pb-5">
        <h3 className="font-semibold text-gray-900 mb-0.5 leading-snug">{title}</h3>
        <p className="text-sm text-gray-500 mb-3">{company}{location ? ` · ${location}` : ''}</p>
        <p className="text-sm text-gray-700 line-clamp-2 mb-3">{description}</p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {skills.slice(0, 3).map((s) => (
            <span key={s} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">{s}</span>
          ))}
          {skills.length > 3 && (
            <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">+{skills.length - 3}</span>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-sm font-semibold text-gray-900">{salaryText}</span>
          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full font-medium">{type}</span>
        </div>

        <p className="text-[11px] text-gray-400 mt-2">{t('jobs.details.published')} {postedDate}</p>
      </div>
    </Link>
  );
};

export default JobCard;
