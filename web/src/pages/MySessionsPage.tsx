import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context';
import { studentApi } from '../api/auth';
import { StudentProfileForm, EmployerProfileForm, UniversityProfileForm } from '../components';
import type { CreateStudentProfileRequest, EmployerProfile, UniversityProfile } from '../types/auth';

const MySessionsPage = () => {
  const navigate = useNavigate();
  const { user, accessToken, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  if (!user || !accessToken) {
    navigate('/login');
    return null;
  }

  const handleProfileSubmit = async (data: CreateStudentProfileRequest | EmployerProfile | UniversityProfile) => {
    setIsLoading(true);
    setSuccessMessage('');
    try {
      if (user.role === 'student') {
        await studentApi.createProfile(accessToken, data as CreateStudentProfileRequest);
      } else if (user.role === 'employer') {
        // TODO: Implement employer API when backend is ready
        console.warn('Employer profile API not implemented yet');
        throw new Error('Employer profile creation not available yet');
      } else if (user.role === 'university') {
        // TODO: Implement university API when backend is ready
        console.warn('University profile API not implemented yet');
        throw new Error('University profile creation not available yet');
      }
      setSuccessMessage('Profile created successfully!');
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      console.error('Profile creation failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleTitle = () => {
    switch (user.role) {
      case 'student':
        return 'Complete Your Student Profile';
      case 'employer':
        return 'Complete Your Employer Profile';
      case 'university':
        return 'Complete Your University Profile';
      default:
        return 'Complete Your Profile';
    }
  };

  const getRoleDescription = () => {
    switch (user.role) {
      case 'student':
        return 'Provide your personal information to get started with finding opportunities';
      case 'employer':
        return 'Enter your company details to start posting job opportunities';
      case 'university':
        return 'Provide your university information to manage campus activities';
      default:
        return 'Complete your profile information';
    }
  };

  const getRoleColor = () => {
    switch (user.role) {
      case 'student':
        return { bg: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/30' };
      case 'employer':
        return { bg: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-500/30' };
      case 'university':
        return { bg: 'from-purple-500 to-purple-600', shadow: 'shadow-purple-500/30' };
      default:
        return { bg: 'from-slate-500 to-slate-600', shadow: 'shadow-slate-500/30' };
    }
  };

  const roleColor = getRoleColor();

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
      {/* Main Content */}
      <div className="w-full flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-2xl animate-scale-in">
          {/* Header */}
          <div className="text-center mb-8 animate-fade-in-up">
            <h1 className="text-4xl font-bold text-white mb-3">{getRoleTitle()}</h1>
            <p className="text-emerald-200/70 text-lg">{getRoleDescription()}</p>
          </div>

          {/* Form Card */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
            {/* Success Message */}
            {successMessage && (
              <div className="mb-6 animate-fade-in-up bg-green-500/20 backdrop-blur-sm border border-green-500/30 text-green-200 p-4 rounded-xl flex items-center space-x-3">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{successMessage}</span>
              </div>
            )}

            {/* User Info Badge */}
            <div className="mb-8 flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 bg-gradient-to-br ${roleColor.bg} rounded-xl flex items-center justify-center shadow-lg`}>
                  {user.role === 'student' && (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  )}
                  {user.role === 'employer' && (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
                  {user.role === 'university' && (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-400">Logged in as</p>
                  <p className="text-white font-semibold">{user.email}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="text-sm px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
              >
                Logout
              </button>
            </div>

            {/* Role-specific Form */}
            {user.role === 'student' && (
              <StudentProfileForm onSubmit={handleProfileSubmit} isLoading={isLoading} />
            )}
            {user.role === 'employer' && (
              <EmployerProfileForm onSubmit={handleProfileSubmit} isLoading={isLoading} />
            )}
            {user.role === 'university' && (
              <UniversityProfileForm onSubmit={handleProfileSubmit} isLoading={isLoading} />
            )}

            {/* Skip Button */}
            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/')}
                className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MySessionsPage;
