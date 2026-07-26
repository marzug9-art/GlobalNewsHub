import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

// ملاحظة: هذا الرابط يعمل على جهازك المحلي فقط. 
// لاحقاً سنغيره إلى رابط الخادم الخلفي (Backend) المنشور على الإنترنت.
const API_URL = 'http://127.0.0.1:8000/api/search';

function App() {
  const [query, setQuery] = useState('');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchCount, setSearchCount] = useState(0);

  const searchNews = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setArticles([]);
    try {
      const response = await axios.post(API_URL, {
        query: query,
        language: 'ar'
      });
      setArticles(response.data.articles || []);
      setSearchCount(response.data.count || 0);
      if (response.data.articles && response.data.articles.length === 0) {
        setError('لم يتم العثور على أخبار. جرب كلمات مثل: Iran, Kuwait, world, news');
      }
    } catch (err) {
      setError('حدث خطأ في جلب الأخبار. تأكد من تشغيل الخادم الخلفي.');
    }
    setLoading(false);
  };

  const printArticle = (article) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>${article.title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Tajawal', 'Arial', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 2; direction: rtl; text-align: right; background: white; }
            .header { text-align: center; border-bottom: 3px solid #667eea; padding-bottom: 20px; margin-bottom: 30px; }
            h1 { color: #2c3e50; font-size: 28px; margin-bottom: 20px; line-height: 1.5; }
            .meta { background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%); padding: 20px; border-radius: 12px; margin: 25px 0; border-right: 5px solid #667eea; }
            .meta p { margin: 10px 0; font-size: 15px; }
            .source { color: #3498db; font-weight: bold; }
            .credibility { color: #27ae60; font-weight: bold; }
            .country { color: #9b59b6; font-weight: bold; }
            .content { margin-top: 30px; font-size: 17px; text-align: justify; line-height: 2.2; }
            .content p { margin-bottom: 15px; }
            .link-box { background: #ecf0f1; padding: 15px; border-radius: 8px; margin-top: 30px; word-break: break-all; font-size: 13px; border-left: 4px solid #3498db; }
            .link-box a { color: #3498db; text-decoration: none; }
            .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #ecf0f1; text-align: center; color: #7f8c8d; font-size: 12px; }
            @media print { body { padding: 20px; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header"><h1>${article.title}</h1></div>
          <div class="meta">
            <p><span class="source">📰 المصدر:</span> ${article.source}</p>
            <p><span class="country">🌍 الدولة:</span> ${article.country}</p>
            <p><span class="credibility">✅ نسبة المصداقية:</span> ${article.credibility}%</p>
            <p><strong>📅 تاريخ النشر:</strong> ${article.published}</p>
          </div>
          <div class="content">
            <h3 style="margin-bottom: 15px; color: #2c3e50;">ملخص الخبر:</h3>
            <p>${article.summary}</p>
          </div>
          <div class="link-box">
            <strong>🔗 الرابط الأصلي:</strong><br>
            <a href="${article.link}" target="_blank">${article.link}</a>
          </div>
          <div class="footer">
            <p>GlobalNewsHub - نظام شامل للأخبار العالمية</p>
            <p>تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const saveAsText = (article) => {
    const content = `العنوان: ${article.title}\nالمصدر: ${article.source}\nالمصداقية: ${article.credibility}%\n\nالملخص:\n${article.summary}\n\nالرابط: ${article.link}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `article-${article.source}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const copyLink = (link) => {
    navigator.clipboard.writeText(link).then(() => alert('تم نسخ الرابط بنجاح!'));
  };

  return (
    <div className="App" dir="rtl">
      <header className="header">
        <h1>🌍 GlobalNewsHub</h1>
        <p>أخبار العالم في مكان واحد</p>
      </header>

      <div className="search-container">
        <input
          type="text"
          placeholder="ابحث عن خبر... مثال: Iran, Kuwait, world"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && searchNews()}
        />
        <button onClick={searchNews} disabled={loading}>
          {loading ? 'جاري البحث...' : 'بحث'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {searchCount > 0 && <div className="search-info">تم العثور على {searchCount} خبر</div>}

      <div className="articles-grid">
        {articles.map((article) => (
          <div key={article.id} className="article-card">
            <h3>{article.title}</h3>
            <p className="article-summary">{article.summary}</p>
            <div className="article-meta">
              <span className="source">{article.source}</span>
              <span className={`credibility credibility-${article.credibility > 90 ? 'high' : article.credibility > 80 ? 'medium' : 'low'}`}>
                مصداقية: {article.credibility}%
              </span>
            </div>
            
            <div className="article-actions">
              <button onClick={() => printArticle(article)} className="action-btn print">🖨️ طباعة</button>
              <button onClick={() => saveAsText(article)} className="action-btn save">💾 حفظ</button>
              <button onClick={() => copyLink(article.link)} className="action-btn copy">📋 نسخ</button>
            </div>
            <a href={article.link} target="_blank" rel="noopener noreferrer" className="read-more">
              اقرأ المقال الكامل ←
            </a>
          </div>
        ))}
      </div>
      
      {articles.length === 0 && !loading && !error && (
        <div className="empty-state">
          <p>ابدأ البحث لاكتشاف الأخبار العالمية</p>
        </div>
      )}
    </div>
  );
}

export default App;