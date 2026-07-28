import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import html2pdf from 'html2pdf.js';
import './App.css';

const API_URL = 'https://globalnewshub-backend.onrender.com/api/search';

// بيانات الصحف العربية والخليجية
const ARABIC_NEWSPAPERS = {
  '🇶🇦 قطر': { 'الجزيرة': 'https://www.aljazeera.com', 'عربي21': 'https://arabi21.com', 'العرب': 'https://alarab.co.uk' },
  '🇸 السعودية': { 'العربية': 'https://www.alarabiya.net', 'عكاظ': 'https://www.okaz.com.sa', 'سبق': 'https://sabq.org' },
  '🇪 الإمارات': { 'Sky News Arabia': 'https://www.skynewsarabia.com', 'الخليج': 'https://www.alkhaleej.ae', 'البيان': 'https://www.albayan.ae' },
  '🇧 بريطانيا': { 'BBC عربي': 'https://www.bbc.com/arabic', 'القدس العربي': 'https://www.alquds.co.uk' },
  '🇫🇷 فرنسا': { 'مونت كارلو': 'https://www.mc-doualiya.com', 'فرانس 24': 'https://www.france24.com/ar' },
  '🇩🇪 ألمانيا': { 'DW عربي': 'https://www.dw.com/ar' },
  '🇷🇺 روسيا': { 'RT عربي': 'https://arabic.rt.com', 'سبوتنيك': 'https://arabic.sputniknews.com' },
  '🇹🇷 تركيا': { 'الأناضول': 'https://www.aa.com.tr/ar' }
};

const GULF_NEWSPAPERS = {
  '🇸 السعودية': { 'العربية': 'https://www.alarabiya.net', 'عكاظ': 'https://www.okaz.com.sa', 'سبق': 'https://sabq.org', 'الاقتصادية': 'https://www.aleqt.com' },
  '🇪 الإمارات': { 'Sky News Arabia': 'https://www.skynewsarabia.com', 'الخليج': 'https://www.alkhaleej.ae', 'البيان': 'https://www.albayan.ae', 'الاتحاد': 'https://www.alittihad.ae' },
  '🇶🇦 قطر': { 'الجزيرة': 'https://www.aljazeera.com', 'عربي21': 'https://arabi21.com', 'الراية': 'https://raya.com' },
  '🇰 الكويت': { 'القبس': 'https://alqabas.com', 'الرأي': 'https://www.alraimedia.com', 'الأنباء': 'https://www.alanba.com.kw', 'الجريدة': 'https://www.aljarida.com' },
  '🇧🇭 البحرين': { 'أخبار الخليج': 'https://www.akhbar-alkhaleej.com', 'الوسط': 'https://www.alwasatnews.com' },
  '🇴🇲 عمان': { 'عمان': 'https://www.omandaily.om', 'الرؤية': 'https://www.alroya.om', 'الشبيبة': 'https://www.alshabiba.com' }
};

const GULF_ALERT_KEYWORDS = {
  'السعودية': ['السعودية', 'riyadh', 'vision 2030', 'neom', 'ولي العهد'],
  'الإمارات': ['الإمارات', 'dubai', 'abu dhabi', 'expo'],
  'الكويت': ['الكويت', 'kuwait city', 'مجلس الأمة'],
  'قطر': ['قطر', 'qatar', 'الدوحة'],
  'البحرين': ['البحرين', 'bahrain', 'المنامة'],
  'عمان': ['عمان', 'oman', 'مسقط', 'سلطنة عمان']
};

