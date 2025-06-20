import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';

// API Configuration
const API_CONFIG = {
  baseURL: 'https://trans-api-production.up.railway.app',
  endpoints: {
    languages: '/lang-support',
    translate: '/translation',
    speak: '/speak'
  },
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000
};

// App Configuration
const APP_CONFIG = {
  debounceDelay: 500,
  maxTextLength: 5000,
  autoDetectKey: 'auto'
};

// API Service Functions
const apiService = {
  // Generic fetch with retry logic
  async fetchWithRetry(url, options = {}, attempts = API_CONFIG.retryAttempts) {
    for (let i = 0; i < attempts; i++) {
      // Create new AbortController for each attempt
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // Try to get error details from response
          try {
            const errorData = await response.json();
            const errorMessage = errorData.message || response.statusText;
            throw new Error(`API Error ${response.status}: ${errorMessage}`);
          } catch (parseError) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        }
        
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        console.warn(`API attempt ${i + 1}/${attempts} failed:`, error.message);
        
        if (i === attempts - 1) {
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, API_CONFIG.retryDelay * Math.pow(2, i))
        );
      }
    }
  },

  // Fetch supported languages
  async getLanguages() {
    const url = `${API_CONFIG.baseURL}${API_CONFIG.endpoints.languages}`;
    const response = await this.fetchWithRetry(url, { method: 'GET' });
    const data = await response.json();
    
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      throw new Error('API trả về dữ liệu ngôn ngữ không hợp lệ');
    }
    
    return data;
  },

  // Translate text
  async translateText(text, sourceLang, targetLang) {
    // Ensure proper encoding for special characters
    const params = new URLSearchParams();
    params.append('p1', sourceLang);
    params.append('p2', targetLang);
    params.append('p3', text.trim());
    
    const url = `${API_CONFIG.baseURL}${API_CONFIG.endpoints.translate}?${params}`;
    console.log('🔄 Translation request:', {
      source: sourceLang,
      target: targetLang, 
      text: text.trim(),
      url: url
    });
    
    const response = await this.fetchWithRetry(url, { method: 'GET' });
    const contentType = response.headers.get('content-type');
    
    console.log('📥 Translation response type:', contentType);
    
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      console.log('📦 Translation data:', data);
      
      // Handle multiple possible response formats
      const result = data.translatedText || 
                    data.translated_text || 
                    data.result || 
                    data.sentences || 
                    data.translation ||
                    data.text ||
                    data;
      
      if (typeof result === 'string' && result.trim()) {
        return result;
      } else if (Array.isArray(result) && result.length > 0) {
        // Handle array of sentences/segments
        return result.map(item => 
          typeof item === 'string' ? item : (item.text || item.trans || item)
        ).join(' ');
      } else {
        throw new Error('API trả về định dạng dữ liệu không hợp lệ');
      }
    } else {
      const textResult = await response.text();
      console.log('📄 Translation text result:', textResult);
      
      if (textResult && textResult.trim()) {
        return textResult;
      } else {
        throw new Error('API không trả về kết quả dịch');
      }
    }
  },

  // Text to speech
  async getAudioURL(text, lang) {
    // Ensure proper encoding for special characters
    const params = new URLSearchParams();
    params.append('lang', lang);
    params.append('word', text.trim());
    
    const url = `${API_CONFIG.baseURL}${API_CONFIG.endpoints.speak}?${params}`;
    console.log('🔊 Speech request:', {
      language: lang,
      text: text.trim(),
      url: url
    });
    
    const response = await this.fetchWithRetry(url, { method: 'GET' });
    const contentType = response.headers.get('content-type');
    
    console.log('🎵 Speech response type:', contentType);
    
    if (contentType?.includes('audio')) {
      const audioBlob = await response.blob();
      console.log('🎧 Audio blob created, size:', audioBlob.size);
      return URL.createObjectURL(audioBlob);
    } else {
      const responseText = await response.text();
      console.log('📄 Speech text response:', responseText);
      
      if (responseText.startsWith('http')) {
        console.log('🔗 Using external audio URL');
        return responseText;
      }
      throw new Error('API không trả về dữ liệu âm thanh hợp lệ');
    }
  }
};

