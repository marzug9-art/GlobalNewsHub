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
  
  // النقطة 2: فلاتر جديدة
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

  // النقطة 3: دالة حفظ PDF
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
      <header className="header">
        <h1>🌍 GlobalNewsHub</h1>
        <p>أخبار العالم في مكان واحد - موثوقة ومفلترة</p>
      </header>

      {/* النقطة 4: زر الأخبار العاجلة */}
      <div className="breaking-news-container">
        <button 
          className={`breaking-btn ${showBreakingOnly ? 'active' : ''}`}
          onClick={() => {
            setShowBreakingOnly(!showBreakingOnly);
            setQuery('');
          }}
        >
           عرض الأخبار العاجلة فقط
        </button>
      </div>

      {!showBreakingOnly && (
        <div className="search-container">
          <input
            type="text"
            placeholder="ابحث عن خبر... (مثال: ايران, الكويت, أمريكا)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchNews()}
          />
          
          {/* النقطة 2: فلاتر متقدمة */}
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="filter-select">
            <option value="">كل المصادر</option>
            <option value="الجزيرة">الجزيرة</option>
            <option value="العربية">العربية</option>
            <option value="BBC">BBC</option>
            <option value="CNN">CNN</option>
            <option value="Reuters">Reuters</option>
            <option value="RT">RT عربي</option>
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
      )}

      {error && <div className="error-message">{error}</div>}
      {searchCount > 0 && <div className="search-info">تم العثور على {searchCount} خبر</div>}

      <div className="articles-grid">
        {articles.map((article) => (
          <div key={article.id} className={`article-card ${article.is_breaking ? 'breaking-card' : ''}`}>
            {article.is_breaking && <span className="breaking-badge"> عاجل</span>}
            <h3>{article.title}</h3>
            <p className="article-summary">{article.summary}</p>
            <div className="article-meta">
              <span className="source">{article.source} ({article.country})</span>
              <span className="date">{article.published}</span>
              <span className={`credibility credibility-${article.credibility > 90 ? 'high' : article.credibility > 80 ? 'medium' : 'low'}`}>
                مصداقية: {article.credibility}%
              </span>
            </div>
            
            <div className="article-actions">
              <button onClick={() => saveAsPDF(article)} className="action-btn pdf">📄 حفظ PDF</button>
              <button onClick={() => copyLink(article.link)} className="action-btn copy">📋 نسخ</button>
              <a href={article.link} target="_blank" rel="noopener noreferrer" className="action-btn read-more">
                اقرأ الأصل ←
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* النقطة 0: رسالة إخلاء المسؤولية القانونية */}
      <footer className="legal-footer">
        <p>⚠️ <strong>تنويه قانوني:</strong> يلتزم GlobalNewsHub بفلترة المحتوى المشبوه، الجنسي، وغير الأخلاقي تلقائياً لضمان بيئة آمنة ومتوافقة مع القوانين المحلية والدولية. نحن لا نتحمل مسؤولية محتوى المواقع الخارجية التي يتم الارتباط بها.</p>
        <p>© 2026 GlobalNewsHub - جميع الحقوق محفوظة</p>
      </footer>
    </div>
  );
}

export default App;