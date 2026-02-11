import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Eye, EyeOff, Settings, Cpu, Info, ChevronRight, Check, Server, Plus, Trash2 } from 'lucide-react';
import classNames from 'classnames';
import {
  ConfiguredModel,
  DEFAULT_CONFIGURED_MODELS,
  getDefaultModelByProvider,
  ModelProvider,
} from '../../../utils/image-generation';

export interface AppSettings {
  apiEndpoint: string;
  apiKey: string;
  modelScopeApiKey: string;
  watermarkEnabled: boolean;
  models: ConfiguredModel[];
  defaultModelByProvider: Record<ModelProvider, string>;
  selectedModel?: string;
  defaultModel?: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
  initialSettings: AppSettings;
}

// 根据环境决定API端点
const getDefaultEndpoint = () => {
  if (typeof window !== 'undefined') {
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocalDev ? 'http://localhost:3000/generate-image' : '/generate-image';
  }
  return '/generate-image';
};

const DEFAULT_SETTINGS: AppSettings = {
  apiEndpoint: getDefaultEndpoint(),
  apiKey: '',
  modelScopeApiKey: '',
  watermarkEnabled: true,
  models: [...DEFAULT_CONFIGURED_MODELS],
  defaultModelByProvider: getDefaultModelByProvider(),
  selectedModel: '',
  defaultModel: DEFAULT_CONFIGURED_MODELS.find(m => m.provider === 'volcengine')?.apiModel || '',
};

