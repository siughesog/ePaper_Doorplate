import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react';
import apiService from './services/api';
import { useToast } from './components/Toast';

export default function ForgotPassword() {
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: 輸入 email, 2: 輸入驗證碼, 3: 設置新密碼
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState({ new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('請輸入電子郵件地址');
      return;
    }

    try {
      setLoading(true);
      const result = await apiService.sendPasswordResetCode(email);
      if (result.success) {
        toast.success('驗證碼已發送至您的電子郵件');
        setStep(2);
        setCountdown(300); // 5 分鐘倒計時
        startCountdown();
      } else {
        toast.error(result.message || '發送驗證碼失敗');
      }
    } catch (error) {
      console.error('發送驗證碼失敗:', error);
      toast.error('發送驗證碼失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const startCountdown = () => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      toast.error('請輸入驗證碼');
      return;
    }

    try {
      setLoading(true);
      const result = await apiService.verifyPasswordResetCode(email, verificationCode);
      if (result.success) {
        toast.success('驗證碼正確');
        setStep(3);
      } else {
        toast.error(result.message || '驗證碼錯誤或已過期');
      }
    } catch (error) {
      console.error('驗證失敗:', error);
      toast.error('驗證失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      toast.error('請輸入新密碼');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('密碼長度至少6個字符');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('兩次輸入的密碼不一致');
      return;
    }

    try {
      setLoading(true);
      const result = await apiService.resetPassword(email, verificationCode, newPassword);
      if (result.success) {
        toast.success('密碼重置成功，請重新登入');
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        toast.error(result.message || '重置密碼失敗');
      }
    } catch (error) {
      console.error('重置密碼失敗:', error);
      toast.error('重置密碼失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 w-full max-w-md">
        <button
          onClick={() => navigate('/')}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回登入</span>
        </button>

        <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-800 mb-6">
          忘記密碼
        </h1>

        {step === 1 && (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                電子郵件地址
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="example@email.com"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                我們將發送驗證碼到您的電子郵件地址
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '發送中...' : '發送驗證碼'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2 text-blue-800">
                <CheckCircle className="w-5 h-5" />
                <p className="text-sm font-medium">驗證碼已發送至</p>
              </div>
              <p className="text-sm text-blue-700 mt-1">{email}</p>
            </div>

            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                驗證碼
              </label>
              <input
                id="code"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-center text-2xl font-mono tracking-widest"
                placeholder="000000"
                maxLength={6}
                required
              />
              {countdown > 0 && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  驗證碼有效期：{formatTime(countdown)}
                </p>
              )}
              {countdown === 0 && (
                <button
                  type="button"
                  onClick={handleSendCode}
                  className="text-xs text-blue-600 hover:text-blue-700 mt-2 w-full text-center"
                >
                  重新發送驗證碼
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '驗證中...' : '驗證'}
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                新密碼
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="newPassword"
                  type={showPassword.new ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="輸入新密碼"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => ({ ...prev, new: !prev.new }))}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">密碼長度至少6個字符</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                確認新密碼
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  type={showPassword.confirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="再次輸入新密碼"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '重置中...' : '重置密碼'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

