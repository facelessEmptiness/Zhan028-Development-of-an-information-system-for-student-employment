import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context';
import Icon from '../components/Icon';
import type { IconName } from '../components/icons';
import { getUniversities, type University } from '../services/universityService';
import LanguageSelector from '../components/LanguageSelector';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'student' as 'student' | 'employer' | 'university',
    university: '',
    company: '',
  });
  const [universities, setUniversities] = useState<University[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const passwordStrength = useMemo(() => {
    if (!formData.password) return { level: 0, text: '', color: '' };
    let strength = 0;
    if (formData.password.length >= 8) strength++;
    if (formData.password.length >= 10) strength++;
    if (/[A-Z]/.test(formData.password)) strength++;
    if (/[0-9]/.test(formData.password)) strength++;
    if (/[^A-Za-z0-9]/.test(formData.password)) strength++;
    if (strength <= 2) return { level: 1, text: t('auth.register.weak'), color: 'bg-red-500' };
    if (strength <= 3) return { level: 2, text: t('auth.register.medium'), color: 'bg-yellow-500' };
    return { level: 3, text: t('auth.register.strong'), color: 'bg-green-500' };
  }, [formData.password, t]);

  const passwordsMatch = formData.password === formData.confirmPassword;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error(t('auth.register.errors.passwordsMismatch'));
      return;
    }
    if (formData.password.length < 8) {
      toast.error(t('auth.register.errors.passwordTooShort'));
      return;
    }
    if (formData.role === 'university' && !formData.university) {
      toast.error(t('auth.register.errors.selectUniversity'));
      return;
    }

    setIsLoading(true);
    try {
      const response = await register({
        email: formData.email,
        password: formData.password,
        role: formData.role,
        university_id: formData.university || undefined,
      });
      if (formData.role === 'student') {
        localStorage.setItem('reg_first_name', formData.firstName);
        localStorage.setItem('reg_last_name', formData.lastName);
        if (formData.university) localStorage.setItem('reg_university_id', formData.university);
      }
      toast.success(t('auth.register.success'));
      navigate(`/verify-email?email=${encodeURIComponent(response.email)}`);
    } catch (err) {
      toast.error(t('auth.register.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const roles = [
    {
      value: 'student',
      label: t('auth.register.roles.student'),
      desc: t('auth.register.roles.studentDesc'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      value: 'employer',
      label: t('auth.register.roles.employer'),
      desc: t('auth.register.roles.employerDesc'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      value: 'university',
      label: t('auth.register.roles.university'),
      desc: t('auth.register.roles.universityDesc'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5m0 0l9 5m-9-5v10l9 5m0 0l9-5m-9 5v-10m0 0l-9-5m9 5l9-5M7 11.5v10m10-10v10" />
        </svg>
      ),
    },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Nav */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2 w-fit">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-gray-900">CareerBond</span>
        </Link>
        <LanguageSelector />
      </div>

      <div className="flex-1 flex">
        {/* Left — Blue gradient banner */}
        <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-r from-blue-600 to-indigo-600 p-12 flex-col justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
              {t('auth.register.heroTitle')}
            </h1>
            <p className="text-blue-100 text-lg leading-relaxed">
              {t('auth.register.heroSubtitle')}
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: 'graduation-cap' as IconName, text: t('auth.register.feature1') },
              { icon: 'briefcase'      as IconName, text: t('auth.register.feature2') },
              { icon: 'building'       as IconName, text: t('auth.register.feature3') },
            ].map((item) => (
              <div key={item.text} className="flex items-start space-x-3 bg-white/20 rounded-xl p-4">
                <Icon name={item.icon} size={20} className="shrink-0 text-white" />
                <p className="text-white text-sm leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Form */}
        <div className="flex-1 flex items-center justify-center p-6 py-10">
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center justify-center space-x-2 mb-8">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-2xl font-bold text-gray-900">CareerBond</span>
            </div>

            {/* Form Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('auth.register.title')}</h2>
              <p className="text-gray-500 text-sm mb-6">{t('auth.register.subtitle')}</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Role selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.register.iAm')}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {roles.map((r) => (
                      <label
                        key={r.value}
                        className={`flex sm:flex-col items-center gap-3 sm:gap-0 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          formData.role === r.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={r.value}
                          checked={formData.role === r.value}
                          onChange={handleChange}
                          className="sr-only"
                        />
                        <span className={`sm:mb-1 ${formData.role === r.value ? 'text-blue-600' : 'text-gray-400'}`}>
                          {r.icon}
                        </span>
                        <div className="sm:text-center">
                          <span className="text-xs font-semibold block">{r.label}</span>
                          <span className="text-xs text-gray-400 hidden sm:block">{r.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">
                      {t('auth.register.firstName')}
                    </label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={handleChange}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder={t('auth.register.firstNamePlaceholder')}
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">
                      {t('auth.register.lastName')}
                    </label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={handleChange}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder={t('auth.register.lastNamePlaceholder')}
                    />
                  </div>
                </div>

                {/* University (for student / university) */}
                {(formData.role === 'student' || formData.role === 'university') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {formData.role === 'university' ? t('auth.register.yourUniversity') : t('auth.register.university')}
                    </label>
                    <select
                      value={formData.university}
                      onChange={(e) => setFormData((prev) => ({ ...prev, university: e.target.value }))}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white"
                    >
                      <option value="">{t('auth.register.selectUniversity')}</option>
                      {Object.entries(groupedByCity).map(([city, unis]) => (
                        <optgroup key={city} label={city}>
                          {unis
                            .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
                            .map((uni) => (
                              <option key={uni.id} value={uni.id}>
                                {uni.name}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                )}

                {/* Company (for employer) */}
                {formData.role === 'employer' && (
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1.5">
                      {t('auth.register.companyName')}
                    </label>
                    <input
                      id="company"
                      name="company"
                      type="text"
                      required
                      value={formData.company}
                      onChange={handleChange}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder={t('auth.register.companyNamePlaceholder')}
                    />
                  </div>
                )}

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="example@mail.com"
                  />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('auth.register.password')}
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full px-3 py-3 pr-12 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder={t('auth.register.passwordPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Password strength bar */}
                  {formData.password && (
                    <div className="mt-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-500">{t('auth.register.passwordStrength')}</span>
                        <span className={`text-xs font-medium ${passwordStrength.level === 1 ? 'text-red-500' : passwordStrength.level === 2 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {passwordStrength.text}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                          style={{ width: `${(passwordStrength.level / 3) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('auth.register.confirmPassword')}
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`w-full px-3 py-3 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      formData.confirmPassword && !passwordsMatch ? 'border-red-400' : 'border-gray-300'
                    }`}
                    placeholder={t('auth.register.confirmPasswordPlaceholder')}
                  />
                  {formData.confirmPassword && !passwordsMatch && (
                    <p className="mt-1 text-xs text-red-500">{t('auth.register.errors.passwordsMismatch')}</p>
                  )}
                </div>

                {/* Terms */}
                <div className="flex items-start space-x-3">
                  <input
                    id="terms"
                    type="checkbox"
                    required
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="terms" className="text-sm text-gray-600">
                    {t('auth.register.iAccept')}{' '}
                    <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">{t('auth.register.terms')}</a>
                    {' '}и{' '}
                    <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">{t('auth.register.privacy')}</a>
                  </label>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading || !agreedToTerms}
                  className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>{t('auth.register.submitting')}</span>
                    </>
                  ) : (
                    <span>{t('auth.register.submit')}</span>
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                {t('auth.register.haveAccount')}{' '}
                <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700">
                  {t('auth.register.loginLink')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
