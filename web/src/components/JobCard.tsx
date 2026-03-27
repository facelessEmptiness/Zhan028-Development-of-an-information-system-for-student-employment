import { Link } from 'react-router-dom';
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

const JobCard = ({
  id,
  title,
  company,
  location,
  salary,
  type,
  matchIndex,
  description,
  skills,
  postedDate,
  applicants,
  onClick,
}: JobCardProps) => {
  const salaryText = `${salary.min.toLocaleString()} – ${salary.max.toLocaleString()} ₸`;

  return (
    <Link
      to={`/job/${id}`}
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-all job-card-hover block"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
          <p className="text-gray-600 text-sm mb-2">{company}</p>
        </div>
        {matchIndex !== undefined && (
          <div className="ml-4">
            <MatchIndex percentage={matchIndex} size="sm" showLabel={false} />
          </div>
        )}
      </div>

      <p className="text-gray-700 mb-4 line-clamp-2">{description}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {skills.slice(0, 3).map((skill, idx) => (
          <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
            {skill}
          </span>
        ))}
        {skills.length > 3 && (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">
            +{skills.length - 3} more
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
        <div>
          <p className="text-xs text-gray-500 mb-1">Location</p>
          <p className="text-sm font-semibold text-gray-900">📍 {location}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Salary</p>
          <p className="text-sm font-semibold text-gray-900">{salaryText}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Type</p>
          <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded font-medium">
            {type}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Posted</p>
          <p className="text-sm font-semibold text-gray-900">{postedDate}</p>
        </div>
      </div>

      {applicants !== undefined && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">{applicants} applications received</p>
        </div>
      )}
    </Link>
  );
};

export default JobCard;