function App() {
  const [query, setQuery] = useState('');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchCount, setSearchCount] = useState(0);
  const [noResultsMessage, setNoResultsMessage] = useState('');
  
  const [sourceFilter, setSourceFilter] = useState('');
  const [maxDays, setMaxDays] = useState(3);
  const [showBreakingOnly, setShowBreakingOnly] = useState(false);
  
  const [activeMenu, setActiveMenu] = useState(null);
  const [gulfAlert, setGulfAlert] = useState(null);
  
  // حالات النافذة المنبثقة للبحث الشامل
  const [showGlobalSearchModal, setShowGlobalSearchModal] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // دالة البحث الموحدة (تعمل للبحث العادي والشامل)
  const searchNews = async (isGlobalSearch = false) => {
    const currentQuery = isGlobalSearch ? globalQuery : query;
    if (!currentQuery.trim() && !showBreakingOnly) return;
    
    setLoading(true);
    setError('');
    setNoResultsMessage('');
    setArticles([]);
    
    checkGulfAlerts(currentQuery);

    try {
      const response = await axios.post(API_URL, {
        query: showBreakingOnly ? 'عاجل breaking' : currentQuery,
        language: 'ar',
        source_filter: isGlobalSearch ? '' : sourceFilter,
        max_days: maxDays,
        global_search: isGlobalSearch,
        include_blogs: isGlobalSearch 
      });
      
      let results = response.data.articles || [];
      if (showBreakingOnly) results = results.filter(art => art.is_breaking);
      
      if (results.length > 0) {
        setArticles(results);
        setSearchCount(results.length);
      } else {
        setNoResultsMessage(`لا توجد نتائج للبحث عن "${currentQuery}" في المصادر المتاحة حالياً.`);
      }
    } catch (err) {
      setError('حدث خطأ في جلب الأخبار. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const checkGulfAlerts = (text) => {
    const lowerText = text.toLowerCase();
    for (const [country, keywords] of Object.entries(GULF_ALERT_KEYWORDS)) {
      if (keywords.some(kw => lowerText.includes(kw))) {
        setGulfAlert({ country, message: `🔔 تنبيه عاجل: تم رصد حدث يتعلق بـ ${country}` });
        setTimeout(() => setGulfAlert(null), 8000);
        break;
      }
    }
  };

  const saveAsPDF = (article) => {
    const element = document.createElement('div');
    element.innerHTML = `
      <div style="font-family: 'Tajawal', sans-serif; direction: rtl; padding: 20px;">
        <h1 style="color: #2c3e50; text-align: center;">${article.title}</h1>
        <div style="background: #f5f7fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>📰 المصدر:</strong> ${article.source} | <strong>🌍 الدولة:</strong> ${article.country}</p>
          <p><strong>✅ المصداقية:</strong> ${article.credibility}% | <strong>📅 التاريخ:</strong> ${article.published}</p>
        </div>
        <div style="line-height: 1.8; font-size: 16px;"><h3>ملخص الخبر:</h3><p>${article.summary}</p></div>
        <div style="margin-top: 30px; font-size: 12px; color: #7f8c8d; text-align: center; border-top: 1px solid #ccc; padding-top: 10px;">
          <p>GlobalNewsHub - تم الحفظ بتاريخ: ${new Date().toLocaleString('ar-SA')}</p>
        </div>
      </div>`;
    const opt = { margin: 10, filename: `news-${article.source}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    html2pdf().set(opt).from(element).save();
  };

  const copyLink = (link) => navigator.clipboard.writeText(link).then(() => alert('تم نسخ الرابط بنجاح!'));
  const openNewspaper = (url) => { window.open(url, '_blank'); setActiveMenu(null); };

  // مكون عرض البطاقات لتجنب التكرار
  const renderArticleCard = (article) => (
    <div key={article.id} className={`article-card ${article.is_breaking ? 'breaking-card' : ''}`}>
      {article.is_breaking && <span className="breaking-badge">🚨 عاجل</span>}
      <h3>{article.title}</h3>
      <p className="article-summary">{article.summary}</p>
      <div className="article-meta">
        <span className="source">📰 {article.source} ({article.country})</span>
        <span className="date"> {article.published}</span>
        <span className={`credibility credibility-${article.credibility > 90 ? 'high' : article.credibility > 80 ? 'medium' : 'low'}`}>✅ مصداقية: {article.credibility}%</span>
      </div>
      <div className="article-actions">
        <button onClick={() => saveAsPDF(article)} className="action-btn pdf"> حفظ PDF</button>
        <button onClick={() => copyLink(article.link)} className="action-btn copy">📋 نسخ</button>
        <a href={article.link} target="_blank" rel="noopener noreferrer" className="action-btn read-more">📖 اقرأ الأصل</a>
      </div>
    </div>
  );

  return (
    <div className="App" dir="rtl">
      {/* زر الأخبار العاجلة */}
      <div className="breaking-news-container">
        <button className={`breaking-btn ${showBreakingOnly ? 'active' : ''}`} onClick={() => { setShowBreakingOnly(!showBreakingOnly); if (!showBreakingOnly) setQuery(''); }}>
          🚨 عرض الأخبار العاجلة فقط
        </button>
      </div>

      {/* التنبيه الخليجي */}
      {gulfAlert && (
        <div className="gulf-alert-banner">
          <span>🔔</span>
          <span>{gulfAlert.message}</span>
          <button onClick={() => setGulfAlert(null)} className="close-alert">×</button>
        </div>
      )}

      <header className="header">
        <h1>GlobalNewsHub <span className="earth-icon"></span></h1>
        <p>أخبار العالم في مكان واحد - موثوقة ومفلترة</p>
      </header>

      <div className="search-container">
        {showBreakingOnly && (
          <div className="breaking-mode-notice">
            <p>🚨 جاري عرض الأخبار العاجلة فقط</p>
            <button onClick={() => setShowBreakingOnly(false)}>عرض جميع الأخبار</button>
          </div>
        )}
        
        <input 
          type="text" 
          placeholder="ابحث عن خبر... (مثال: ايران, الكويت, أمريكا)" 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
          onKeyPress={(e) => e.key === 'Enter' && searchNews(false)} 
          disabled={showBreakingOnly} 
        />
        
        <div className="search-controls" ref={menuRef}>
          <button onClick={() => searchNews(false)} disabled={loading || showBreakingOnly}>
            {loading ? 'جاري...' : 'بحث'}
          </button>

          <button className="filter-select" onClick={() => setActiveMenu(activeMenu === 'sources' ? null : 'sources')}>
            🔍 المصادر {activeMenu === 'sources' ? '▲' : '▼'}
          </button>

          <button className="filter-select" onClick={() => setActiveMenu(activeMenu === 'arabic' ? null : 'arabic')}>
             الصحف العربية {activeMenu === 'arabic' ? '▲' : '▼'}
          </button>

          <button className="filter-select" onClick={() => setActiveMenu(activeMenu === 'gulf' ? null : 'gulf')}>
            🏛️ الصحف الخليجية {activeMenu === 'gulf' ? '▲' : '▼'}
          </button>

          {/* زر فتح النافذة المنبثقة للبحث الشامل */}
          <button className="filter-select global-search-btn" onClick={() => setShowGlobalSearchModal(true)}>
            🌐 بحث شامل (Google Style)
          </button>

          <select value={maxDays} onChange={(e) => setMaxDays(Number(e.target.value))} className="filter-select">
            <option value={1}>آخر 24 ساعة</option>
            <option value={3}>آخر 3 أيام</option>
            <option value={7}>آخر أسبوع</option>
          </select>
        </div>

        {/* القوائم المنسدلة */}
        {activeMenu === 'sources' && (
          <div className="dropdown-menu slide-up">
            <div className="dropdown-header">مصادر للبحث</div>
            <button className="dropdown-item" onClick={() => { setSourceFilter('الجزيرة'); setActiveMenu(null); }}>الجزيرة</button>
            <button className="dropdown-item" onClick={() => { setSourceFilter('العربية'); setActiveMenu(null); }}>العربية</button>
            <button className="dropdown-item" onClick={() => { setSourceFilter(''); setActiveMenu(null); }}>كل المصادر</button>
          </div>
        )}

        {activeMenu === 'arabic' && (
          <div className="dropdown-menu slide-up wide-menu">
            <div className="dropdown-header">الصحف العربية حسب الدولة</div>
            {Object.entries(ARABIC_NEWSPAPERS).map(([country, papers]) => (
              <div key={country} className="country-group">
                <div className="country-label">{country}</div>
                {Object.entries(papers).map(([name, url]) => (
                  <button key={name} className="dropdown-item" onClick={() => openNewspaper(url)}>{name}</button>
                ))}
              </div>
            ))}
          </div>
        )}

        {activeMenu === 'gulf' && (
          <div className="dropdown-menu slide-up wide-menu">
            <div className="dropdown-header">الصحف الخليجية حسب الدولة</div>
            {Object.entries(GULF_NEWSPAPERS).map(([country, papers]) => (
              <div key={country} className="country-group">
                <div className="country-label">{country}</div>
                {Object.entries(papers).map(([name, url]) => (
                  <button key={name} className="dropdown-item" onClick={() => openNewspaper(url)}>{name}</button>
                ))}
              </div>
            ))}
          </div>
        )}
        
        {sourceFilter && (
          <div className="active-filter-tag">
            البحث في: <strong>{sourceFilter}</strong>
            <button onClick={() => setSourceFilter('')}>×</button>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}
      {noResultsMessage && <div className="no-results-message">{noResultsMessage}</div>}
      
      {searchCount > 0 && (
        <div className="results-divider">
          <div className="divider-text">📰 تم العثور على {searchCount} خبر</div>
          <hr />
        </div>
      )}

      <div className="articles-grid">
        {articles.map(renderArticleCard)}
      </div>

      {/* ===== النافذة المنبثقة للبحث الشامل ===== */}
      {showGlobalSearchModal && (
        <div className="global-search-modal" onClick={(e) => e.target.className === 'global-search-modal' && setShowGlobalSearchModal(false)}>
          <div className="modal-content">
            <button className="close-modal" onClick={() => setShowGlobalSearchModal(false)}>×</button>
            
            <h2>🌍 البحث الشامل</h2>
            <p>ابحث في جميع المصادر، المدونات، والمقالات التحليلية...</p>
            
            <input 
              type="text" 
              placeholder="اكتب ما تبحث عنه هنا..." 
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchNews(true)} 
              autoFocus
            />
            
            <button className="modal-search-btn" onClick={() => searchNews(true)} disabled={loading}>
              {loading ? 'جاري البحث الشامل...' : 'ابدأ البحث الشامل'}
            </button>

            {/* عرض نتائج البحث الشامل داخل النافذة */}
            {articles.length > 0 && (
              <div className="modal-results-grid">
                {articles.map(renderArticleCard)}
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="legal-footer">
        <p>️ <strong>تنويه قانوني:</strong> يلتزم GlobalNewsHub بفلترة المحتوى المشبوه وغير الأخلاقي لضمان بيئة آمنة.</p>
        <p>© 2026 GlobalNewsHub - جميع الحقوق محفوظة</p>
      </footer>
    </div>
  );
}

export default App;