// Language Detection Helper
const detectLanguageFromText = (text) => {
  if (!text || !text.trim()) return null;
  
  const trimmedText = text.trim().toLowerCase();
  
  // Vietnamese detection (diacritics and common words)
  if (/[àáâãäăắằẳẵặèéêëếềểễệìíîïịòóôõöồốổỗộơớờởỡợùúûüụưứừửữựỳýỵỷỹđ]/.test(text) ||
      /\b(và|của|trong|với|để|này|đó|có|không|là|một|được|từ|theo|khi|sẽ|đã|cho|về|bởi|những|các|tại|sau|trước|giữa|nơi|nào|như|tất cả|xin chào|cảm ơn)\b/.test(trimmedText)) {
    return 'vi';
  }
  
  // English detection
  if (/\b(the|and|or|of|in|to|for|with|on|at|by|from|as|is|was|are|were|be|been|have|has|had|do|does|did|will|would|could|should|may|might|can|hello|thank you|yes|no)\b/.test(trimmedText)) {
    return 'en';
  }
  
  // Chinese detection (Chinese characters)
  if (/[\u4e00-\u9fff]/.test(text)) {
    return 'zh';
  }
  
  // Japanese detection (Hiragana, Katakana, Kanji)
  if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(text)) {
    return 'ja';
  }
  
  // Korean detection (Hangul)
  if (/[\uac00-\ud7af]/.test(text)) {
    return 'ko';
  }
  
  // Thai detection
  if (/[\u0e00-\u0e7f]/.test(text)) {
    return 'th';
  }
  
  // Russian detection (Cyrillic)
  if (/[\u0400-\u04ff]/.test(text)) {
    return 'ru';
  }
  
  // French detection
  if (/[àâäéèêëïîôûùüÿç]/.test(text) ||
      /\b(le|la|les|de|du|des|et|ou|est|sont|avoir|être|avec|pour|sur|dans|par|une|un|ce|cette|qui|que|dont|où|bonjour|merci|oui|non)\b/.test(trimmedText)) {
    return 'fr';
  }
  
  // German detection
  if (/[äöüß]/.test(text) ||
      /\b(der|die|das|und|oder|ist|sind|haben|sein|mit|für|auf|in|von|zu|eine|ein|dass|wenn|aber|auch|nur|sehr|wie|was|wo|hallo|danke|ja|nein)\b/.test(trimmedText)) {
    return 'de';
  }
  
  // Spanish detection
  if (/[ñáéíóúü]/.test(text) ||
      /\b(el|la|los|las|y|o|es|son|tener|ser|con|para|en|de|por|una|un|que|si|pero|también|muy|como|qué|dónde|hola|gracias|sí|no)\b/.test(trimmedText)) {
    return 'es';
  }
  
  return null; // Cannot detect
};

