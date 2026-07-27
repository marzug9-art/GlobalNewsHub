import React, { useState } from 'react';
import axios from 'axios';
import html2pdf from 'html2pdf.js';
import './App.css';

const API_URL = 'https://globalnewshub-backend.onrender.com/api/search';

// روابط مباشرة للصحف العربية والخليجية
const ARABIC_NEWSPAPERS = {
  'الجزيرة': 'https://www.aljazeera.com',
  'العربية': 'https://www.alarabiya.net',
  'Sky News Arabia': 'https://www.skynewsarabia.com',
  'BBC عربي': 'https://www.bbc.com/arabic',
  'فرانس 24 عربي': 'https://www.france24.com/ar',
  'RT عربي': 'https://arabic.rt.com',
  'DW عربي': 'https://www.dw.com/ar',
  'مونت كارلو': 'https://www.mc-doualiya.com',
  'عكاظ': 'https://www.okaz.com.sa',
  'عربي21': 'https://arabi21.com',
  'القدس العربي': 'https://www.alquds.co.uk'
};

const GULF_NEWSPAPERS = {
  'العربية': 'https://www.alarabiya.net',
  'عكاظ': 'https://www.okaz.com.sa',
  'Sky News Arabia': 'https://www.skynewsarabia.com',
  'الخليج': 'https://www.alkhaleej.ae',
  'البيان': 'https://www.albayan.ae',
  'الاتحاد': 'https://www.alittihad.ae',
  'الجزيرة': 'https://www.aljazeera.com'
};

