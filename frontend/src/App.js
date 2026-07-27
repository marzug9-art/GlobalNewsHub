import React, { useState } from 'react';
import axios from 'axios';
import html2pdf from 'html2pdf.js';
import './App.css';

const API_URL = 'https://globalnewshub-backend.onrender.com/api/search';

function App() {
  const [query, setQuery] = useState('');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchCount, setSearchCount] = useState(0);
  
  const [sourceFilter, setSourceFilter] = useState('');
  const [maxDays, setMaxDays] = useState(3);
  const [showBreakingOnly, setShowBreakingOnly] = useState(false);

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
    
    const opt = {
      margin: 10,
      filename: `news-${article.source}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
  };

  const copyLink = (link) => {
    navigator.clipboard.writeText(link).then(() => alert('تم نسخ الرابط بنجاح!'));
  };

  return (
    <div className="App" dir="rtl">
      <div className="breaking-news-container">
        <button 
          className={`breaking-btn ${showBreakingOnly ? 'active' : ''}`}
          onClick={() => {
            setShowBreakingOnly(!showBreakingOnly);
            setQuery('');
          }}
        >
          🚨 عرض الأخبار العاجلة فقط
        </button>
      </div>

      <header className="header">
        <h1>
          GlobalNewsHub 
          <span className="earth-icon"></span>
        </h1>
        <p>أخبار العالم في مكان واحد - موثوقة ومفلترة</p>
      </header>

      {!showBreakingOnly && (
        <div className="search-container">
          <input
            type="text"
            placeholder="ابحث عن خبر... (مثال: ايران, الكويت, أمريكا)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchNews()}
          />
          
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="filter-select">
              <option value="">🌍 كل المصادر</option>
              
              <optgroup label="🇦🇸🇦🇪 عربية وخليجية">
                <option value="الجزيرة">الجزيرة (قطر)</option>
                <option value="العربية">العربية (السعودية)</option>
                <option value="Sky News Arabia">Sky News Arabia (الإمارات)</option>
                <option value="BBC عربي">BBC عربي</option>
                <option value="فرانس 24 عربي">فرانس 24 عربي</option>
                <option value="RT عربي">RT عربي</option>
                <option value="DW عربي">DW عربي</option>
                <option value="مونت كارلو">مونت كارلو</option>
                <option value="الأناضول">الأناضول (تركيا)</option>
                <option value="عكاظ">عكاظ (السعودية)</option>
                <option value="القدس العربي">القدس العربي</option>
                <option value="عربي21">عربي21 (قطر)</option>
                <option value="الخليج">الخليج (الإمارات)</option>
                <option value="البيان">البيان (الإمارات)</option>
              </optgroup>
              
              <optgroup label="🇬🇧 بريطانية">
                <option value="BBC">BBC</option>
                <option value="The Guardian">The Guardian</option>
              </optgroup>
              
              <optgroup label="🇺🇸 أمريكية">
                <option value="CNN">CNN</option>
                <option value="New York Times">New York Times</option>
                <option value="AP News">AP News</option>
                <option value="Washington Post">Washington Post</option>
                <option value="Bloomberg">Bloomberg</option>
              </optgroup>
              
              <optgroup label="🇪 أوروبية">
                <option value="Le Monde">Le Monde (فرنسا)</option>
                <option value="Euronews">Euronews</option>
                <option value="Deutsche Welle">Deutsche Welle (ألمانيا)</option>
              </optgroup>
              
              <optgroup label=" آسيوية">
                <option value="NHK World">NHK World (اليابان)</option>
                <option value="China Daily">China Daily (الصين)</option>
                <option value="Press TV">Press TV (إيران)</option>
              </optgroup>
              
              <optgroup label="🌍 عالمية">
                <option value="Haaretz">Haaretz (إسرائيل)</option>
                <option value="Times of Israel">Times of Israel</option>
                <option value="Reuters">Reuters (عالمي)</option>
                <option value="Al Jazeera English">Al Jazeera English</option>
              </optgroup>
            </select>

            <select value={maxDays} onChange={(e) => setMaxDays(Number(e.target.value))} className="filter-select">
              <option value={1}>آخر 24 ساعة</option>
              <option value={3}>آخر 3 أيام</option>
              <option value={7}>آخر أسبوع</option>
              <option value={30}>آخر شهر</option>
            </select>

            <button onClick={searchNews} disabled={loading}>
              {loading ? 'جاري البحث...' : 'بحث'}
            </button>
          </div>
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
            {article.is_breaking && <span className="breaking-badge">🚨 عاجل</span>}
            <h3>{article.title}</h3>
            <p className="article-summary">{article.summary}</p>
            <div className="article-meta">
              <span className="source">📰 {article.source} ({article.country})</span>
              <span className="date">📅 {article.published}</span>
              <span className={`credibility credibility-${article.credibility > 90 ? 'high' : article.credibility > 80 ? 'medium' : 'low'}`}>
                ✅ مصداقية: {article.credibility}%
              </span>
            </div>
            
            <div className="article-actions">
              <button onClick={() => saveAsPDF(article)} className="action-btn pdf">📄 حفظ PDF</button>
              <button onClick={() => copyLink(article.link)} className="action-btn copy">📋 نسخ</button>
              <a href={article.link} target="_blank" rel="noopener noreferrer" className="action-btn read-more">
                📖 اقرأ الأصل
              </a>
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