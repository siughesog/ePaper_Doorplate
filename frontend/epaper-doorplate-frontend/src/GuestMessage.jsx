import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Send, CheckCircle, XCircle } from 'lucide-react';
import apiService from './services/api';

export default function GuestMessage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState({
    welcomeText: '歡迎留言給我們',
    hintText: '請輸入您的留言',
    submitText: '發送留言'
  });
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!token) {
      setResult({ success: false, message: '無效的 QR Code' });
      setLoading(false);
      return;
    }

    loadSettings();
  }, [token]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const result = await apiService.getGuestMessagePageSettings(token);
      if (result.success) {
        setSettings({
          welcomeText: result.welcomeText || '歡迎留言給我們',
          hintText: result.hintText || '請輸入您的留言',
          submitText: result.submitText || '發送留言'
        });
        // 清除之前的錯誤訊息
        setResult(null);
      } else {
        // 統一處理錯誤訊息（不區分大小寫）
        const errorMessage = result.message || '載入設定失敗';
        setResult({ success: false, message: errorMessage });
      }
    } catch (error) {
      console.error('載入設定失敗:', error);
      setResult({ success: false, message: '載入設定失敗，請稍後再試' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!message.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      const result = await apiService.submitGuestMessage(token, message.trim());
      setResult(result);
      
      if (result.success) {
        setMessage('');
        // 3秒後可以再次提交
        setTimeout(() => {
          setResult(null);
        }, 3000);
      }
    } catch (error) {
      console.error('提交留言失敗:', error);
      setResult({ success: false, message: '提交留言失敗，請稍後再試' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">載入中...</p>
        </div>
      </div>
    );
  }

  // 檢查是否為 QR code 相關錯誤（不區分大小寫）
  const isQRCodeError = result && !result.success && result.message && (
    result.message.includes('無效的 QR') || 
    result.message.includes('無效的QR') ||
    result.message.toLowerCase().includes('invalid qr') ||
    result.message === '無效的 QR Code' ||
    result.message === '無效的 QR code'
  );

  // 檢查是否為其他嚴重錯誤（需要單獨顯示）
  const isCriticalError = result && !result.success && (
    isQRCodeError ||
    result.message?.includes('設備未綁定用戶') ||
    result.message?.includes('用戶不存在') ||
    result.message?.includes('設備未激活')
  );

  if (isCriticalError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            {isQRCodeError ? '無效的 QR Code' : '無法載入頁面'}
          </h1>
          <p className="text-slate-600 mb-4">{result.message || '請檢查 QR Code 是否正確'}</p>
          {isQRCodeError && (
            <p className="text-sm text-slate-500">請確認您掃描的是正確的 QR Code</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <MessageSquare className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            {settings.welcomeText}
          </h1>
        </div>

        {/* Result Message */}
        {result && (
          <div className={`mb-6 p-4 rounded-lg flex items-center space-x-3 ${
            result.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            {result.success ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-green-800 text-sm">{result.message || '留言已發送'}</p>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-red-800 text-sm">{result.message || '發送失敗'}</p>
              </>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {settings.hintText}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={500}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-800"
              placeholder="輸入您的留言..."
              disabled={submitting || (result && result.success)}
            />
            <p className="text-xs text-slate-500 mt-1 text-right">
              {message.length}/500
            </p>
          </div>

          <button
            type="submit"
            disabled={!message.trim() || submitting || (result && result.success)}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 shadow-sm"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>發送中...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>{settings.submitText}</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-xs text-slate-500 text-center mt-6">
          您的留言將通過 Line Bot 發送給門牌主人
        </p>
      </div>
    </div>
  );
}