// Custom Hooks
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const useLanguages = () => {
  const [languages, setLanguages] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLanguages = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('🌐 Fetching languages...');
      const data = await apiService.getLanguages();
      
      // Add auto-detect option
      const languagesWithAuto = {
        [APP_CONFIG.autoDetectKey]: 'Tự động phát hiện',
        ...data
      };
      
      setLanguages(languagesWithAuto);
      console.log(`✅ Loaded ${Object.keys(data).length} languages`);
    } catch (err) {
      console.error('❌ Failed to fetch languages:', err);
      
      // Fallback to basic languages when API fails
      const fallbackLanguages = {
        [APP_CONFIG.autoDetectKey]: 'Tự động phát hiện',
        'en': 'English',
        'vi': 'Tiếng Việt',
        'zh': 'Chinese',
        'ja': 'Japanese',
        'ko': 'Korean',
        'fr': 'French',
        'de': 'German',
        'es': 'Spanish',
        'ru': 'Russian',
        'th': 'Thai'
      };
      
      setLanguages(fallbackLanguages);
      setError(`⚠️ API Server không phản hồi. Đang sử dụng danh sách ngôn ngữ cơ bản. Chi tiết lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLanguages();
  }, [fetchLanguages]);

  return { languages, loading, error, refetch: fetchLanguages };
};

function App() {
  // States
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState(APP_CONFIG.autoDetectKey);
  const [targetLang, setTargetLang] = useState('vi');
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState('');
  const [sourceSearchOpen, setSourceSearchOpen] = useState(false);
  const [targetSearchOpen, setTargetSearchOpen] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [sourceSpeaking, setSourceSpeaking] = useState(false);
  const [targetSpeaking, setTargetSpeaking] = useState(false);

  // Custom hooks
  const { languages, loading: languagesLoading, error: languagesError, refetch } = useLanguages();
  const debouncedSourceText = useDebounce(sourceText, APP_CONFIG.debounceDelay);

  // Auto-translate when text changes
  useEffect(() => {
    if (debouncedSourceText.trim() && Object.keys(languages).length > 0) {
      handleTranslate(debouncedSourceText, sourceLang, targetLang);
    } else {
      setTranslatedText('');
    }
  }, [debouncedSourceText, sourceLang, targetLang, languages]);

  // Translation function
  const handleTranslate = useCallback(async (text, source, target) => {
    if (!text.trim()) return;

    try {
      setTranslating(true);
      setTranslationError('');
      
      console.log('🔄 Translating...');
      const result = await apiService.translateText(text, source, target);
      
      if (result && result.trim()) {
        setTranslatedText(result);
        console.log('✅ Translation successful');
      } else {
        throw new Error('API không trả về kết quả dịch');
      }
    } catch (err) {
      console.error('❌ Translation failed:', err);
      let errorMessage = err.message;
      
      if (err.message.includes('502')) {
        errorMessage = '🔧 API Server đang bảo trì hoặc quá tải. Vui lòng thử lại sau.';
      } else if (err.message.includes('Failed to fetch')) {
        errorMessage = '🌐 Không thể kết nối đến server. Kiểm tra kết nối internet.';
      }
      
      setTranslationError(`Lỗi dịch: ${errorMessage}`);
    } finally {
      setTranslating(false);
    }
  }, []);

  // Speech function
  const handleSpeak = useCallback(async (text, lang, isSource = true) => {
    if (!text.trim()) return;

    const setSpeaking = isSource ? setSourceSpeaking : setTargetSpeaking;

    try {
      setSpeaking(true);
      console.log('🔊 Getting audio...');
      
      // Handle auto-detect language case
      let speechLang = lang;
      if (lang === APP_CONFIG.autoDetectKey) {
        // For auto-detect, try to detect language based on text content
        speechLang = detectLanguageFromText(text) || 'vi'; // Default fallback
        console.log('⚠️ Auto-detect language for speech, detected:', speechLang);
      }
      
      const audioURL = await apiService.getAudioURL(text, speechLang);
      
      const audio = new Audio(audioURL);
      
      // Handle audio events
      audio.onended = () => {
        setSpeaking(false);
        if (audioURL.startsWith('blob:')) {
          URL.revokeObjectURL(audioURL);
        }
      };
      
      audio.onerror = () => {
        setSpeaking(false);
        if (audioURL.startsWith('blob:')) {
          URL.revokeObjectURL(audioURL);
        }
      };
      
      await audio.play();
      console.log('✅ Audio playing');
    } catch (err) {
      setSpeaking(false);
      console.error('❌ Speech failed:', err);
      
      let errorMessage = err.message;
      if (err.message.includes('502')) {
        errorMessage = '🔧 Speech API đang bảo trì hoặc quá tải. Vui lòng thử lại sau.';
      } else if (err.message.includes('Failed to fetch')) {
        errorMessage = '🌐 Không thể kết nối đến speech server. Kiểm tra kết nối internet.';
      }
      
      alert(`Lỗi phát âm: ${errorMessage}`);
    }
  }, []);

  // Utility functions
  const swapLanguages = useCallback(() => {
    if (sourceLang === APP_CONFIG.autoDetectKey) return;
    
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  }, [sourceLang, targetLang, sourceText, translatedText]);

  const clearAll = useCallback(() => {
    setSourceText('');
    setTranslatedText('');
    setTranslationError('');
    setSourceSearch('');
    setTargetSearch('');
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.language-selector-container')) {
        setSourceSearchOpen(false);
        setTargetSearchOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Filter languages based on search
  const filterLanguages = useCallback((search, excludeAuto = false) => {
    const langs = excludeAuto 
      ? Object.entries(languages).filter(([code]) => code !== APP_CONFIG.autoDetectKey)
      : Object.entries(languages);
    
    if (!search.trim()) return langs;
    
    return langs.filter(([code, name]) => 
      name.toLowerCase().includes(search.toLowerCase()) ||
      code.toLowerCase().includes(search.toLowerCase())
    );
  }, [languages]);

  // Memoized filtered languages
  const sourceLanguages = useMemo(() => 
    filterLanguages(sourceSearch, false), 
    [filterLanguages, sourceSearch]
  );
  
  const targetLanguages = useMemo(() => 
    filterLanguages(targetSearch, true), 
    [filterLanguages, targetSearch]
  );

  // Language Selector Component
  const LanguageSelector = ({ 
    value, 
    onChange, 
    searchOpen, 
    setSearchOpen, 
    search, 
    setSearch,
    filteredLanguages,
    label,
    id 
  }) => {
    const selectedLang = languages[value] || value;

    return (
      <div className="language-group">
        <label htmlFor={id}>{label}:</label>
        <div className="language-selector-container">
          <div 
            className={`language-dropdown ${searchOpen ? 'open' : ''}`}
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <span className="selected-language">
              {languagesLoading ? 'Đang tải...' : selectedLang}
            </span>
            <span className="dropdown-arrow">▼</span>
          </div>
          
          {searchOpen && !languagesLoading && (
            <div className="language-dropdown-menu">
              <input
                type="text"
                className="language-search"
                placeholder="Tìm kiếm ngôn ngữ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
              <div className="language-options">
                {filteredLanguages.map(([code, name]) => (
                  <div
                    key={code}
                    className={`language-option ${value === code ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(code);
                      setSearchOpen(false);
                      setSearch('');
                    }}
                  >
                    <span className="language-name">{name}</span>
                    <span className="language-code">({code})</span>
                  </div>
                ))}
                {filteredLanguages.length === 0 && (
                  <div className="no-results">Không tìm thấy ngôn ngữ</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };



  return (
    <div className="App">
      <header className="app-header">
        <h1>🌐 Trang Web Dịch Văn Bản</h1>
        <p>Trang web dịch văn bản miễn phí hỗ trợ hơn 100 ngôn ngữ</p>
      </header>

      <main className="app-main">
        <div className="translator-container">
          {/* Languages Loading State */}
          {languagesLoading && (
            <div className="status-message loading">
              <p>🌐 Đang tải danh sách ngôn ngữ...</p>
            </div>
          )}
          
          {/* Languages Error State */}
          {languagesError && !languagesLoading && (
            <div className="status-message error">
              <p>{languagesError}</p>
              <button className="retry-button" onClick={refetch}>
                🔄 Thử lại
              </button>
            </div>
          )}

          {/* Language Selection */}
          {!languagesLoading && !languagesError && (
            <div className="language-selector">
              <LanguageSelector
                value={sourceLang}
                onChange={setSourceLang}
                searchOpen={sourceSearchOpen}
                setSearchOpen={setSourceSearchOpen}
                search={sourceSearch}
                setSearch={setSourceSearch}
                filteredLanguages={sourceLanguages}
                label="Từ"
                id="source-lang"
              />

              <button 
                className="swap-button"
                onClick={swapLanguages}
                disabled={sourceLang === APP_CONFIG.autoDetectKey}
                title="Hoán đổi ngôn ngữ"
              >
                ⇄
              </button>

              <LanguageSelector
                value={targetLang}
                onChange={setTargetLang}
                searchOpen={targetSearchOpen}
                setSearchOpen={setTargetSearchOpen}
                search={targetSearch}
                setSearch={setTargetSearch}
                filteredLanguages={targetLanguages}
                label="Đến"
                id="target-lang"
              />
            </div>
          )}

          {/* Translation Areas */}
          <div className="translation-area">
            <div className="text-panel source-panel">
              <div className="panel-header">
                <span className="panel-title">Văn bản gốc</span>
                <div className="panel-actions">
                  <button
                    className="action-button speak-button"
                    onClick={() => handleSpeak(sourceText, sourceLang, true)}
                    disabled={!sourceText.trim() || sourceSpeaking}
                    title={sourceSpeaking ? "Đang phát âm..." : "Phát âm"}
                  >
                    {sourceSpeaking ? '🔄' : '🔊'}
                  </button>
                  <button
                    className="action-button clear-button"
                    onClick={clearAll}
                    title="Xóa tất cả"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <textarea
                className="text-input"
                placeholder="Nhập văn bản cần dịch..."
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                maxLength={APP_CONFIG.maxTextLength}
              />
              <div className="char-count">
                {sourceText.length}/{APP_CONFIG.maxTextLength}
              </div>
            </div>

            <div className="text-panel target-panel">
              <div className="panel-header">
                <span className="panel-title">
                  Văn bản đã dịch
                  {translating && <span className="translating"> (đang dịch...)</span>}
                </span>
                <div className="panel-actions">
                  <button
                    className="action-button speak-button"
                    onClick={() => handleSpeak(translatedText, targetLang, false)}
                    disabled={!translatedText.trim() || translating || targetSpeaking}
                    title={targetSpeaking ? "Đang phát âm..." : "Phát âm"}
                  >
                    {targetSpeaking ? '🔄' : '🔊'}
                  </button>
                  <button
                    className="action-button copy-button"
                    onClick={() => {
                      navigator.clipboard.writeText(translatedText);
                      alert('Đã sao chép!');
                    }}
                    disabled={!translatedText.trim()}
                    title="Sao chép"
                  >
                    📋
                  </button>
                </div>
              </div>
              <textarea
                className="text-output"
                placeholder={translating ? "Đang dịch..." : "Kết quả dịch sẽ hiển thị ở đây..."}
                value={translating ? "Đang dịch..." : translatedText}
                readOnly
              />
              {translationError && (
                <div className="error-message">
                  {translationError}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions">
            <button
              className="quick-action-button"
              onClick={() => handleTranslate(sourceText, sourceLang, targetLang)}
              disabled={!sourceText.trim() || translating}
            >
              🔄 Dịch lại
            </button>
            <button
              className="quick-action-button"
              onClick={clearAll}
            >
              🗑️ Xóa tất cả
            </button>
          </div>
        </div>

        {/* Features Info */}
        <div className="features-info">
          <h3>✨ Tính năng</h3>
          <div className="features-grid">
            <div className="feature-item">
              <span className="feature-icon">🌍</span>
              <span className="feature-text">Hỗ trợ hơn 100 ngôn ngữ</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🤖</span>
              <span className="feature-text">Tự động phát hiện ngôn ngữ</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🔊</span>
              <span className="feature-text">Chuyển văn bản thành giọng nói</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">⚡</span>
              <span className="feature-text">Dịch theo thời gian thực</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>© 2025 Trang Web Dịch Văn Bản - Sử dụng Railway API</p>
        <p>Phát triển bằng ❤️ với React</p>
      </footer>
    </div>
  );
}

export default App;