function App() {
  const [query, setQuery] = useState('');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchCount, setSearchCount] = useState(0);
  
  const [sourceFilter, setSourceFilter] = useState('');
  const [maxDays, setMaxDays] = useState(3);
  const [showBreakingOnly, setShowBreakingOnly] = useState(false);
  
  // حالات القوائم المنسدلة
  const [showSources, setShowSources] = useState(false);
  const [showArabicNewspapers, setShowArabicNewspapers] = useState(false);
  const [showGulfNewspapers, setShowGulfNewspapers] = useState(false);

  const searchNews = async () => {
    if (!query.trim() && !showBreakingOnly) return;
    setLoading(true);
    setError('');
    setArticles([]);
    try {
      const response = await axios.post(API_URL, {
        query: showBreakingOnly ? 'عاجل breaking' : query,
        language: 'ar',
        source_filter: sourceFilter,
        max_days: maxDays
      });
      
      let results = response.data.articles || [];
      if (showBreakingOnly) {
        results = results.filter(art => art.is_breaking);
      }
      
      setArticles(results);
      setSearchCount(results.length);
      if (results.length === 0) {
        setError('لم يتم العثور على أخبار. جرب كلمات أخرى أو وسع نطاق التاريخ.');
      }
    } catch (err) {
      setError('حدث خطأ في جلب الأخبار. قد يكون الخادم الخلفي في وضع السكون، يرجى المحاولة بعد دقيقة.');
    }
    setLoading(false);
  };

  const saveAsPDF = (article) => {
    const element = document.createElement('div');
    element.innerHTML = `
      <div style="font-family: 'Tajawal', sans-serif; direction: rtl; padding: 20px;">
        <h1 style="color: #2c3e50; text-align: center;">${article.title}</h1>
        <div style="background: #f5f7fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>📰 المصدر:</strong> ${article.source} | <strong> الدولة:</strong> ${article.country}</p>
          <p><strong>✅ المصداقية:</strong> ${article.credibility}% | <strong>📅 التاريخ:</strong> ${article.published}</p>
        </div>
        <div style="line-height: 1.8; font-size: 16px;">
          <h3>ملخص الخبر:</h3>
          <p>${article.summary}</p>
        </div>
        <div style="margin-top: 30px; font-size: 12px; color: #7f8c8d; text-align: center; border-top: 1px solid #ccc; padding-top: 10px;">
          <p>GlobalNewsHub - تم الحفظ بتاريخ: ${new Date().toLocaleString('ar-SA')}</p>
          <p>تنويه: هذا الموقع يلتزم بفلترة المحتوى المشبوه وغير الأخلاقي وفقاً للسياسات القانونية.</p>
        </div>
      </div>
    `;
    const opt = { margin: 10, filename: `news-${article.source}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    html2pdf().set(opt).from(element).save();
  };

  const copyLink = (link) => {
    navigator.clipboard.writeText(link).then(() => alert('تم نسخ الرابط بنجاح!'));
  };

  // دالة لاختيار مصدر للبحث
  const selectSource = (sourceName) => {
    setSourceFilter(sourceName);
    setShowSources(false);
  };

  // دالة لفتح موقع الصحيفة في تبويب جديد
  const openNewspaper = (url) => {
    window.open(url, '_blank');
  };

  return (
    <div className="App" dir="rtl">
      <div className="breaking-news-container">
        <button className={`breaking-btn ${showBreakingOnly ? 'active' : ''}`} onClick={() => { setShowBreakingOnly(!showBreakingOnly); setQuery(''); }}>
           عرض الأخبار العاجلة فقط
        </button>
      </div>

      <header className="header">
        <h1>GlobalNewsHub <span className="earth-icon"></span></h1>
        <p>أخبار العالم في مكان واحد - موثوقة ومفلترة</p>
      </header>

      {!showBreakingOnly && (
        <div className="search-container">
          <input type="text" placeholder="ابحث عن خبر... (مثال: ايران, الكويت, أمريكا)" value={query} onChange={(e) => setQuery(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && searchNews()} />
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            
            {/* زر البحث */}
            <button onClick={searchNews} disabled={loading} style={{ minWidth: '100px' }}>
              {loading ? 'جاري...' : 'بحث'}
            </button>

            {/* زر المصادر (للبحث في الموقع) */}
            <div style={{ position: 'relative' }}>
              <button className="filter-select" onClick={() => { setShowSources(!showSources); setShowArabicNewspapers(false); setShowGulfNewspapers(false); }}>
                 المصادر {showSources ? '▲' : '▼'}
              </button>
              {showSources && (
                <div className="dropdown-menu">
                  <div style={{ padding: '10px', borderBottom: '2px solid #f0f0f0' }}><strong style={{ color: '#667eea' }}>🔍 مصادر للبحث</strong></div>
                  <button className="dropdown-item" onClick={() => selectSource('الجزيرة')}>الجزيرة</button>
                  <button className="dropdown-item" onClick={() => selectSource('العربية')}>العربية</button>
                  <button className="dropdown-item" onClick={() => selectSource('Sky News Arabia')}>Sky News Arabia</button>
                  <button className="dropdown-item" onClick={() => selectSource('BBC عربي')}>BBC عربي</button>
                  <button className="dropdown-item" onClick={() => selectSource('CNN')}>CNN</button>
                  <button className="dropdown-item" onClick={() => selectSource('Reuters')}>Reuters</button>
                  <button className="dropdown-item" onClick={() => selectSource('')}>كل المصادر</button>
                </div>
              )}
            </div>

            {/* زر الصحف العربية (روابط مباشرة) */}
            <div style={{ position: 'relative' }}>
              <button className="filter-select" onClick={() => { setShowArabicNewspapers(!showArabicNewspapers); setShowSources(false); setShowGulfNewspapers(false); }}>
                 الصحف العربية {showArabicNewspapers ? '▲' : '▼'}
              </button>
              {showArabicNewspapers && (
                <div className="dropdown-menu">
                  <div style={{ padding: '10px', borderBottom: '2px solid #f0f0f0' }}><strong style={{ color: '#667eea' }}>📰 الصحف العربية (روابط مباشرة)</strong></div>
                  {Object.entries(ARABIC_NEWSPAPERS).map(([name, url]) => (
                    <button key={name} className="dropdown-item" onClick={() => openNewspaper(url)}>
                       {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* زر الصحف الخليجية (روابط مباشرة) */}
            <div style={{ position: 'relative' }}>
              <button className="filter-select" onClick={() => { setShowGulfNewspapers(!showGulfNewspapers); setShowSources(false); setShowArabicNewspapers(false); }}>
                 الصحف الخليجية {showGulfNewspapers ? '▲' : '▼'}
              </button>
              {showGulfNewspapers && (
                <div className="dropdown-menu">
                  <div style={{ padding: '10px', borderBottom: '2px solid #f0f0f0' }}><strong style={{ color: '#667eea' }}>🏛️ الصحف الخليجية (روابط مباشرة)</strong></div>
                  {Object.entries(GULF_NEWSPAPERS).map(([name, url]) => (
                    <button key={name} className="dropdown-item" onClick={() => openNewspaper(url)}>
                       {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* فلتر التاريخ */}
            <select value={maxDays} onChange={(e) => setMaxDays(Number(e.target.value))} className="filter-select">
              <option value={1}>آخر 24 ساعة</option>
              <option value={3}>آخر 3 أيام</option>
              <option value={7}>آخر أسبوع</option>
              <option value={30}>آخر شهر</option>
            </select>

          </div>
          
          {/* عرض المصدر المحدد للبحث */}
          {sourceFilter && (
            <div style={{ marginTop: '15px', padding: '10px 15px', backgroundColor: '#667eea', color: 'white', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
              <span> البحث في:</span>
              <strong>{sourceFilter}</strong>
              <button onClick={() => setSourceFilter('')} style={{ background: 'rgba(255,255,255,0.3)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', color: 'white', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
          )}
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
      
      {searchCount > 0 && (
        <div className="results-divider">
          <div className="divider-text">📰 تم العثور على {searchCount} خبر</div>
          <hr />
        </div>
      )}

      <div className="articles-grid">
        {articles.map((article) => (
          <div key={article.id} className={`article-card ${article.is_breaking ? 'breaking-card' : ''}`}>
            {article.is_breaking && <span className="breaking-badge"> عاجل</span>}
            <h3>{article.title}</h3>
            <p className="article-summary">{article.summary}</p>
            <div className="article-meta">
              <span className="source">📰 {article.source} ({article.country})</span>
              <span className="date">📅 {article.published}</span>
              <span className={`credibility credibility-${article.credibility > 90 ? 'high' : article.credibility > 80 ? 'medium' : 'low'}`}>✅ مصداقية: {article.credibility}%</span>
            </div>
            <div className="article-actions">
              <button onClick={() => saveAsPDF(article)} className="action-btn pdf">📄 حفظ PDF</button>
              <button onClick={() => copyLink(article.link)} className="action-btn copy">📋 نسخ</button>
              <a href={article.link} target="_blank" rel="noopener noreferrer" className="action-btn read-more">📖 اقرأ الأصل</a>
            </div>
          </div>
        ))}
      </div>

      <footer className="legal-footer">
        <p>⚠️ <strong>تنويه قانوني:</strong> يلتزم GlobalNewsHub بفلترة المحتوى المشبوه، الجنسي، وغير الأخلاقي تلقائياً لضمان بيئة آمنة ومتوافقة مع القوانين المحلية والدولية. نحن لا نتحمل مسؤولية محتوى المواقع الخارجية التي يتم الارتباط بها.</p>
        <p>© 2026 GlobalNewsHub - جميع الحقوق محفوظة</p>
      </footer>
    </div>
  );
}

export default App;