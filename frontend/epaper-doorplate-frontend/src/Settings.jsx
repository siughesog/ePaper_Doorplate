import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, QrCode, MessageSquare, Bell, Save, X, Check, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import apiService from './services/api';
import { useToast } from './components/Toast';
import { useAuth } from './contexts/AuthContext';

export default function Settings() {
  const toast = useToast();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [settings, setSettings] = useState({
    username: '',
    email: '',
    lineBound: false,
    lineUserId: null,
    acceptGuestMessages: true,
    guestMessageWelcomeText: '歡迎留言給我們',
    guestMessageHintText: '請輸入您的留言',
    guestMessageSubmitText: '發送留言'
  });
  const [accountData, setAccountData] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerificationCode, setShowVerificationCode] = useState(false);
  const [lineQRCodeUrl, setLineQRCodeUrl] = useState('');
  const [lineBotInfo, setLineBotInfo] = useState(null);

  useEffect(() => {
    loadSettings();
    loadLineBotInfo();
  }, []);

  const loadLineBotInfo = async () => {
    try {
      const result = await apiService.getLineBotInfo();
      if (result.success) {
        setLineBotInfo(result);
        if (result.qrCodeUrl) {
          // 使用在線 QR Code 生成服務生成 QR Code 圖片
          const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(result.qrCodeUrl)}`;
          setLineQRCodeUrl(qrCodeImageUrl);
        }
      }
    } catch (error) {
      console.error('載入 Line Bot 資訊失敗:', error);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const result = await apiService.getSettings();
      if (result.success) {
        setSettings({
          username: result.username || '',
          email: result.email || '',
          lineBound: result.lineBound || false,
          lineUserId: result.lineUserId || null,
          acceptGuestMessages: result.acceptGuestMessages !== undefined ? result.acceptGuestMessages : true,
          guestMessageWelcomeText: result.guestMessageWelcomeText || '歡迎留言給我們',
          guestMessageHintText: result.guestMessageHintText || '請輸入您的留言',
          guestMessageSubmitText: result.guestMessageSubmitText || '發送留言'
        });
        setAccountData({
          username: result.username || '',
          email: result.email || '',
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        toast.error(result.message || '載入設定失敗');
      }
    } catch (error) {
      console.error('載入設定失敗:', error);
      toast.error('載入設定失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVerificationCode = async () => {
    try {
      const result = await apiService.generateLineVerificationCode();
      if (result.success) {
        setVerificationCode(result.verificationCode);
        setShowVerificationCode(true);
        toast.success(`驗證碼已生成，有效期 ${result.expiresIn} 秒`);
        
        // 更新 Line Bot 資訊（如果返回了）
        if (result.qrCodeUrl) {
          setLineBotInfo(result);
          const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(result.qrCodeUrl)}`;
          setLineQRCodeUrl(qrCodeImageUrl);
        }
      } else {
        toast.error(result.message || '生成驗證碼失敗');
      }
    } catch (error) {
      console.error('生成驗證碼失敗:', error);
      toast.error('生成驗證碼失敗');
    }
  };

  const handleUnbindLine = async () => {
    if (!window.confirm('確定要解除 Line Bot 綁定嗎？')) {
      return;
    }

    try {
      const result = await apiService.unbindLine();
      if (result.success) {
        setSettings(prev => ({ ...prev, lineBound: false, lineUserId: null }));
        toast.success('已解除 Line Bot 綁定');
      } else {
        toast.error(result.message || '解除綁定失敗');
      }
    } catch (error) {
      console.error('解除綁定失敗:', error);
      toast.error('解除綁定失敗');
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const result = await apiService.updateSettings({
        acceptGuestMessages: settings.acceptGuestMessages,
        guestMessageWelcomeText: settings.guestMessageWelcomeText,
        guestMessageHintText: settings.guestMessageHintText,
        guestMessageSubmitText: settings.guestMessageSubmitText
      });

      if (result.success) {
        toast.success('設定已保存');
      } else {
        toast.error(result.message || '保存設定失敗');
      }
    } catch (error) {
      console.error('保存設定失敗:', error);
      toast.error('保存設定失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAccount = async () => {
    // 驗證密碼確認
    if (accountData.newPassword && accountData.newPassword !== accountData.confirmPassword) {
      toast.error('新密碼與確認密碼不匹配');
      return;
    }

    // 如果修改密碼，必須提供當前密碼
    if (accountData.newPassword && !accountData.currentPassword) {
      toast.error('修改密碼需要提供當前密碼');
      return;
    }

    try {
      setSavingAccount(true);
      const updateData = {};
      
      if (accountData.username !== settings.username) {
        updateData.username = accountData.username;
      }
      if (accountData.email !== settings.email) {
        updateData.email = accountData.email;
      }
      if (accountData.newPassword) {
        updateData.currentPassword = accountData.currentPassword;
        updateData.newPassword = accountData.newPassword;
      }

      if (Object.keys(updateData).length === 0) {
        toast.info('沒有需要更新的資訊');
        return;
      }

      const result = await apiService.updateAccount(updateData);

      if (result.success) {
        toast.success(result.message || '帳戶資訊已更新');
        
        // 如果用戶名改變，需要重新登入
        if (result.usernameChanged) {
          toast.info('用戶名已更改，請重新登入');
          setTimeout(() => {
            logout();
          }, 2000);
        } else {
          // 重新載入設定
          await loadSettings();
          // 清空密碼欄位
          setAccountData(prev => ({
            ...prev,
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          }));
        }
      } else {
        toast.error(result.message || '更新帳戶資訊失敗');
      }
    } catch (error) {
      console.error('更新帳戶資訊失敗:', error);
      toast.error('更新帳戶資訊失敗');
    } finally {
      setSavingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <SettingsIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">設定</h1>
                <p className="text-sm text-slate-500">管理您的帳戶設定和偏好</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 帳戶資訊區塊 */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">帳戶資訊</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                用戶名
              </label>
              <input
                type="text"
                value={accountData.username}
                onChange={(e) => setAccountData(prev => ({ ...prev, username: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="用戶名"
                minLength={3}
                maxLength={20}
              />
              <p className="text-xs text-slate-500 mt-1">用戶名長度必須在3-20個字符之間</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                電子郵件
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={accountData.email}
                  onChange={(e) => setAccountData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="example@email.com"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">修改密碼（可選）</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    當前密碼
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword.current ? "text" : "password"}
                      value={accountData.currentPassword}
                      onChange={(e) => setAccountData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="輸入當前密碼"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => ({ ...prev, current: !prev.current }))}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    新密碼
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword.new ? "text" : "password"}
                      value={accountData.newPassword}
                      onChange={(e) => setAccountData(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="輸入新密碼"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => ({ ...prev, new: !prev.new }))}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">密碼長度至少6個字符</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    確認新密碼
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword.confirm ? "text" : "password"}
                      value={accountData.confirmPassword}
                      onChange={(e) => setAccountData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="再次輸入新密碼"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => ({ ...prev, confirm: !prev.confirm }))}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleSaveAccount}
                disabled={savingAccount}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{savingAccount ? '保存中...' : '保存帳戶資訊'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Line Bot 綁定區塊 */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">Line Bot 綁定</h2>
          </div>

          {settings.lineBound ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-green-600">
                <Check className="w-5 h-5" />
                <span>已綁定 Line Bot</span>
              </div>
              <button
                onClick={handleUnbindLine}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                解除綁定
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-slate-600">綁定 Line Bot 以接收訪客留言通知</p>
              
              {/* Line Bot 配置狀態提示 */}
              {lineBotInfo && !lineBotInfo.hasBotId && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Line Bot ID 未設置，請在環境變數中設置 <code className="bg-yellow-100 px-2 py-1 rounded">LINE_BOT_BOT_ID</code>
                  </p>
                </div>
              )}
              
              <div className="space-y-3">
                {/* 顯示 QR Code（如果已配置） */}
                {lineQRCodeUrl && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-slate-700 mb-2 font-semibold">步驟 1：掃描以下 QR Code 加入 Line Bot</p>
                    <div className="flex justify-center mb-2">
                      <img src={lineQRCodeUrl} alt="Line Bot QR Code" className="w-48 h-48 border-2 border-blue-300 rounded-lg shadow-sm" />
                    </div>
                    {lineBotInfo?.friendUrl && (
                      <p className="text-xs text-slate-600 text-center">
                        或點擊連結：<a href={lineBotInfo.friendUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {lineBotInfo.friendUrl}
                        </a>
                      </p>
                    )}
                  </div>
                )}
                
                {/* 驗證碼顯示 */}
                {showVerificationCode && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-slate-700 mb-2 font-semibold">步驟 2：在 Line Bot 中輸入以下驗證碼</p>
                    <div className="flex items-center justify-center space-x-2">
                      <code className="text-3xl font-mono font-bold text-green-700 bg-white px-6 py-3 rounded-lg border-2 border-green-300 shadow-sm">
                        {verificationCode}
                      </code>
                      <button
                        onClick={() => setShowVerificationCode(false)}
                        className="p-2 text-slate-500 hover:text-slate-700"
                        title="隱藏驗證碼"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 text-center">驗證碼有效期 5 分鐘</p>
                  </div>
                )}
                
                {/* 生成驗證碼按鈕 */}
                <button
                  onClick={handleGenerateVerificationCode}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <QrCode className="w-4 h-4" />
                  <span>{showVerificationCode ? '重新生成驗證碼' : '生成驗證碼'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Guest 訊息設定區塊 */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <Bell className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">訪客訊息設定</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">接受訪客訊息</label>
                <p className="text-xs text-slate-500">允許訪客通過 QR Code 發送留言</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.acceptGuestMessages}
                  onChange={(e) => setSettings(prev => ({ ...prev, acceptGuestMessages: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                歡迎訊息
              </label>
              <input
                type="text"
                value={settings.guestMessageWelcomeText}
                onChange={(e) => setSettings(prev => ({ ...prev, guestMessageWelcomeText: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="歡迎留言給我們"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                提示文字
              </label>
              <input
                type="text"
                value={settings.guestMessageHintText}
                onChange={(e) => setSettings(prev => ({ ...prev, guestMessageHintText: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="請輸入您的留言"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                提交按鈕文字
              </label>
              <input
                type="text"
                value={settings.guestMessageSubmitText}
                onChange={(e) => setSettings(prev => ({ ...prev, guestMessageSubmitText: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="發送留言"
              />
            </div>
          </div>
        </div>

        {/* 保存按鈕 */}
        <div className="flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? '保存中...' : '保存設定'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

