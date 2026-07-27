import React, { useState } from 'react';
import axios from 'axios';
import html2pdf from 'html2pdf.js';
import './App.css';

const API_URL = 'https://globalnewshub-backend.onrender.com/api/search';

const ARABIC_NEWSPAPERS = {
  '🇶🇦 قطر': {
    'الجزيرة': 'https://www.aljazeera.com',
    'عربي21': 'https://arabi21.com',
    'العرب': 'https://alarab.co.uk',
    'الراية': 'https://raya.com'
  },
  '🇸🇦 السعودية': {
    'العربية': 'https://www.alarabiya.net',
    'عكاظ': 'https://www.okaz.com.sa',
    'سبق': 'https://sabq.org',
    'الاقتصادية': 'https://www.aleqt.com',
    'المدينة': 'https://www.al-madina.com',
    'الرياض': 'https://www.alriyadh.com',
    'الجزيرة': 'https://www.al-jazirah.com',
    'الوطن': 'https://www.alwatan.com.sa',
    'اليوم': 'https://www.alyaum.com',
    'مكة': 'https://makkahnewspaper.com'
  },
  '🇦🇪 الإمارات': {
    'Sky News Arabia': 'https://www.skynewsarabia.com',
    'الخليج': 'https://www.alkhaleej.ae',
    'البيان': 'https://www.albayan.ae',
    'الاتحاد': 'https://www.alittihad.ae',
    'الإمارات اليوم': 'https://www.emaratalyoum.com',
    'أخبار الخليج': 'https://www.akhbar-alkhaleej.com',
    'الوطن': 'https://www.alwatan.ae'
  },
  '🇬🇧 بريطانيا': {
    'BBC عربي': 'https://www.bbc.com/arabic',
    'القدس العربي': 'https://www.alquds.co.uk',
    'الحياة': 'https://www.alhayat.com'
  },
  '🇫🇷 فرنسا': {
    'مونت كارلو': 'https://www.mc-doualiya.com',
    'فرانس 24 عربي': 'https://www.france24.com/ar'
  },
  '🇩🇪 ألمانيا': {
    'DW عربي': 'https://www.dw.com/ar'
  },
  '🇷🇺 روسيا': {
    'RT عربي': 'https://arabic.rt.com',
    'سبوتنيك': 'https://arabic.sputniknews.com'
  },
  '🇹🇷 تركيا': {
    'الأناضول عربي': 'https://www.aa.com.tr/ar',
    'يومي صباح': 'https://www.yenisafak.com/arabic'
  }
};

