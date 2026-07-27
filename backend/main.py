from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import feedparser
import hashlib
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
import re

app = FastAPI(title="GlobalNewsHub")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🛡️ النقطة 0: كلمات محظورة
BLOCKED_KEYWORDS = [
    'sex', 'porn', 'xxx', 'nude', 'إباحي', 'جنس', 'عري', 'فاحش', 'مخدرات', 'drugs'
]

# 🔍 النقطة 1: قاموس المرادفات
SYNONYMS = {
    'ايران': ['ايران', 'إيران', 'أيران', 'iran', 'persia'],
    'الكويت': ['الكويت', 'kuwait'],
    'اسرائيل': ['اسرائيل', 'إسرائيل', 'israel', 'zionist'],
    'امريكا': ['امريكا', 'أمريكا', 'أميركا', 'america', 'united states', 'us', 'usa'],
    'بريطانيا': ['بريطانيا', 'انجلترا', 'britain', 'uk', 'england'],
    'روسيا': ['روسيا', 'russia', 'moscow'],
    'الصين': ['الصين', 'china', 'beijing'],
    'فلسطين': ['فلسطين', 'palestine', 'palestinian', 'غزة', 'gaza', 'القدس', 'jerusalem'],
    'سوريا': ['سوريا', 'syria', 'damascus'],
    'مصر': ['مصر', 'egypt', 'cairo'],
    'السعودية': ['السعودية', 'saudi', 'saudi arabia', 'riyadh'],
    'العراق': ['العراق', 'iraq', 'baghdad'],
}

# 🚨 النقطة 4: كلمات الأخبار العاجلة
BREAKING_KEYWORDS = ['عاجل', 'عاجلة', 'breaking', 'مباشر', 'live', 'حصري']

# 🌍 النقطة 5: مصادر عالمية
NEWS_SOURCES = {
    'aljazeera': {'name': 'الجزيرة', 'url': 'https://www.aljazeera.com/xml/rss/all.xml', 'credibility': 85, 'country': 'قطر'},
    'alarabiya': {'name': 'العربية', 'url': 'https://www.alarabiya.net/ar/rss', 'credibility': 82, 'country': 'السعودية'},
    'skynewsarabia': {'name': 'Sky News Arabia', 'url': 'https://www.skynewsarabia.com/rss', 'credibility': 84, 'country': 'UAE'},
    'bbc_arabic': {'name': 'BBC عربي', 'url': 'https://feeds.bbci.co.uk/arabic/rss.xml', 'credibility': 93, 'country': 'بريطانيا'},
    'france24_arabic': {'name': 'فرانس 24 عربي', 'url': 'http://www.france24.com/ar/rss.xml', 'credibility': 88, 'country': 'فرنسا'},
    'rt_arabic': {'name': 'RT عربي', 'url': 'https://arabic.rt.com/rss', 'credibility': 78, 'country': 'روسيا'},
    'bbc': {'name': 'BBC', 'url': 'http://feeds.bbci.co.uk/news/world/rss.xml', 'credibility': 95, 'country': 'بريطانيا'},
    'theguardian': {'name': 'The Guardian', 'url': 'https://www.theguardian.com/world/rss', 'credibility': 92, 'country': 'بريطانيا'},
    'cnn': {'name': 'CNN', 'url': 'http://rss.cnn.com/rss/edition_world.rss', 'credibility': 90, 'country': 'أمريكا'},
    'nytimes': {'name': 'New York Times', 'url': 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'credibility': 93, 'country': 'أمريكا'},
    'lemonde': {'name': 'Le Monde', 'url': 'https://www.lemonde.fr/rss/une.xml', 'credibility': 91, 'country': 'فرنسا'},
    'presstv': {'name': 'Press TV', 'url': 'https://www.presstv.com/RSSFeed/rss', 'credibility': 75, 'country': 'إيران'},
    'haaretz': {'name': 'Haaretz', 'url': 'https://www.haaretz.com/csp/feeds/1.593', 'credibility': 85, 'country': 'إسرائيل'},
    'timesofisrael': {'name': 'Times of Israel', 'url': 'https://www.timesofisrael.com/feed/', 'credibility': 83, 'country': 'إسرائيل'},
    'reuters': {'name': 'Reuters', 'url': 'https://www.reutersagency.com/feed/', 'credibility': 96, 'country': 'عالمي'},
}

class SearchRequest(BaseModel):
    query: str
    language: Optional[str] = "ar"
    source_filter: Optional[str] = None
    max_days: Optional[int] = 3

@app.get("/")
def root():
    return {
        "message": "GlobalNewsHub API",
        "warning": "هذا الموقع يلتزم بفلترة المحتوى المشبوه وغير الأخلاقي وفقاً للسياسات القانونية."
    }

def is_content_safe(text: str) -> bool:
    text_lower = text.lower()
    for word in BLOCKED_KEYWORDS:
        if word in text_lower:
            return False
    return True

def is_breaking_news(text: str) -> bool:
    text_lower = text.lower()
    return any(keyword in text_lower for keyword in BREAKING_KEYWORDS)

@app.post("/api/search")
def search_news(request: SearchRequest):
    articles = []
    query_lower = request.query.lower().strip()
    
    search_terms = [query_lower]
    for ar_word, synonyms in SYNONYMS.items():
        if ar_word in query_lower or any(syn in query_lower for syn in synonyms):
            search_terms.extend(synonyms)
            break
    
    search_terms = list(set(search_terms))
    cutoff_date = datetime.now() - timedelta(days=request.max_days)

    for source_key, source_info in NEWS_SOURCES.items():
        if request.source_filter and request.source_filter.lower() not in source_info['name'].lower():
            continue
            
        try:
            feed = feedparser.parse(source_info['url'])
            for entry in feed.entries[:15]:
                title = entry.title
                summary = entry.get('summary', entry.get('description', ''))
                
                if not is_content_safe(f"{title} {summary}"):
                    continue
                
                try:
                    published_dt = parsedate_to_datetime(entry.get('published'))
                    if published_dt < cutoff_date:
                        continue
                    published_str = published_dt.strftime('%Y-%m-%d %H:%M')
                except:
                    published_str = entry.get('published', 'تاريخ غير محدد')
                
                searchable_text = f"{title} {summary}".lower()
                
                if any(term in searchable_text for term in search_terms):
                    articles.append({
                        'id': hashlib.md5(f"{source_key}{entry.link}".encode()).hexdigest(),
                        'title': title,
                        'link': entry.link,
                        'source': source_info['name'],
                        'country': source_info['country'],
                        'credibility': source_info['credibility'],
                        'published': published_str,
                        'summary': summary[:400] + '...' if len(summary) > 400 else summary,
                        'is_breaking': is_breaking_news(title),
                        'full_content': f"{title}\n\nالمصدر: {source_info['name']}\n{summary}\n\nالرابط: {entry.link}"
                    })
        except Exception as e:
            print(f"Error from {source_key}: {e}")
    
    articles.sort(key=lambda x: (not x['is_breaking'], x['published']), reverse=True)
    
    return {
        "status": "success", 
        "articles": articles, 
        "count": len(articles),
        "query": request.query,
        "legal_notice": "يتم فلترة المحتوى المشبوه وغير الأخلاقي تلقائياً لضمان بيئة آمنة ومتوافقة مع القوانين."
    }