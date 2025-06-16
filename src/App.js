import React, { useState, useEffect } from 'react';
import './App.css';

const LANGUAGES = {
  'auto': 'Tự động phát hiện',
  'af': 'Afrikaans',
  'sq': 'Albanian',
  'am': 'Amharic',
  'ar': 'Arabic',
  'hy': 'Armenian',
  'az': 'Azerbaijani',
  'eu': 'Basque',
  'be': 'Belarusian',
  'bn': 'Bengali',
  'bs': 'Bosnian',
  'bg': 'Bulgarian',
  'ca': 'Catalan',
  'ceb': 'Cebuano',
  'ny': 'Chichewa',
  'zh': 'Chinese',
  'zh-cn': 'Chinese (Simplified)',
  'zh-tw': 'Chinese (Traditional)',
  'co': 'Corsican',
  'hr': 'Croatian',
  'cs': 'Czech',
  'da': 'Danish',
  'nl': 'Dutch',
  'en': 'English',
  'eo': 'Esperanto',
  'et': 'Estonian',
  'tl': 'Filipino',
  'fi': 'Finnish',
  'fr': 'French',
  'fy': 'Frisian',
  'gl': 'Galician',
  'ka': 'Georgian',
  'de': 'German',
  'el': 'Greek',
  'gu': 'Gujarati',
  'ht': 'Haitian Creole',
  'ha': 'Hausa',
  'haw': 'Hawaiian',
  'he': 'Hebrew',
  'hi': 'Hindi',
  'hmn': 'Hmong',
  'hu': 'Hungarian',
  'is': 'Icelandic',
  'ig': 'Igbo',
  'id': 'Indonesian',
  'ga': 'Irish',
  'it': 'Italian',
  'ja': 'Japanese',
  'jv': 'Javanese',
  'kn': 'Kannada',
  'kk': 'Kazakh',
  'km': 'Khmer',
  'rw': 'Kinyarwanda',
  'ko': 'Korean',
  'ku': 'Kurdish',
  'ky': 'Kyrgyz',
  'lo': 'Lao',
  'la': 'Latin',
  'lv': 'Latvian',
  'lt': 'Lithuanian',
  'lb': 'Luxembourgish',
  'mk': 'Macedonian',
  'mg': 'Malagasy',
  'ms': 'Malay',
  'ml': 'Malayalam',
  'mt': 'Maltese',
  'mi': 'Maori',
  'mr': 'Marathi',
  'mn': 'Mongolian',
  'my': 'Myanmar (Burmese)',
  'ne': 'Nepali',
  'no': 'Norwegian',
  'or': 'Odia',
  'ps': 'Pashto',
  'fa': 'Persian',
  'pl': 'Polish',
  'pt': 'Portuguese',
  'pa': 'Punjabi',
  'ro': 'Romanian',
  'ru': 'Russian',
  'sm': 'Samoan',
  'gd': 'Scots Gaelic',
  'sr': 'Serbian',
  'st': 'Sesotho',
  'sn': 'Shona',
  'sd': 'Sindhi',
  'si': 'Sinhala',
  'sk': 'Slovak',
  'sl': 'Slovenian',
  'so': 'Somali',
  'es': 'Spanish',
  'su': 'Sundanese',
  'sw': 'Swahili',
  'sv': 'Swedish',
  'tg': 'Tajik',
  'ta': 'Tamil',
  'tt': 'Tatar',
  'te': 'Telugu',
  'th': 'Thai',
  'tr': 'Turkish',
  'tk': 'Turkmen',
  'uk': 'Ukrainian',
  'ur': 'Urdu',
  'ug': 'Uyghur',
  'uz': 'Uzbek',
  'vi': 'Vietnamese',
  'cy': 'Welsh',
  'xh': 'Xhosa',
  'yi': 'Yiddish',
  'yo': 'Yoruba',
  'zu': 'Zulu'
};