const GULF_NEWSPAPERS = {
  '🇸🇦 السعودية': {
    'العربية': 'https://www.alarabiya.net',
    'عكاظ': 'https://www.okaz.com.sa',
    'سبق': 'https://sabq.org',
    'الاقتصادية': 'https://www.aleqt.com',
    'المدينة': 'https://www.al-madina.com',
    'الرياض': 'https://www.alriyadh.com',
    'الجزيرة': 'https://www.al-jazirah.com',
    'الوطن': 'https://www.alwatan.com.sa',
    'اليوم': 'https://www.alyaum.com',
    'مكة': 'https://makkahnewspaper.com'
  },
  '🇦🇪 الإمارات': {
    'Sky News Arabia': 'https://www.skynewsarabia.com',
    'الخليج': 'https://www.alkhaleej.ae',
    'البيان': 'https://www.albayan.ae',
    'الاتحاد': 'https://www.alittihad.ae',
    'الإمارات اليوم': 'https://www.emaratalyoum.com',
    'أخبار الخليج': 'https://www.akhbar-alkhaleej.com',
    'الوطن': 'https://www.alwatan.ae'
  },
  '🇶🇦 قطر': {
    'الجزيرة': 'https://www.aljazeera.com',
    'عربي21': 'https://arabi21.com',
    'العرب': 'https://alarab.co.uk',
    'الراية': 'https://raya.com',
    'الشرق': 'https://www.al-sharq.com'
  },
  '🇰🇼 الكويت': {
    'القبس': 'https://alqabas.com',
    'الرأي': 'https://www.alraimedia.com',
    'الأنباء': 'https://www.alanba.com.kw',
    'الجريدة': 'https://www.aljarida.com',
    'الوطن': 'https://www.alwatan.com.kw',
    'السياسة': 'https://www.al-seyassah.com',
    'كويت تايمز': 'https://www.kuwaittimes.com'
  },
  '🇧🇭 البحرين': {
    'أخبار الخليج': 'https://www.akhbar-alkhaleej.com',
    'الوسط': 'https://www.alwasatnews.com',
    'الأيام': 'https://www.alayam.com'
  },
  '🇴🇲 عمان': {
    'عمان': 'https://www.omandaily.om',
    'الرؤية': 'https://www.alroya.om',
    'الشبيبة': 'https://www.alshabiba.com',
    'الوطن': 'https://www.alwatan.com'
  }
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
          <p><strong>📰 المصدر:</strong> ${article.source} | <strong>🌍 الدولة:</strong> ${article.country}</p>
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

  const selectSource = (sourceName) => {
    setSourceFilter(sourceName);
    setShowSources(false);
  };

  const openNewspaper = (url) => {
    window.open(url, '_blank');
  };

  return (
    <div className="App" dir="rtl">
      <div className="breaking-news-container">
        <button className={`breaking-btn ${showBreakingOnly ? 'active' : ''}`} onClick={() => { 
          setShowBreakingOnly(!showBreakingOnly); 
          if (!showBreakingOnly) setQuery(''); 
        }}>
          🚨 عرض الأخبار العاجلة فقط
        </button>
      </div>

      <header className="header">
        <h1>GlobalNewsHub <span className="earth-icon"></span></h1>
        <p>أخبار العالم في مكان واحد - موثوقة ومفلترة</p>
      </header>

      <div className="search-container">
        {showBreakingOnly && (
          <div style={{ 
            padding: '15px', 
            background: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)', 
            borderRadius: '10px', 
            textAlign: 'center',
            marginBottom: '20px',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '15px'
          }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: '0', fontSize: '18px', fontWeight: 'bold' }}>🚨 جاري عرض الأخبار العاجلة فقط</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '14px', opacity: 0.9 }}>اضغط الزر أدناه للعودة للبحث العادي</p>
            </div>
            <button 
              onClick={() => setShowBreakingOnly(false)}
              style={{
                background: 'white',
                color: '#ff416c',
                border: 'none',
                padding: '12px 30px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '16px',
                whiteSpace: 'nowrap'
              }}
            >
              عرض جميع الأخبار
            </button>
          </div>
        )}
        
        <input 
          type="text" 
          placeholder="ابحث عن خبر... (مثال: ايران, الكويت, أمريكا)" 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
          onKeyPress={(e) => e.key === 'Enter' && searchNews()} 
          disabled={showBreakingOnly} 
          style={{ opacity: showBreakingOnly ? 0.5 : 1 }}
        />
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          
          <button onClick={searchNews} disabled={loading || showBreakingOnly} style={{ minWidth: '100px', opacity: showBreakingOnly ? 0.5 : 1 }}>
            {loading ? 'جاري...' : 'بحث'}
          </button>

          <div style={{ position: 'relative' }}>
            <button className="filter-select" onClick={() => { setShowSources(!showSources); setShowArabicNewspapers(false); setShowGulfNewspapers(false); }} disabled={showBreakingOnly} style={{ opacity: showBreakingOnly ? 0.5 : 1 }}>
              🔍 المصادر {showSources ? '▲' : '▼'}
            </button>
            {showSources && (
              <div className="dropdown-menu">
                <div style={{ padding: '10px', borderBottom: '2px solid #f0f0f0' }}><strong style={{ color: '#667eea' }}>مصادر للبحث</strong></div>
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

          <div style={{ position: 'relative' }}>
            <button className="filter-select" onClick={() => { setShowArabicNewspapers(!showArabicNewspapers); setShowSources(false); setShowGulfNewspapers(false); }} disabled={showBreakingOnly} style={{ opacity: showBreakingOnly ? 0.5 : 1 }}>
              📰 الصحف العربية {showArabicNewspapers ? '▲' : '▼'}
            </button>
            {showArabicNewspapers && (
              <div className="dropdown-menu" style={{ minWidth: '300px', maxHeight: '500px', overflowY: 'auto' }}>
                <div style={{ padding: '10px', borderBottom: '2px solid #f0f0f0' }}><strong style={{ color: '#667eea' }}>الصحف العربية حسب الدولة</strong></div>
                {Object.entries(ARABIC_NEWSPAPERS).map(([country, newspapers]) => (
                  <div key={country}>
                    <div style={{ padding: '8px 15px', backgroundColor: '#f8f9fa', fontWeight: 'bold', color: '#667eea', borderBottom: '1px solid #e0e0e0' }}>
                      {country}
                    </div>
                    {Object.entries(newspapers).map(([name, url]) => (
                      <button key={name} className="dropdown-item" onClick={() => openNewspaper(url)} style={{ fontSize: '14px', padding: '10px 20px' }}>
                        {name}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button className="filter-select" onClick={() => { setShowGulfNewspapers(!showGulfNewspapers); setShowSources(false); setShowArabicNewspapers(false); }} disabled={showBreakingOnly} style={{ opacity: showBreakingOnly ? 0.5 : 1 }}>
              🏛️ الصحف الخليجية {showGulfNewspapers ? '▲' : '▼'}
            </button>
            {showGulfNewspapers && (
              <div className="dropdown-menu" style={{ minWidth: '300px', maxHeight: '500px', overflowY: 'auto' }}>
                <div style={{ padding: '10px', borderBottom: '2px solid #f0f0f0' }}><strong style={{ color: '#667eea' }}>الصحف الخليجية حسب الدولة</strong></div>
                {Object.entries(GULF_NEWSPAPERS).map(([country, newspapers]) => (
                  <div key={country}>
                    <div style={{ padding: '8px 15px', backgroundColor: '#f8f9fa', fontWeight: 'bold', color: '#667eea', borderBottom: '1px solid #e0e0e0' }}>
                      {country}
                    </div>
                    {Object.entries(newspapers).map(([name, url]) => (
                      <button key={name} className="dropdown-item" onClick={() => openNewspaper(url)} style={{ fontSize: '14px', padding: '10px 20px' }}>
                        {name}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <select value={maxDays} onChange={(e) => setMaxDays(Number(e.target.value))} className="filter-select" disabled={showBreakingOnly} style={{ opacity: showBreakingOnly ? 0.5 : 1 }}>
            <option value={1}>آخر 24 ساعة</option>
            <option value={3}>آخر 3 أيام</option>
            <option value={7}>آخر أسبوع</option>
            <option value={30}>آخر شهر</option>
          </select>

        </div>
        
        {sourceFilter && (
          <div style={{ marginTop: '15px', padding: '10px 15px', backgroundColor: '#667eea', color: 'white', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <span>البحث في:</span>
            <strong>{sourceFilter}</strong>
            <button onClick={() => setSourceFilter('')} style={{ background: 'rgba(255,255,255,0.3)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', color: 'white', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        )}
      </div>

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
            {article.is_breaking && <span className="breaking-badge">🚨 عاجل</span>}
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