type TabType = 'providers' | 'general' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialSettings,
}) => {
  const normalizeSettings = (raw: Partial<AppSettings>): AppSettings => {
    const merged: AppSettings = { ...DEFAULT_SETTINGS, ...raw } as AppSettings;
    const models = Array.isArray(merged.models) && merged.models.length > 0 ? merged.models : [...DEFAULT_CONFIGURED_MODELS];
    const defaultModelByProvider = merged.defaultModelByProvider && typeof merged.defaultModelByProvider === 'object'
      ? merged.defaultModelByProvider
      : getDefaultModelByProvider();

    const volcengineDefault = typeof defaultModelByProvider.volcengine === 'string' ? defaultModelByProvider.volcengine : '';
    const modelscopeDefault = typeof defaultModelByProvider.modelscope === 'string' ? defaultModelByProvider.modelscope : '';
    const fixedDefaultModelByProvider: Record<ModelProvider, string> = {
      volcengine: models.some(m => m.provider === 'volcengine' && m.apiModel === volcengineDefault)
        ? volcengineDefault
        : (models.find(m => m.provider === 'volcengine')?.apiModel || getDefaultModelByProvider().volcengine),
      modelscope: models.some(m => m.provider === 'modelscope' && m.apiModel === modelscopeDefault)
        ? modelscopeDefault
        : (models.find(m => m.provider === 'modelscope')?.apiModel || getDefaultModelByProvider().modelscope),
    };

    const legacyDefaultModel = typeof merged.defaultModel === 'string' ? merged.defaultModel : '';
    const selectedModel = typeof merged.selectedModel === 'string'
      ? merged.selectedModel
      : legacyDefaultModel;

    return {
      ...merged,
      models,
      defaultModelByProvider: fixedDefaultModelByProvider,
      selectedModel,
      defaultModel: legacyDefaultModel || fixedDefaultModelByProvider.volcengine,
    };
  };

  const [settings, setSettings] = useState<AppSettings>(() => normalizeSettings(initialSettings));
  const [activeTab, setActiveTab] = useState<TabType>('providers');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showApiKey, setShowApiKey] = useState(false);
  const [showModelScopeApiKey, setShowModelScopeApiKey] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>('volcengine');

  useEffect(() => {
    setSettings(normalizeSettings(initialSettings));
  }, [initialSettings]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const validateSettings = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 验证逻辑可以根据需要放宽，因为现在支持多供应商
    if (settings.apiKey && settings.apiKey.trim().length < 10) {
      newErrors.apiKey = 'API密钥格式无效';
    }

    if (settings.modelScopeApiKey && settings.modelScopeApiKey.trim().length < 10) {
      newErrors.modelScopeApiKey = 'ModelScope API密钥格式无效';
    }

    const hasInvalidModel = settings.models.some(m => m.displayName.trim().length > 0 && m.apiModel.trim().length === 0);
    if (hasInvalidModel) {
      newErrors.models = '存在“显示名称”已填但“实际模型”为空的配置';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateSettings()) {
      const cleanedModels = settings.models.filter(m => m.displayName.trim().length > 0 || m.apiModel.trim().length > 0)
        .map(m => ({ ...m, displayName: m.displayName.trim(), apiModel: m.apiModel.trim() }))
        .filter(m => m.apiModel.length > 0);
      onSave({ ...settings, models: cleanedModels });
      onClose();
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setErrors({});
  };

  const providerModels = useMemo(() => {
    return {
      volcengine: settings.models.filter(m => m.provider === 'volcengine'),
      modelscope: settings.models.filter(m => m.provider === 'modelscope'),
    };
  }, [settings.models]);

  const updateProviderModel = (
    provider: ModelProvider,
    index: number,
    patch: Partial<ConfiguredModel>
  ) => {
    setSettings(prev => {
      const models = prev.models.filter(m => m.provider !== provider);
      const list = prev.models.filter(m => m.provider === provider);
      const nextList = list.map((m, i) => (i === index ? { ...m, ...patch } : m));
      return { ...prev, models: [...models, ...nextList] };
    });
  };

  const addProviderModel = (provider: ModelProvider) => {
    setSettings(prev => ({
      ...prev,
      models: [
        ...prev.models,
        { provider, type: 'image', displayName: '', apiModel: '' },
      ],
    }));
  };

  const removeProviderModel = (provider: ModelProvider, index: number) => {
    setSettings(prev => {
      const kept = prev.models.filter(m => m.provider !== provider);
      const list = prev.models.filter(m => m.provider === provider);
      const nextList = list.filter((_, i) => i !== index);
      const nextModels = [...kept, ...nextList];
      const nextDefaults = { ...prev.defaultModelByProvider };
      const currentDefault = nextDefaults[provider];
      if (!nextList.some(m => m.apiModel === currentDefault)) {
        nextDefaults[provider] = nextList[0]?.apiModel || getDefaultModelByProvider()[provider];
      }
      return { ...prev, models: nextModels, defaultModelByProvider: nextDefaults };
    });
  };

  const isProviderConfigured = (provider: 'volcengine' | 'modelscope') => {
    if (provider === 'volcengine') return !!settings.apiKey;
    if (provider === 'modelscope') return !!settings.modelScopeApiKey;
    return false;
  };

  if (!isOpen) {
    return null;
  }

  if (typeof document === 'undefined' || !document.body) {
    console.warn('SettingsModal: document.body is not available');
    return null;
  }

  return createPortal(
    <div className="settings-modal-overlay">
      <div className="settings-modal settings-modal--wide">
        <div className="settings-modal-header">
          <h3>设置</h3>
          <button
            type="button"
            className="settings-modal-close"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="settings-layout">
          {/* 左侧侧边栏 */}
          <div className="settings-sidebar">
            <button
              className={classNames('settings-sidebar-item', { 'active': activeTab === 'providers' })}
              onClick={() => setActiveTab('providers')}
            >
              <Cpu size={18} />
              <span>模型服务</span>
            </button>
            <button
              className={classNames('settings-sidebar-item', { 'active': activeTab === 'general' })}
              onClick={() => setActiveTab('general')}
            >
              <Settings size={18} />
              <span>通用设置</span>
            </button>
            <button
              className={classNames('settings-sidebar-item', { 'active': activeTab === 'about' })}
              onClick={() => setActiveTab('about')}
            >
              <Info size={18} />
              <span>关于</span>
            </button>
          </div>

          {/* 右侧内容区 */}
          <div className="settings-content-area">
            
            {/* 模型服务 Tab */}
            {activeTab === 'providers' && (
              <div className="settings-tab-content">
                <div className="settings-section-header">
                  <h4>AI模型供应商</h4>
                  <p>配置不同供应商的API密钥以使用其模型能力</p>
                </div>

                <div className="providers-list">
                  {/* Volcengine Provider */}
                  <div className={classNames('provider-card', { 'expanded': expandedProvider === 'volcengine' })}>
                    <div 
                      className="provider-header"
                      onClick={() => setExpandedProvider(expandedProvider === 'volcengine' ? null : 'volcengine')}
                    >
                      <div className="provider-info">
                        <div className="provider-icon volcengine-icon">V</div>
                        <div className="provider-details">
                          <span className="provider-name">火山引擎 (Volcengine)</span>
                          <span className="provider-status">
                            {isProviderConfigured('volcengine') ? (
                              <span className="status-configured"><Check size={12} /> 已配置</span>
                            ) : (
                              <span className="status-missing">未配置</span>
                            )}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="provider-chevron" size={16} />
                    </div>

                    {expandedProvider === 'volcengine' && (
                      <div className="provider-body">
                        <div className="settings-field">
                          <label htmlFor="apiKey">API Key (豆包)</label>
                          <div className="settings-input-with-toggle">
                            <input
                              id="apiKey"
                              type={showApiKey ? "text" : "password"}
                              value={settings.apiKey}
                              onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                              className={`settings-input ${errors.apiKey ? 'settings-input--error' : ''}`}
                              placeholder="sk-..."
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="settings-toggle-button"
                            >
                              {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                          <div className="settings-helper-text">
                            前往 <a href="https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey" target="_blank" rel="noopener noreferrer">火山引擎控制台</a> 获取 API Key
                          </div>
                        </div>

                        <div className="settings-field">
                          <label>该供应商下的默认模型</label>
                          <select 
                            className="settings-select"
                            value={settings.defaultModelByProvider.volcengine || ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                setSettings(prev => ({
                                  ...prev,
                                  defaultModelByProvider: { ...prev.defaultModelByProvider, volcengine: e.target.value },
                                }));
                              }
                            }}
                          >
                            <option value="" disabled>选择默认模型</option>
                            {providerModels.volcengine.filter(m => m.apiModel.trim().length > 0).map(model => (
                              <option key={model.apiModel} value={model.apiModel}>
                                {model.displayName || model.apiModel}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="settings-field">
                          <label>模型映射（显示名称 ↔ 实际模型）</label>
                          {errors.models && <div className="settings-field-error">{errors.models}</div>}
                          <div className="settings-model-list">
                            {providerModels.volcengine.map((model, index) => (
                              <div key={`${model.provider}-${index}-${model.apiModel}`} className="settings-model-row">
                                <input
                                  type="text"
                                  className="settings-input"
                                  value={model.displayName}
                                  placeholder="前端显示名称，例如：豆包图片"
                                  onChange={(e) => updateProviderModel('volcengine', index, { displayName: e.target.value })}
                                />
                                <input
                                  type="text"
                                  className="settings-input"
                                  value={model.apiModel}
                                  placeholder="实际模型，例如：doubao-seedream-4-5-251128"
                                  onChange={(e) => updateProviderModel('volcengine', index, { apiModel: e.target.value })}
                                />
                                <button
                                  type="button"
                                  className="settings-model-remove"
                                  onClick={() => removeProviderModel('volcengine', index)}
                                  title="删除"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="settings-model-add"
                            onClick={() => addProviderModel('volcengine')}
                          >
                            <Plus size={16} /> 新增模型
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ModelScope Provider */}
                  <div className={classNames('provider-card', { 'expanded': expandedProvider === 'modelscope' })}>
                    <div 
                      className="provider-header"
                      onClick={() => setExpandedProvider(expandedProvider === 'modelscope' ? null : 'modelscope')}
                    >
                      <div className="provider-info">
                        <div className="provider-icon modelscope-icon">M</div>
                        <div className="provider-details">
                          <span className="provider-name">魔搭社区 (ModelScope)</span>
                          <span className="provider-status">
                            {isProviderConfigured('modelscope') ? (
                              <span className="status-configured"><Check size={12} /> 已配置</span>
                            ) : (
                              <span className="status-missing">未配置</span>
                            )}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="provider-chevron" size={16} />
                    </div>

                    {expandedProvider === 'modelscope' && (
                      <div className="provider-body">
                        <div className="settings-field">
                          <label htmlFor="modelScopeApiKey">Access Token</label>
                          <div className="settings-input-with-toggle">
                            <input
                              id="modelScopeApiKey"
                              type={showModelScopeApiKey ? "text" : "password"}
                              value={settings.modelScopeApiKey}
                              onChange={(e) => setSettings(prev => ({ ...prev, modelScopeApiKey: e.target.value }))}
                              className={`settings-input ${errors.modelScopeApiKey ? 'settings-input--error' : ''}`}
                              placeholder="输入 Access Token"
                            />
                            <button
                              type="button"
                              onClick={() => setShowModelScopeApiKey(!showModelScopeApiKey)}
                              className="settings-toggle-button"
                            >
                              {showModelScopeApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                          <div className="settings-helper-text">
                            前往 <a href="https://modelscope.cn/my/myaccesstoken" target="_blank" rel="noopener noreferrer">ModelScope 控制台</a> 获取 Access Token
                          </div>
                        </div>

                        <div className="settings-field">
                          <label>该供应商下的默认模型</label>
                          <select 
                            className="settings-select"
                            value={settings.defaultModelByProvider.modelscope || ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                setSettings(prev => ({
                                  ...prev,
                                  defaultModelByProvider: { ...prev.defaultModelByProvider, modelscope: e.target.value },
                                }));
                              }
                            }}
                          >
                            <option value="" disabled>选择默认模型</option>
                            {providerModels.modelscope.filter(m => m.apiModel.trim().length > 0).map(model => (
                              <option key={model.apiModel} value={model.apiModel}>
                                {model.displayName || model.apiModel}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="settings-field">
                          <label>模型映射（显示名称 ↔ 实际模型）</label>
                          {errors.models && <div className="settings-field-error">{errors.models}</div>}
                          <div className="settings-model-list">
                            {providerModels.modelscope.map((model, index) => (
                              <div key={`${model.provider}-${index}-${model.apiModel}`} className="settings-model-row">
                                <input
                                  type="text"
                                  className="settings-input"
                                  value={model.displayName}
                                  placeholder="前端显示名称，例如：通义图片"
                                  onChange={(e) => updateProviderModel('modelscope', index, { displayName: e.target.value })}
                                />
                                <input
                                  type="text"
                                  className="settings-input"
                                  value={model.apiModel}
                                  placeholder="实际模型，例如：Tongyi-MAI/Z-Image-Turbo"
                                  onChange={(e) => updateProviderModel('modelscope', index, { apiModel: e.target.value })}
                                />
                                <button
                                  type="button"
                                  className="settings-model-remove"
                                  onClick={() => removeProviderModel('modelscope', index)}
                                  title="删除"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="settings-model-add"
                            onClick={() => addProviderModel('modelscope')}
                          >
                            <Plus size={16} /> 新增模型
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 通用设置 Tab */}
            {activeTab === 'general' && (
              <div className="settings-tab-content">
                <div className="settings-section-header">
                  <h4>通用设置</h4>
                </div>

                <div className="settings-card">
                  <div className="settings-toggle-item">
                    <div className="settings-toggle-info">
                      <span className="settings-toggle-title">AI生成水印</span>
                      <span className="settings-toggle-desc">在生成的图片上添加隐式水印或标识</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.watermarkEnabled}
                      onClick={() => setSettings(prev => ({ ...prev, watermarkEnabled: !prev.watermarkEnabled }))}
                      className={`settings-switch ${settings.watermarkEnabled ? 'settings-switch--on' : 'settings-switch--off'}`}
                    >
                      <span className="settings-switch-thumb" />
                    </button>
                  </div>
                </div>

                <div className="settings-card" style={{ marginTop: '16px' }}>
                  <div className="settings-field">
                    <label htmlFor="apiEndpoint">API 端点 (高级)</label>
                    <div className="settings-input-wrapper">
                      <Server size={14} className="input-icon" />
                      <input
                        id="apiEndpoint"
                        type="url"
                        value={settings.apiEndpoint}
                        onChange={(e) => setSettings(prev => ({ ...prev, apiEndpoint: e.target.value }))}
                        className="settings-input settings-input--has-icon"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 关于 Tab */}
            {activeTab === 'about' && (
              <div className="settings-tab-content">
                 <div className="about-content">
                   <div className="app-logo">🎨</div>
                   <h3>Drawnix</h3>
                   <p className="version">v0.1.0 (Beta)</p>
                   <p className="description">
                     Drawnix 是一个无限画布AI绘图工具，支持多种AI模型，帮助你释放创意。
                   </p>
                   <div className="about-links">
                     <a href="#" className="about-link">使用文档</a>
                     <a href="#" className="about-link">GitHub</a>
                     <a href="#" className="about-link">反馈问题</a>
                   </div>
                 </div>
              </div>
            )}
          </div>
        </div>

        <div className="settings-modal-footer">
          <button
            type="button"
            className="settings-modal-reset"
            onClick={handleReset}
          >
            重置
          </button>
          <div className="settings-modal-main-actions">
            <button
              type="button"
              className="settings-modal-cancel"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="settings-modal-save"
              onClick={handleSave}
            >
              保存更改
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
