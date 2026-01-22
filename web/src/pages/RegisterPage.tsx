import { useState, type FormEvent, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

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
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const passwordStrength = useMemo(() => {
    if (!formData.password) return { level: 0, text: '', color: '', tips: [] };
    let strength = 0;
    const tips: string[] = [];

    if (formData.password.length >= 8) strength++;
    else tips.push('At least 8 characters');

    if (formData.password.length >= 10) strength++;
    if (/[A-Z]/.test(formData.password)) strength++;
    else tips.push('Add uppercase letter');

    if (/[0-9]/.test(formData.password)) strength++;
    else tips.push('Add a number');

    if (/[^A-Za-z0-9]/.test(formData.password)) strength++;
    else tips.push('Add special character');

    if (strength <= 2) return { level: 1, text: 'Weak', color: 'bg-red-500', tips };
    if (strength <= 3) return { level: 2, text: 'Medium', color: 'bg-yellow-500', tips };
    return { level: 3, text: 'Strong', color: 'bg-green-500', tips: [] };
  }, [formData.password]);

  const passwordsMatch = formData.password === formData.confirmPassword;

  const formProgress = useMemo(() => {
    let completed = 0;
    if (formData.firstName) completed++;
    if (formData.lastName) completed++;
    if (formData.email && formData.email.includes('@')) completed++;
    if (formData.password && passwordStrength.level >= 2) completed++;
    if (formData.confirmPassword && passwordsMatch) completed++;
    if (agreedToTerms) completed++;
    return Math.round((completed / 6) * 100);
  }, [formData, passwordStrength, passwordsMatch, agreedToTerms]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      // Backend only accepts email, password, role
      await register({
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
      {/* Left side - Registration Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-lg animate-scale-in">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center space-x-2 mb-6 animate-fade-in-up">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">StudentJob</span>
          </div>

          {/* Form Card */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
            {/* Progress Bar */}
            <div className="mb-6 animate-fade-in-up">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-emerald-300">Registration progress</span>
                <span className="text-sm font-semibold text-white">{formProgress}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                  style={{ width: `${formProgress}%` }}
                ></div>
              </div>
            </div>

            <div className="text-center mb-6 animate-fade-in-up animation-delay-100">
              <h2 className="text-3xl font-bold text-white">Create your account</h2>
              <p className="text-emerald-200/70 mt-2">Start your journey to find the perfect job</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Message */}
              {error && (
                <div className="animate-fade-in-up bg-red-500/20 backdrop-blur-sm border border-red-500/30 text-red-200 p-4 rounded-xl flex items-center space-x-3">
                  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Role Selection */}
              <div className="animate-fade-in-up animation-delay-200">
                <label className="block text-sm font-medium text-emerald-100 mb-3">I am a</label>
                <div className="grid grid-cols-3 gap-3">
                  <label
                    className={`relative flex flex-col items-center p-4 rounded-xl cursor-pointer transition-all duration-300 ${
                      formData.role === 'student'
                        ? 'bg-emerald-500/30 border-2 border-emerald-400 shadow-lg shadow-emerald-500/20'
                        : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="student"
                      checked={formData.role === 'student'}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${
                      formData.role === 'student' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-white/10'
                    }`}>
                      <svg className={`w-5 h-5 transition-colors ${formData.role === 'student' ? 'text-white' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <span className={`text-xs font-medium ${formData.role === 'student' ? 'text-emerald-300' : 'text-gray-300'}`}>Student</span>
                    <span className="text-xs text-gray-400 mt-0.5">Seeking jobs</span>
                  </label>

                  <label
                    className={`relative flex flex-col items-center p-4 rounded-xl cursor-pointer transition-all duration-300 ${
                      formData.role === 'employer'
                        ? 'bg-blue-500/30 border-2 border-blue-400 shadow-lg shadow-blue-500/20'
                        : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="employer"
                      checked={formData.role === 'employer'}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${
                      formData.role === 'employer' ? 'bg-blue-500 shadow-lg shadow-blue-500/50' : 'bg-white/10'
                    }`}>
                      <svg className={`w-5 h-5 transition-colors ${formData.role === 'employer' ? 'text-white' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <span className={`text-xs font-medium ${formData.role === 'employer' ? 'text-blue-300' : 'text-gray-300'}`}>Employer</span>
                    <span className="text-xs text-gray-400 mt-0.5">Hiring talent</span>
                  </label>

                  <label
                    className={`relative flex flex-col items-center p-4 rounded-xl cursor-pointer transition-all duration-300 ${
                      formData.role === 'university'
                        ? 'bg-purple-500/30 border-2 border-purple-400 shadow-lg shadow-purple-500/20'
                        : 'bg-white/5 border-2 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="university"
                      checked={formData.role === 'university'}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${
                      formData.role === 'university' ? 'bg-purple-500 shadow-lg shadow-purple-500/50' : 'bg-white/10'
                    }`}>
                      <svg className={`w-5 h-5 transition-colors ${formData.role === 'university' ? 'text-white' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5m0 0l9 5m-9-5v10l9 5m0 0l9-5m-9 5v-10m0 0l-9-5m9 5l9-5M7 11.5v10m10-10v10" />
                      </svg>
                    </div>
                    <span className={`text-xs font-medium ${formData.role === 'university' ? 'text-purple-300' : 'text-gray-300'}`}>University</span>
                    <span className="text-xs text-gray-400 mt-0.5">Managing campus</span>
                  </label>

                </div>
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4 animate-fade-in-up animation-delay-300">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-emerald-100 mb-2">
                    First name
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
                      required
                      value={formData.firstName}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('firstName')}
                      onBlur={() => setFocusedField(null)}
                      className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 input-animated backdrop-blur-sm"
                      placeholder="John"
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
                  <label htmlFor="lastName" className="block text-sm font-medium text-emerald-100 mb-2">
                    Last name
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
                      required
                      value={formData.lastName}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('lastName')}
                      onBlur={() => setFocusedField(null)}
                      className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 input-animated backdrop-blur-sm"
                      placeholder="Doe"
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
              </div>

              {/* University field for students and university role */}
              {(formData.role === 'student' || formData.role === 'university') && (
                <div className="animate-fade-in-up animation-delay-350">
                  <label htmlFor="university" className="block text-sm font-medium text-emerald-100 mb-2">
                    University
                  </label>
                  <div className="relative">
                    <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'university' ? (formData.role === 'university' ? 'text-purple-400' : 'text-emerald-400') : 'text-gray-400'}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                      </svg>
                    </div>
                    <input
                      id="university"
                      name="university"
                      type="text"
                      required
                      value={formData.university}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('university')}
                      onBlur={() => setFocusedField(null)}
                      className={`w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 ${formData.role === 'university' ? 'focus:ring-purple-500' : 'focus:ring-emerald-500'} focus:border-transparent transition-all duration-300 input-animated backdrop-blur-sm`}
                      placeholder="Enter your university name"
                    />
                    {formData.university && (
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                        <svg className={`w-5 h-5 ${formData.role === 'university' ? 'text-purple-400' : 'text-emerald-400'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Company field for employers */}
              {formData.role === 'employer' && (
                <div className="animate-fade-in-up animation-delay-350">
                  <label htmlFor="company" className="block text-sm font-medium text-emerald-100 mb-2">
                    Company
                  </label>
                  <div className="relative">
                    <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'company' ? 'text-blue-400' : 'text-gray-400'}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <input
                      id="company"
                      name="company"
                      type="text"
                      required
                      value={formData.company}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('company')}
                      onBlur={() => setFocusedField(null)}
                      className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 input-animated backdrop-blur-sm"
                      placeholder="Enter your company name"
                    />
                    {formData.company && (
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                        <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="animate-fade-in-up animation-delay-400">
                <label htmlFor="email" className="block text-sm font-medium text-emerald-100 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'email' ? 'text-emerald-400' : 'text-gray-400'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full pl-12 pr-12 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 input-animated backdrop-blur-sm"
                    placeholder="name@example.com"
                  />
                  {formData.email && formData.email.includes('@') && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                      <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Password */}
              <div className="animate-fade-in-up animation-delay-500">
                <label htmlFor="password" className="block text-sm font-medium text-emerald-100 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'password' ? 'text-emerald-400' : 'text-gray-400'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full pl-12 pr-12 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 input-animated backdrop-blur-sm"
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white transition-colors duration-200"
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

                {/* Password Strength Indicator */}
                {formData.password && (
                  <div className="mt-3 space-y-2 animate-fade-in-up">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Password strength</span>
                      <span className={`text-xs font-medium ${passwordStrength.level === 1 ? 'text-red-400' : passwordStrength.level === 2 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {passwordStrength.text}
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${passwordStrength.color}`}
                        style={{ width: `${(passwordStrength.level / 3) * 100}%` }}
                      ></div>
                    </div>
                    {passwordStrength.tips.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {passwordStrength.tips.map((tip) => (
                          <span key={tip} className="text-xs px-2 py-1 bg-white/5 rounded-full text-gray-400">
                            {tip}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="animate-fade-in-up animation-delay-600">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-emerald-100 mb-2">
                  Confirm password
                </label>
                <div className="relative">
                  <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'confirmPassword' ? 'text-emerald-400' : 'text-gray-400'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('confirmPassword')}
                    onBlur={() => setFocusedField(null)}
                    className={`w-full pl-12 pr-12 py-3.5 bg-white/10 border rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 input-animated backdrop-blur-sm ${
                      formData.confirmPassword && !passwordsMatch ? 'border-red-500/50' : 'border-white/20'
                    }`}
                    placeholder="Repeat your password"
                  />
                  {formData.confirmPassword && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                      {passwordsMatch ? (
                        <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  )}
                </div>
                {formData.confirmPassword && !passwordsMatch && (
                  <p className="mt-2 text-sm text-red-400 animate-fade-in-up">Passwords do not match</p>
                )}
              </div>

              {/* Terms */}
              <div className="flex items-start animate-fade-in-up animation-delay-700">
                <input
                  id="terms"
                  type="checkbox"
                  required
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="checkbox-custom mt-0.5"
                />
                <label htmlFor="terms" className="ml-3 text-sm text-gray-300">
                  I agree to the{' '}
                  <a href="#" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">Terms of Service</a>
                  {' '}and{' '}
                  <a href="#" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">Privacy Policy</a>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !agreedToTerms}
                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 btn-animated disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 animate-fade-in-up animation-delay-700"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create account</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Sign in link */}
            <p className="mt-6 text-center text-sm text-gray-400 animate-fade-in-up animation-delay-700">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 animate-gradient"></div>

        {/* Decorative circles */}
        <div className="decorative-circle decorative-circle-1"></div>
        <div className="decorative-circle decorative-circle-2"></div>
        <div className="decorative-circle decorative-circle-3"></div>

        {/* Pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50"></div>

        <div className="relative z-10 flex flex-col justify-between h-full text-white p-12">
          {/* Logo */}
          <div className="animate-fade-in-right">
            <div className="flex items-center space-x-3">
              <div className="w-14 h-14 glass rounded-2xl flex items-center justify-center animate-float">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <span className="text-3xl font-bold tracking-tight">StudentJob</span>
            </div>
          </div>

          {/* Main content */}
          <div className="space-y-8 animate-fade-in-right animation-delay-200">
            <div>
              <h1 className="text-5xl font-bold leading-tight mb-4">
                Start Your
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 to-cyan-200">
                  Career Journey
                </span>
              </h1>
              <p className="text-emerald-100/80 text-xl max-w-md leading-relaxed">
                Join our community of students and employers. Build your future today with flexible work opportunities.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-4">
              {[
                { text: 'Flexible work hours for students', delay: '300' },
                { text: 'Verified employers and companies', delay: '400' },
                { text: 'Build experience while studying', delay: '500' },
              ].map((feature) => (
                <div
                  key={feature.text}
                  className={`flex items-center space-x-4 animate-fade-in-right animation-delay-${feature.delay}`}
                >
                  <div className="w-10 h-10 glass rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-emerald-50">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial */}
          <div className="animate-fade-in-right animation-delay-600">
            <div className="glass rounded-2xl p-6 max-w-md">
              <div className="flex items-start space-x-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex-shrink-0 animate-float"></div>
                <div>
                  <p className="text-white/90 italic leading-relaxed">"Found my first internship within a week of signing up. The platform made it so easy!"</p>
                  <div className="mt-3">
                    <p className="text-white font-semibold">Sarah K.</p>
                    <p className="text-emerald-200/70 text-sm">Computer Science Student</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
