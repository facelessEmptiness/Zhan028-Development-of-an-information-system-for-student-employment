import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MatchIndex from './MatchIndex';

interface CandidateCardProps {
  id: number;
  name: string;
  email: string;
  university: string;
  major: string;
  matchIndex?: number;
  skills: string[];
  experience: string;
  resume: string;
  avatar?: string;
  status?: 'applied' | 'interview' | 'shortlisted' | 'rejected';
  onClick?: () => void;
}

const CandidateCard = ({
  id,
  name,
  email,
  university,
  major,
  matchIndex,
  skills,
  experience,
  resume,
  avatar,
  status,
  onClick,
}: CandidateCardProps) => {
  const { t } = useTranslation();

  const statusColors = {
    applied: 'bg-blue-50 text-blue-700 border-blue-200',
    interview: 'bg-purple-50 text-purple-700 border-purple-200',
    shortlisted: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
  };

  const statusLabels = {
    applied: `📝 ${t('candidate.status.applied')}`,
    interview: `📅 ${t('candidate.status.interview')}`,
    shortlisted: `⭐ ${t('candidate.status.shortlisted')}`,
    rejected: `❌ ${t('candidate.status.rejected')}`,
  };

  return (
    <Link
      to={`/candidate/${id}`}
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-all job-card-hover block"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-lg flex items-center justify-center text-white text-2xl font-bold">
            {avatar || name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
            <p className="text-sm text-gray-600">{email}</p>
            <p className="text-xs text-gray-500 mt-1">{university} • {major}</p>
          </div>
        </div>
        {matchIndex !== undefined && (
          <div className="ml-4">
            <MatchIndex percentage={matchIndex} size="sm" showLabel={false} />
          </div>
        )}
      </div>

      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">{t('candidate.about')}</p>
        <p className="text-sm text-gray-600">{experience}</p>
      </div>

      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">{t('candidate.skills')}</p>
        <div className="flex flex-wrap gap-2">
          {skills.slice(0, 4).map((skill, idx) => (
            <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
              {skill}
            </span>
          ))}
          {skills.length > 4 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">
              +{skills.length - 4}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t border-gray-200">
        <a
          href={resume}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors text-center"
        >
          📄 {t('common.download')}
        </a>
        {status && (
          <div
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border text-center ${statusColors[status]}`}
          >
            {statusLabels[status]}
          </div>
        )}
      </div>
    </Link>
  );
};

export default CandidateCard;