function App() {
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('vi');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detectedLang, setDetectedLang] = useState('');
  const [sourceSearchOpen, setSourceSearchOpen] = useState(false);
  const [targetSearchOpen, setTargetSearchOpen] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');

  // Function to translate text using multiple API fallbacks
  const translateText = async (text, source, target) => {
    if (!text.trim()) {
      setTranslatedText('');
      return;
    }

    setLoading(true);
    setError('');

    // List of APIs to try
    const apis = [
      // Your Railway API
      {
        name: 'Railway API',
        url: 'https://trans-api-production.up.railway.app/translate',
        body: { q: text, source: source, target: target },
        headers: { 'Content-Type': 'application/json' }
      },
      // Alternative Railway endpoint
      {
        name: 'Railway API Alt',
        url: 'https://trans-api-production.up.railway.app/api/translate',
        body: { q: text, source_lang: source, target_lang: target },
        headers: { 'Content-Type': 'application/json' }
      },
      // MyMemory API (free, no CORS issues)
      {
        name: 'MyMemory API',
        url: `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`,
        method: 'GET',
        headers: {}
      },
      // LibreTranslate
      {
        name: 'LibreTranslate',
        url: 'https://libretranslate.com/translate',
        body: { q: text, source: source, target: target },
        headers: { 'Content-Type': 'application/json' }
      },
      // Google Translate Alternative
      {
        name: 'Translate API',
        url: 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + source + '&tl=' + target + '&dt=t&q=' + encodeURIComponent(text),
        method: 'GET',
        headers: {}
      }
    ];

    for (const api of apis) {
      try {
        console.log(`Trying ${api.name}...`);
        
        const fetchOptions = {
          method: api.method || 'POST',
          headers: api.headers || { 'Content-Type': 'application/json' }
        };

        // Only add body for POST requests
        if (api.body && (api.method || 'POST') === 'POST') {
          fetchOptions.body = JSON.stringify(api.body);
        }

        const response = await fetch(api.url, fetchOptions);
        console.log(`${api.name} response status:`, response.status);

        if (response.ok) {
          const data = await response.json();
          console.log(`${api.name} response data:`, data);
          
          let translatedText = '';
          
          // Handle different response formats
          if (api.name === 'MyMemory API') {
            translatedText = data.responseData?.translatedText;
          } else if (api.name === 'Translate API') {
            // Google Translate API format
            if (data && data[0] && data[0][0] && data[0][0][0]) {
              translatedText = data[0][0][0];
            }
          } else {
            // Standard format
            translatedText = data.translatedText || data.translated_text || data.sentences;
          }
          
          if (translatedText) {
            setTranslatedText(translatedText);
            
            // Handle detected language
            if (data.detectedLanguage || data.detected_language) {
              setDetectedLang(data.detectedLanguage?.language || data.detected_language);
            }
            
            setLoading(false);
            console.log(`✅ Success with ${api.name}`);
            return;
          }
        } else {
          const errorText = await response.text();
          console.log(`${api.name} error:`, response.status, errorText);
        }
      } catch (err) {
        console.log(`${api.name} failed:`, err.message);
      }
    }

    // If all APIs fail, show error
    setError('Không thể kết nối đến dịch vụ dịch văn bản. Vui lòng kiểm tra kết nối mạng và thử lại sau.');
    setLoading(false);
  };

  // Handle text translation with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (sourceText.trim()) {
        translateText(sourceText, sourceLang, targetLang);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [sourceText, sourceLang, targetLang]);

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

  // Text-to-speech function
  const speakText = (text, lang) => {
    if (!text.trim()) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set language for speech
    const speechLang = lang === 'zh' ? 'zh-CN' : lang;
    utterance.lang = speechLang;
    
    // Configure speech settings
    utterance.rate = 0.8;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Handle speech events
    utterance.onstart = () => {
      console.log('Speech started');
    };

    utterance.onend = () => {
      console.log('Speech ended');
    };

    utterance.onerror = (event) => {
      console.error('Speech error:', event.error);
      alert('Lỗi khi phát âm thanh. Trình duyệt có thể không hỗ trợ ngôn ngữ này.');
    };

    window.speechSynthesis.speak(utterance);
  };

  // Swap languages
  const swapLanguages = () => {
    if (sourceLang === 'auto') return; // Can't swap if source is auto-detect
    
    const tempLang = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(tempLang);
    
    const tempText = sourceText;
    setSourceText(translatedText);
    setTranslatedText(tempText);
  };

  // Clear all text
  const clearAll = () => {
    setSourceText('');
    setTranslatedText('');
    setDetectedLang('');
    setError('');
  };

  // Filter languages based on search
  const filterLanguages = (search, excludeAuto = false) => {
    const langs = excludeAuto 
      ? Object.entries(LANGUAGES).filter(([code]) => code !== 'auto')
      : Object.entries(LANGUAGES);
    
    if (!search) return langs;
    
    return langs.filter(([code, name]) => 
      name.toLowerCase().includes(search.toLowerCase()) ||
      code.toLowerCase().includes(search.toLowerCase())
    );
  };

  // Custom Language Selector Component
  const LanguageSelector = ({ 
    value, 
    onChange, 
    excludeAuto = false, 
    searchOpen, 
    setSearchOpen, 
    search, 
    setSearch,
    label,
    id 
  }) => {
    const filteredLanguages = filterLanguages(search, excludeAuto);
    const selectedLang = LANGUAGES[value] || value;

    return (
      <div className="language-group">
        <label htmlFor={id}>{label}:</label>
        <div className="language-selector-container">
          <div 
            className={`language-dropdown ${searchOpen ? 'open' : ''}`}
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <span className="selected-language">
              {selectedLang}
            </span>
            <span className="dropdown-arrow">▼</span>
          </div>
          
          {searchOpen && (
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
          {/* Language Selection */}
          <div className="language-selector">
            <LanguageSelector
              value={sourceLang}
              onChange={setSourceLang}
              excludeAuto={false}
              searchOpen={sourceSearchOpen}
              setSearchOpen={setSourceSearchOpen}
              search={sourceSearch}
              setSearch={setSourceSearch}
              label="Từ"
              id="source-lang"
            />

            <button 
              className="swap-button"
              onClick={swapLanguages}
              disabled={sourceLang === 'auto'}
              title="Hoán đổi ngôn ngữ"
            >
              ⇄
            </button>

            <LanguageSelector
              value={targetLang}
              onChange={setTargetLang}
              excludeAuto={true}
              searchOpen={targetSearchOpen}
              setSearchOpen={setTargetSearchOpen}
              search={targetSearch}
              setSearch={setTargetSearch}
              label="Đến"
              id="target-lang"
            />
          </div>

          {/* Translation Areas */}
          <div className="translation-area">
            <div className="text-panel source-panel">
              <div className="panel-header">
                <span className="panel-title">
                  Văn bản gốc
                  {detectedLang && sourceLang === 'auto' && (
                    <span className="detected-lang">
                      (Phát hiện: {LANGUAGES[detectedLang] || detectedLang})
                    </span>
                  )}
                </span>
                <div className="panel-actions">
                  <button
                    className="action-button speak-button"
                    onClick={() => speakText(sourceText, sourceLang === 'auto' ? detectedLang : sourceLang)}
                    disabled={!sourceText.trim()}
                    title="Phát âm"
                  >
                    🔊
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
                maxLength={5000}
              />
              <div className="char-count">
                {sourceText.length}/5000
              </div>
            </div>

            <div className="text-panel target-panel">
              <div className="panel-header">
                <span className="panel-title">Văn bản đã dịch</span>
                <div className="panel-actions">
                  <button
                    className="action-button speak-button"
                    onClick={() => speakText(translatedText, targetLang)}
                    disabled={!translatedText.trim() || loading}
                    title="Phát âm"
                  >
                    🔊
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
                placeholder={loading ? "Đang dịch..." : "Kết quả dịch sẽ hiển thị ở đây..."}
                value={loading ? "Đang dịch..." : translatedText}
                readOnly
              />
                             {error && (
                 <div className="error-message">
                   {error}
                   <br />
                   <small>Kiểm tra Console (F12) để xem chi tiết lỗi</small>
                 </div>
               )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions">
            <button
              className="quick-action-button"
              onClick={() => translateText(sourceText, sourceLang, targetLang)}
              disabled={!sourceText.trim() || loading}
            >
              🔄 Dịch lại
            </button>
            <button
              className="quick-action-button"
              onClick={() => {
                setSourceText("Hello world! This is a test.");
                setSourceLang("en");
                setTargetLang("vi");
              }}
            >
              🧪 Test
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
        <p>© 2025 Trang Web Dịch Văn Bản - Sử dụng API Translation</p>
        <p>Phát triển bằng ❤️ với React</p>
      </footer>
    </div>
  );
}

export default App;
