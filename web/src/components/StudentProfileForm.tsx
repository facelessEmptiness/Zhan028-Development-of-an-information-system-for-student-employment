import { useState, type FormEvent } from 'react';
import type { StudentProfile } from '../types/auth';

interface StudentProfileFormProps {
  onSubmit: (data: StudentProfile) => Promise<void>;
  isLoading?: boolean;
}

export const StudentProfileForm = ({ onSubmit, isLoading = false }: StudentProfileFormProps) => {
  const [formData, setFormData] = useState<StudentProfile>({
    iin: '',
    lastName: '',
    firstName: '',
    middleName: '',
    phone: '',
    dateOfBirth: '',
  });
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.iin || formData.iin.length !== 12) {
      setError('IIN must be 12 digits');
      return;
    }

    if (!formData.firstName || !formData.lastName || !formData.phone || !formData.dateOfBirth) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="animate-fade-in-up bg-red-500/20 backdrop-blur-sm border border-red-500/30 text-red-200 p-4 rounded-xl flex items-center space-x-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* IIN */}
      <div>
        <label htmlFor="iin" className="block text-sm font-medium text-emerald-100 mb-2">
          Individual Identification Number (IIN) *
        </label>
        <div className="relative">
          <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'iin' ? 'text-emerald-400' : 'text-gray-400'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v10a2 2 0 002 2h5m0 0h5a2 2 0 002-2V8a2 2 0 00-2-2h-5m0 0V5a2 2 0 012-2h3.28a1 1 0 00.948-.684l1.498-4.493a1 1 0 00-.502-1.21l-.306-.102A1 1 0 009.07 1.695l-1.414 4.242" />
            </svg>
          </div>
          <input
            id="iin"
            name="iin"
            type="text"
            inputMode="numeric"
            placeholder="12-digit number"
            value={formData.iin}
            onChange={handleChange}
            onFocus={() => setFocusedField('iin')}
            onBlur={() => setFocusedField(null)}
            maxLength={12}
            className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 input-animated backdrop-blur-sm"
          />
          {formData.iin && formData.iin.length === 12 && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
              <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Name Fields */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-emerald-100 mb-2">
            Last Name *
          </label>
          <div className="relative">
            <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'lastName' ? 'text-emerald-400' : 'text-gray-400'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <input
              id="lastName"
              name="lastName"
              type="text"
              placeholder="Doe"
              value={formData.lastName}
              onChange={handleChange}
              onFocus={() => setFocusedField('lastName')}
              onBlur={() => setFocusedField(null)}
              className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 input-animated backdrop-blur-sm"
            />
            {formData.lastName && (
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-emerald-100 mb-2">
            First Name *
          </label>
          <div className="relative">
            <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'firstName' ? 'text-emerald-400' : 'text-gray-400'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <input
              id="firstName"
              name="firstName"
              type="text"
              placeholder="John"
              value={formData.firstName}
              onChange={handleChange}
              onFocus={() => setFocusedField('firstName')}
              onBlur={() => setFocusedField(null)}
              className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 input-animated backdrop-blur-sm"
            />
            {formData.firstName && (
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="middleName" className="block text-sm font-medium text-emerald-100 mb-2">
            Middle Name (Optional)
          </label>
          <div className="relative">
            <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'middleName' ? 'text-emerald-400' : 'text-gray-400'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <input
              id="middleName"
              name="middleName"
              type="text"
              placeholder="Michael"
              value={formData.middleName}
              onChange={handleChange}
              onFocus={() => setFocusedField('middleName')}
              onBlur={() => setFocusedField(null)}
              className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 input-animated backdrop-blur-sm"
            />
            {formData.middleName && (
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-emerald-100 mb-2">
          Phone Number *
        </label>
        <div className="relative">
          <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'phone' ? 'text-emerald-400' : 'text-gray-400'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 00.948.684l1.498 4.493a1 1 0 00-.502 1.21l-.306.102A1 1 0 009.07 14.695l1.414-4.242" />
            </svg>
          </div>
          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+7 (700) 123-45-67"
            value={formData.phone}
            onChange={handleChange}
            onFocus={() => setFocusedField('phone')}
            onBlur={() => setFocusedField(null)}
            className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 input-animated backdrop-blur-sm"
          />
          {formData.phone && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
              <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Date of Birth */}
      <div>
        <label htmlFor="dateOfBirth" className="block text-sm font-medium text-emerald-100 mb-2">
          Date of Birth *
        </label>
        <div className="relative">
          <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'dateOfBirth' ? 'text-emerald-400' : 'text-gray-400'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            value={formData.dateOfBirth}
            onChange={handleChange}
            onFocus={() => setFocusedField('dateOfBirth')}
            onBlur={() => setFocusedField(null)}
            className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 input-animated backdrop-blur-sm"
          />
          {formData.dateOfBirth && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
              <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 btn-animated disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Saving...</span>
          </>
        ) : (
          <>
            <span>Complete Profile</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </>
        )}
      </button>
    </form>
  );
};
