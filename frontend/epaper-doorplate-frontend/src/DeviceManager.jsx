import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Plus, 
  Edit3, 
  Trash2, 
  RefreshCw, 
  Settings,
  Wifi,
  WifiOff,
  Clock,
  User
} from 'lucide-react';
import apiService from './services/api';

export default function DeviceManager() {
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showBindModal, setShowBindModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  
  // 綁定表單狀態
  const [bindForm, setBindForm] = useState({
    activationCode: '',
    deviceName: ''
  });
  
  // 編輯表單狀態
  const [editForm, setEditForm] = useState({
    deviceName: '',
    refreshInterval: '',
    forceNoUpdate: false
  });
  
  const [statusMessage, setStatusMessage] = useState('');

  // 檢查設備是否離線
  const isDeviceOffline = (device) => {
    if (!device.updatedAt) {
      // 如果沒有更新時間，無法判斷，返回 false（不顯示離線）
      console.log('設備離線檢查: 沒有 updatedAt', device.deviceId);
      return false;
    }

    try {
      // 解析更新時間
      let lastUpdateTime;
      
      // 如果是數組格式 [year, month, day, hour, minute, second]
      if (Array.isArray(device.updatedAt)) {
        const [year, month, day, hour = 0, minute = 0, second = 0] = device.updatedAt;
        lastUpdateTime = new Date(year, month - 1, day, hour, minute, second);
      } 
      // 如果是字符串格式（後端返回的格式：yyyy-MM-dd'T'HH:mm:ss，沒有時區信息）
      else if (typeof device.updatedAt === 'string') {
        // 後端返回的是 LocalDateTime，沒有時區信息
        // 假設後端服務器使用 UTC 時區，手動解析並明確指定為 UTC
        const match = device.updatedAt.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
        if (match) {
          const [, year, month, day, hour, minute, second] = match;
          // 使用 UTC 時間創建 Date 對象（後端服務器通常使用 UTC）
          lastUpdateTime = new Date(Date.UTC(
            parseInt(year), 
            parseInt(month) - 1, 
            parseInt(day), 
            parseInt(hour), 
            parseInt(minute), 
            parseInt(second)
          ));
        } else {
          // 如果格式不匹配，嘗試直接解析（可能包含時區信息）
          lastUpdateTime = new Date(device.updatedAt);
        }
      }
      // 如果是對象
      else if (typeof device.updatedAt === 'object') {
        lastUpdateTime = new Date(device.updatedAt);
      }
      else {
        console.log('設備離線檢查: updatedAt 格式不支援', device.deviceId, typeof device.updatedAt);
        return false;
      }

      // 檢查日期是否有效
      if (isNaN(lastUpdateTime.getTime())) {
        console.log('設備離線檢查: 日期無效', device.deviceId, device.updatedAt);
        return false;
      }

      // 獲取設備最後一次更新時使用的刷新間隔（秒）
      // 如果沒有記錄，則使用當前的刷新間隔，默認為 300 秒
      // 使用 lastRefreshInterval 可以避免用戶修改刷新間隔後，設備還沒收到新設置時誤判為離線
      const refreshInterval = device.lastRefreshInterval || device.refreshInterval || 300;
      
      // 計算預期下次更新時間 = 最後更新時間 + 刷新間隔 + 1分鐘緩衝
      const expectedNextUpdate = new Date(lastUpdateTime.getTime() + (refreshInterval * 1000) + (60 * 1000));
      
      // 如果現在時間超過預期下次更新時間，則設備可能離線
      const now = new Date();
      const isOffline = now > expectedNextUpdate;
      
      // 調試信息
      if (isOffline) {
        console.log('設備離線檢測:', {
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          lastUpdateTime: lastUpdateTime.toLocaleString('zh-TW'),
          refreshInterval: refreshInterval,
          expectedNextUpdate: expectedNextUpdate.toLocaleString('zh-TW'),
          now: now.toLocaleString('zh-TW'),
          timeDiff: Math.round((now - expectedNextUpdate) / 1000) + '秒'
        });
      }
      
      return isOffline;
    } catch (error) {
      console.error('檢查設備離線狀態時發生錯誤:', error, device);
      return false;
    }
  };

  // 載入裝置列表
  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        setStatusMessage('請先登入');
        return;
      }

      const result = await apiService.getUserDevices(username);
      if (result.success) {
        setDevices(result.devices || []);
      } else {
        setStatusMessage(result.message || '載入裝置列表失敗');
        setDevices([]);
      }
    } catch (error) {
      console.error('載入裝置列表失敗:', error);
      setStatusMessage('載入裝置列表失敗');
      setDevices([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  // 綁定裝置
  const handleBindDevice = async () => {
    if (!bindForm.activationCode.trim() || !bindForm.deviceName.trim()) {
      setStatusMessage('請填寫完整的綁定資訊');
      return;
    }

    try {
      const username = localStorage.getItem('username');
      if (!username) {
        setStatusMessage('請先登入');
        return;
      }

      const result = await apiService.deviceBind(
        bindForm.activationCode.trim(),
        bindForm.deviceName.trim(),
        username
      );

      if (result.success) {
        setStatusMessage('裝置綁定成功！');
        setShowBindModal(false);
        setBindForm({ activationCode: '', deviceName: '' });
        loadDevices(); // 重新載入裝置列表
      } else {
        setStatusMessage(result.message || '綁定失敗');
      }
    } catch (error) {
      console.error('綁定裝置失敗:', error);
      setStatusMessage('綁定裝置時發生錯誤');
    }
  };

  // 更新裝置設定
  const handleUpdateDevice = async () => {
    if (!editingDevice) return;

    try {
      const updateData = {};
      if (editForm.deviceName.trim()) {
        updateData.deviceName = editForm.deviceName.trim();
      }
      if (editForm.refreshInterval) {
        const interval = parseInt(editForm.refreshInterval);
        // 驗證刷新間隔必須 >= 300 秒
        if (interval < 300) {
          setStatusMessage('刷新間隔必須至少 300 秒');
          return;
        }
        updateData.refreshInterval = interval;
      }
      // 強制不更新開關
      updateData.forceNoUpdate = editForm.forceNoUpdate;

      const result = await apiService.deviceUpdate(editingDevice.deviceId, updateData);

      if (result.success) {
        setStatusMessage('裝置設定更新成功！');
        setShowEditModal(false);
        setEditingDevice(null);
        loadDevices(); // 重新載入裝置列表
      } else {
        setStatusMessage(result.message || '更新失敗');
      }
    } catch (error) {
      console.error('更新裝置失敗:', error);
      setStatusMessage('更新裝置時發生錯誤');
    }
  };

  // 解除綁定
  const handleUnbindDevice = async (deviceId) => {
    if (!window.confirm('確定要解除綁定此裝置嗎？')) return;

    try {
      const result = await apiService.deviceUnbind(deviceId);
      
      if (result.success) {
        setStatusMessage('裝置已解除綁定');
        loadDevices(); // 重新載入裝置列表
      } else {
        setStatusMessage(result.message || '解除綁定失敗');
      }
    } catch (error) {
      console.error('解除綁定失敗:', error);
      setStatusMessage('解除綁定時發生錯誤');
    }
  };

  // 查詢裝置狀態
  const handleCheckStatus = async (deviceId) => {
    try {
      const result = await apiService.deviceStatus(deviceId);
      
      if (result.success) {
        setStatusMessage(`需要更新：${result.needUpdate ? '是' : '否'}，刷新間隔：${result.refreshInterval || 300}秒`);
        loadDevices(); // 重新載入裝置列表
      } else {
        setStatusMessage(result.message || '查詢狀態失敗');
      }
    } catch (error) {
      console.error('查詢狀態失敗:', error);
      setStatusMessage('查詢狀態時發生錯誤');
    }
  };

  // 開啟編輯模式
  const openEditModal = (device) => {
    setEditingDevice(device);
    setEditForm({
      deviceName: device.deviceName || '',
      refreshInterval: device.refreshInterval ? String(device.refreshInterval) : '',
      forceNoUpdate: device.forceNoUpdate || false
    });
    setShowEditModal(true);
  };

  const DeviceCard = ({ device }) => {
    const offline = isDeviceOffline(device);
    
    return (
    <div className={`bg-white rounded-xl shadow-lg border p-6 hover:shadow-xl transition-all duration-300 ${offline ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
      {/* 離線警告提示 */}
      {offline && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg flex items-center space-x-2">
          <WifiOff className="w-5 h-5 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">設備可能已斷線或發生問題，請查看</p>
          </div>
        </div>
      )}
      
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${offline ? 'bg-red-100' : 'bg-blue-100'}`}>
            <Smartphone className={`w-5 h-5 ${offline ? 'text-red-600' : 'text-blue-600'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">{device.deviceName || '未命名裝置'}</h3>
            <p className="text-sm text-slate-500">ID: {device.deviceId}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => handleCheckStatus(device.deviceId)}
            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="查詢狀態"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => openEditModal(device)}
            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="編輯設定"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleUnbindDevice(device.deviceId)}
            className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="解除綁定"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">刷新間隔:</span>
              <span className="font-medium">{device.refreshInterval || 300}秒</span>
            </div>
            {device.lastRefreshInterval && (
              <div className="flex items-center space-x-2 ml-6">
                <span className="text-xs text-slate-500">實際使用:</span>
                <span className="text-xs font-medium text-blue-600">{device.lastRefreshInterval}秒</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-600">強制不更新:</span>
            <span className={`font-medium ${device.forceNoUpdate ? 'text-red-600' : 'text-green-600'}`}>
              {device.forceNoUpdate ? '是' : '否'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-slate-600 text-sm">需要更新:</span>
            <span className={`text-sm font-medium ${device.needUpdate ? 'text-orange-600' : 'text-green-600'}`}>
              {device.needUpdate ? '是' : '否'}
            </span>
          </div>
          <div className="text-xs text-slate-400">
            最後更新: {(() => {
              const formatDate = (dateValue) => {
                if (!dateValue) return null;
                
                // 加8小时（UTC+8时区）
                const add8Hours = (date) => {
                  const newDate = new Date(date);
                  newDate.setHours(newDate.getHours() + 8);
                  return newDate;
                };
                
                // 如果是数组格式 [year, month, day, hour, minute, second]
                if (Array.isArray(dateValue)) {
                  try {
                    const [year, month, day, hour = 0, minute = 0, second = 0] = dateValue;
                    const date = new Date(year, month - 1, day, hour, minute, second);
                    return add8Hours(date).toLocaleString('zh-TW');
                  } catch (e) {
                    return '格式錯誤';
                  }
                }
                
                // 如果是字符串格式
                if (typeof dateValue === 'string') {
                  try {
                    const date = new Date(dateValue);
                    if (isNaN(date.getTime())) {
                      // 尝试解析其他格式
                      return dateValue; // 如果无法解析，直接显示原值
                    }
                    return add8Hours(date).toLocaleString('zh-TW');
                  } catch (e) {
                    return dateValue;
                  }
                }
                
                // 如果是对象
                if (typeof dateValue === 'object') {
                  try {
                    const date = new Date(dateValue);
                    if (!isNaN(date.getTime())) {
                      return add8Hours(date).toLocaleString('zh-TW');
                    }
                  } catch (e) {
                    // 忽略错误
                  }
                }
                
                return null;
              };
              
              const dateStr = formatDate(device.updatedAt) || formatDate(device.createdAt);
              return dateStr || '未知';
            })()}
          </div>
        </div>
      </div>
    </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Smartphone className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">裝置管理</h1>
                <p className="text-sm text-slate-500">管理 ESP32 門牌裝置</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={loadDevices}
                className="flex items-center space-x-2 px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>重新載入</span>
              </button>
              <button
                onClick={() => setShowBindModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>綁定新裝置</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 狀態訊息 */}
        {statusMessage && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800">{statusMessage}</p>
          </div>
        )}

        {/* 裝置列表 */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-800">已綁定裝置</h2>
            <span className="text-sm text-slate-500">
              共 {devices.length} 個裝置
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-slate-600">載入中...</span>
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-slate-100 rounded-full w-16 h-16 mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-600 mb-2">沒有已綁定的裝置</h3>
              <p className="text-slate-500 mb-4">點擊「綁定新裝置」開始使用</p>
              <button
                onClick={() => setShowBindModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                綁定新裝置
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {devices.map(device => (
                <DeviceCard key={device.id} device={device} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 綁定裝置 Modal */}
      {showBindModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800">綁定新裝置</h2>
                <button
                  onClick={() => {
                    setShowBindModal(false);
                    setBindForm({ activationCode: '', deviceName: '' });
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
                    啟動碼
                  </label>
                  <input
                    type="text"
                    value={bindForm.activationCode}
                    onChange={(e) => setBindForm({...bindForm, activationCode: e.target.value})}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="輸入 ESP32 顯示的啟動碼"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    裝置名稱
                  </label>
                  <input
                    type="text"
                    value={bindForm.deviceName}
                    onChange={(e) => setBindForm({...bindForm, deviceName: e.target.value})}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="例如：會議室門牌"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowBindModal(false);
                      setBindForm({ activationCode: '', deviceName: '' });
                      setStatusMessage('');
                    }}
                    className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleBindDevice}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    綁定裝置
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 編輯裝置 Modal */}
      {showEditModal && editingDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800">編輯裝置設定</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingDevice(null);
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
                    裝置名稱
                  </label>
                  <input
                    type="text"
                    value={editForm.deviceName}
                    onChange={(e) => setEditForm({...editForm, deviceName: e.target.value})}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="輸入新的裝置名稱"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    刷新間隔
                  </label>
                  <input
                    type="number"
                    min="300"
                    value={editForm.refreshInterval}
                    onChange={(e) => setEditForm({...editForm, refreshInterval: e.target.value})}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="例如：300"
                  />
                  <p className="text-xs text-slate-500 mt-1">刷新間隔必須至少 300 秒</p>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="forceNoUpdate"
                    checked={editForm.forceNoUpdate}
                    onChange={(e) => setEditForm({...editForm, forceNoUpdate: e.target.checked})}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="forceNoUpdate" className="text-sm font-medium text-slate-700">
                    強制不更新（即使有更新也不會推送給設備）
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingDevice(null);
                      setStatusMessage('');
                    }}
                    className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleUpdateDevice}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    更新設定
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
