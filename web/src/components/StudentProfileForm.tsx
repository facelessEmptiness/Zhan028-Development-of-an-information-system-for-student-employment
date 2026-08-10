import { useState, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateStudentProfileRequest } from '../types/auth';
import { getUniversities, type University } from '../services/universityService';

interface StudentProfileFormProps {
  onSubmit: (data: CreateStudentProfileRequest) => Promise<void>;
  isLoading?: boolean;
}

export const StudentProfileForm = ({ onSubmit, isLoading = false }: StudentProfileFormProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    iin: '',
    university_id: '',
  });
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [universities, setUniversities] = useState<University[]>([]);

  useEffect(() => {
    getUniversities().then(setUniversities);
  }, []);

  const groupedByCity = universities
    .sort((a, b) => a.city.localeCompare(b.city, 'ru'))
    .reduce<Record<string, University[]>>((acc, u) => {
      if (!acc[u.city]) acc[u.city] = [];
      acc[u.city].push(u);
      return acc;
    }, {});

  const validateIIN = (iin: string): string | null => {
    if (iin.length !== 12 || !/^\d{12}$/.test(iin)) {
      return t('profile.iinError.format');
    }
    const d = iin.split('').map(Number);
    const w1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    let sum = w1.reduce((acc, w, i) => acc + d[i] * w, 0);
    let check = sum % 11;
    if (check === 10) {
      const w2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];
      sum = w2.reduce((acc, w, i) => acc + d[i] * w, 0);
      check = sum % 11;
    }
    if (check === 10 || check !== d[11]) {
      return t('profile.iinError.checksum');
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const iinError = validateIIN(formData.iin);
    if (iinError) {
      setError(iinError);
      return;
    }

    if (!formData.first_name || !formData.last_name) {
      setError(t('profile.form.requiredFields'));
      return;
    }

    try {
      const requestData: CreateStudentProfileRequest = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        iin: formData.iin,
        ...(formData.university_id && { university_id: formData.university_id }),
      };
      await onSubmit(requestData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.toast.errorSaving'));
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
          {t('profile.form.iin')} *
        </label>
        <div className="relative">
          <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'iin' ? 'text-emerald-400' : 'text-gray-400'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="first_name" className="block text-sm font-medium text-emerald-100 mb-2">
            {t('auth.register.firstName')} *
          </label>
          <div className="relative">
            <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'first_name' ? 'text-emerald-400' : 'text-gray-400'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <input
              id="first_name"
              name="first_name"
              type="text"
              placeholder={t('auth.register.firstNamePlaceholder')}
              value={formData.first_name}
              onChange={handleChange}
              onFocus={() => setFocusedField('first_name')}
              onBlur={() => setFocusedField(null)}
              className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 input-animated backdrop-blur-sm"
            />
            {formData.first_name && (
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="last_name" className="block text-sm font-medium text-emerald-100 mb-2">
            {t('auth.register.lastName')} *
          </label>
          <div className="relative">
            <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'last_name' ? 'text-emerald-400' : 'text-gray-400'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <input
              id="last_name"
              name="last_name"
              type="text"
              placeholder={t('auth.register.lastNamePlaceholder')}
              value={formData.last_name}
              onChange={handleChange}
              onFocus={() => setFocusedField('last_name')}
              onBlur={() => setFocusedField(null)}
              className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 input-animated backdrop-blur-sm"
            />
            {formData.last_name && (
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* University (Optional) */}
      <div>
        <label className="block text-sm font-medium text-emerald-100 mb-2">
          {t('auth.register.yourUniversity')}
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <select
            value={formData.university_id}
            onChange={(e) => setFormData(prev => ({ ...prev, university_id: e.target.value }))}
            onFocus={() => setFocusedField('university_id')}
            onBlur={() => setFocusedField(null)}
            className="w-full pl-12 pr-4 py-3.5 bg-slate-800 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 appearance-none cursor-pointer"
          >
            <option value="" className="bg-slate-800 text-gray-400">{t('auth.register.selectUniversity')}</option>
            {Object.entries(groupedByCity).map(([city, unis]) => (
              <optgroup key={city} label={city} className="bg-slate-800">
                {unis.sort((a, b) => a.name.localeCompare(b.name, 'ru')).map((uni) => (
                  <option key={uni.id} value={uni.id} className="bg-slate-800 text-white">
                    {uni.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
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
            <span>{t('common.saving')}</span>
          </>
        ) : (
          <>
            <span>{t('profile.form.saveBtn')}</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </>
        )}
      </button>
    </form>
  );
};
