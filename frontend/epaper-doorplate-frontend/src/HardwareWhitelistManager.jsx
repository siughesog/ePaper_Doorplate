import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle,
  XCircle,
  Search,
  AlertTriangle,
  Lock
} from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import apiService from './services/api';

export default function HardwareWhitelistManager() {
  const { user } = useAuth();
  const [whitelist, setWhitelist] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [newUniqueId, setNewUniqueId] = useState('');
  const [checkUniqueId, setCheckUniqueId] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  // 載入白名單
  const loadWhitelist = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getHardwareWhitelist();
      setWhitelist(data || []);
    } catch (error) {
      console.error('載入白名單失敗:', error);
      setStatusMessage('載入白名單失敗');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 只有超級用戶才載入白名單
    if (user?.isSuperuser) {
      loadWhitelist();
    }
  }, [user?.isSuperuser]);

  // 檢查是否為超級用戶
  if (!user?.isSuperuser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 max-w-md mx-4">
          <div className="text-center">
            <div className="p-4 bg-red-100 rounded-full w-16 h-16 mx-auto mb-4">
              <Lock className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">權限不足</h2>
            <p className="text-slate-600 mb-4">
              只有超級用戶才能訪問硬體白名單管理功能
            </p>
            <p className="text-sm text-slate-500">
              請聯繫管理員獲取超級用戶權限
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 新增到白名單
  const handleAddToWhitelist = async () => {
    if (!newUniqueId.trim()) {
      setStatusMessage('請輸入 unique_id');
      return;
    }

    try {
      const result = await apiService.addToHardwareWhitelist(newUniqueId.trim());
      
      if (result.success) {
        setStatusMessage('已成功新增到白名單');
        setShowAddModal(false);
        setNewUniqueId('');
        loadWhitelist(); // 重新載入列表
      } else {
        setStatusMessage(result.message || '新增失敗');
      }
    } catch (error) {
      console.error('新增到白名單失敗:', error);
      setStatusMessage('新增時發生錯誤');
    }
  };

  // 從白名單移除
  const handleRemoveFromWhitelist = async (uniqueId) => {
    if (!window.confirm(`確定要從白名單中移除 ${uniqueId} 嗎？`)) return;

    try {
      const result = await apiService.removeFromHardwareWhitelist(uniqueId);
      
      if (result.success) {
        setStatusMessage('已成功從白名單移除');
        loadWhitelist(); // 重新載入列表
      } else {
        setStatusMessage(result.message || '移除失敗');
      }
    } catch (error) {
      console.error('從白名單移除失敗:', error);
      setStatusMessage('移除時發生錯誤');
    }
  };

  // 檢查白名單狀態
  const handleCheckWhitelist = async () => {
    if (!checkUniqueId.trim()) {
      setStatusMessage('請輸入 unique_id');
      return;
    }

    try {
      const result = await apiService.checkHardwareWhitelist(checkUniqueId.trim());
      
      if (result.success) {
        setCheckResult(result);
        setStatusMessage('');
      } else {
        setStatusMessage(result.message || '檢查失敗');
      }
    } catch (error) {
      console.error('檢查白名單失敗:', error);
      setStatusMessage('檢查時發生錯誤');
    }
  };

  const WhitelistItem = ({ item }) => (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Shield className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">{item.uniqueId}</h3>
            <p className="text-sm text-slate-500">硬體唯一 ID</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">已授權</span>
          </div>
          <button
            onClick={() => handleRemoveFromWhitelist(item.uniqueId)}
            className="flex items-center space-x-1 px-3 py-2 text-sm text-red-600 hover:text-white hover:bg-red-600 border border-red-300 rounded-lg transition-colors"
            title="從白名單移除"
          >
            <Trash2 className="w-4 h-4" />
            <span>刪除</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">硬體白名單管理</h1>
                <p className="text-sm text-slate-500">管理允許的 ESP32 硬體 ID</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowCheckModal(true)}
                className="flex items-center space-x-2 px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Search className="w-4 h-4" />
                <span>檢查狀態</span>
              </button>
              <button
                onClick={loadWhitelist}
                className="flex items-center space-x-2 px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>重新載入</span>
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>新增硬體 ID</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 狀態訊息 */}
        {statusMessage && (
          <div className={`mb-6 p-4 rounded-lg border ${
            statusMessage.includes('成功') || statusMessage.includes('已')
              ? 'bg-green-50 border-green-200'
              : statusMessage.includes('失敗') || statusMessage.includes('錯誤')
              ? 'bg-red-50 border-red-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center space-x-2">
              {statusMessage.includes('成功') || statusMessage.includes('已') ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : statusMessage.includes('失敗') || statusMessage.includes('錯誤') ? (
                <XCircle className="w-5 h-5 text-red-600" />
              ) : null}
              <p className={`
                ${statusMessage.includes('成功') || statusMessage.includes('已') ? 'text-green-800' : ''}
                ${statusMessage.includes('失敗') || statusMessage.includes('錯誤') ? 'text-red-800' : 'text-blue-800'}
              `}>
                {statusMessage}
              </p>
            </div>
          </div>
        )}

        {/* 說明區域 */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800">重要說明</h3>
              <p className="text-sm text-amber-700 mt-1">
                只有在此白名單中的硬體 unique_id 才能進行裝置激活。請確保新增的 unique_id 是正確的 ESP32 硬體識別碼。
              </p>
            </div>
          </div>
        </div>

        {/* 白名單列表 */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-800">已授權硬體 ID</h2>
            <span className="text-sm text-slate-500">
              共 {whitelist.length} 個硬體 ID
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-slate-600">載入中...</span>
            </div>
          ) : whitelist.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-slate-100 rounded-full w-16 h-16 mx-auto mb-4">
                <Shield className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-600 mb-2">白名單為空</h3>
              <p className="text-slate-500 mb-4">點擊「新增硬體 ID」開始管理</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                新增硬體 ID
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {whitelist.map(item => (
                <WhitelistItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 新增硬體 ID Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800">新增硬體 ID</h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewUniqueId('');
                    setStatusMessage('');
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    硬體唯一 ID
                  </label>
                  <input
                    type="text"
                    value={newUniqueId}
                    onChange={(e) => setNewUniqueId(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="輸入 ESP32 的 unique_id"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    例如：ESP32 的 efuse MAC 地址或其他硬體識別碼
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setNewUniqueId('');
                      setStatusMessage('');
                    }}
                    className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAddToWhitelist}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    新增到白名單
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 檢查狀態 Modal */}
      {showCheckModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800">檢查硬體 ID 狀態</h2>
                <button
                  onClick={() => {
                    setShowCheckModal(false);
                    setCheckUniqueId('');
                    setCheckResult(null);
                    setStatusMessage('');
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    硬體唯一 ID
                  </label>
                  <input
                    type="text"
                    value={checkUniqueId}
                    onChange={(e) => setCheckUniqueId(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="輸入要檢查的 unique_id"
                  />
                </div>

                {checkResult && (
                  <div className={`p-4 rounded-lg border ${
                    checkResult.isWhitelisted 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center space-x-2">
                      {checkResult.isWhitelisted ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <span className={`font-medium ${
                        checkResult.isWhitelisted ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {checkResult.isWhitelisted ? '已授權' : '未授權'}
                      </span>
                    </div>
                    <p className={`text-sm mt-1 ${
                      checkResult.isWhitelisted ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {checkResult.isWhitelisted 
                        ? '此硬體 ID 在白名單中，可以進行裝置激活' 
                        : '此硬體 ID 不在白名單中，無法進行裝置激活'
                      }
                    </p>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowCheckModal(false);
                      setCheckUniqueId('');
                      setCheckResult(null);
                      setStatusMessage('');
                    }}
                    className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    關閉
                  </button>
                  <button
                    onClick={handleCheckWhitelist}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    檢查狀態
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
