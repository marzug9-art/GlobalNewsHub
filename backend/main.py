from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import feedparser
import hashlib
from datetime import datetime

app = FastAPI(title="GlobalNewsHub")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NEWS_SOURCES = {
    # 🇦 عربية
    'aljazeera': {'name': 'الجزيرة', 'url': 'https://www.aljazeera.com/xml/rss/all.xml', 'credibility': 85, 'country': 'قطر'},
    'alarabiya': {'name': 'العربية', 'url': 'https://www.alarabiya.net/ar/rss', 'credibility': 82, 'country': 'السعودية'},
    'skynewsarabia': {'name': 'سكاي نيوز عربية', 'url': 'https://www.skynewsarabia.com/rss', 'credibility': 84, 'country': 'الإمارات'},
    'bbc_arabic': {'name': 'BBC عربي', 'url': 'https://feeds.bbci.co.uk/arabic/rss.xml', 'credibility': 93, 'country': 'بريطانيا'},
    'france24_arabic': {'name': 'فرانس 24 عربي', 'url': 'http://www.france24.com/ar/rss.xml', 'credibility': 88, 'country': 'فرنسا'},
    
    # 🇬🇧 بريطانية
    'bbc': {'name': 'BBC', 'url': 'http://feeds.bbci.co.uk/news/world/rss.xml', 'credibility': 95, 'country': 'بريطانيا'},
    'theguardian': {'name': 'The Guardian', 'url': 'https://www.theguardian.com/world/rss', 'credibility': 92, 'country': 'بريطانيا'},
    
    # 🇺🇸 أمريكية
    'cnn': {'name': 'CNN', 'url': 'http://rss.cnn.com/rss/edition_world.rss', 'credibility': 90, 'country': 'أمريكا'},
    'nytimes': {'name': 'New York Times', 'url': 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'credibility': 93, 'country': 'أمريكا'},
    
    # 🇫🇷 فرنسية
    'lemonde': {'name': 'Le Monde', 'url': 'https://www.lemonde.fr/rss/une.xml', 'credibility': 91, 'country': 'فرنسا'},
    
    # 🇮 إيرانية
    'presstv': {'name': 'Press TV', 'url': 'https://www.presstv.com/RSSFeed/rss', 'credibility': 75, 'country': 'إيران'},
    
    # 🇮🇱 إسرائيلية
    'haaretz': {'name': 'Haaretz', 'url': 'https://www.haaretz.com/csp/feeds/1.593', 'credibility': 85, 'country': 'إسرائيل'},
    
    # 🌍 عالمية
    'reuters': {'name': 'Reuters', 'url': 'https://www.reutersagency.com/feed/', 'credibility': 96, 'country': 'عالمي'},
}

class SearchRequest(BaseModel):
    query: str
    language: Optional[str] = "ar"

@app.get("/")
def root():
    return {"message": "GlobalNewsHub API - أخبار العالم من جميع المصادر الموثوقة"}

@app.post("/api/search")
def search_news(request: SearchRequest):
    articles = []
    query_lower = request.query.lower()
    
    arabic_to_english = {
        'الكويت': 'kuwait', 'إيران': 'iran', 'إسرائيل': 'israel',
        'أمريكا': 'america united states', 'بريطانيا': 'britain uk',
        'فرنسا': 'france', 'السعودية': 'saudi arabia', 'مصر': 'egypt',
        'فلسطين': 'palestine', 'سوريا': 'syria', 'العراق': 'iraq',
        'روسيا': 'russia', 'ألمانيا': 'germany', 'الصين': 'china'
    }
    
    search_terms = query_lower
    for ar_word, en_words in arabic_to_english.items():
        if ar_word in query_lower:
            search_terms = f"{query_lower} {en_words}"
            break
    
    for source_key, source_info in NEWS_SOURCES.items():
        try:
            feed = feedparser.parse(source_info['url'])
            for entry in feed.entries[:10]:
                title = entry.title
                summary = entry.get('summary', entry.get('description', ''))
                published = entry.get('published', datetime.now().strftime('%a, %d %b %Y'))
                
                searchable_text = f"{title} {summary}".lower()
                
                if (query_lower in searchable_text or 
                    any(term in searchable_text for term in search_terms.split())):
                    
                    articles.append({
                        'id': hashlib.md5(f"{source_key}{entry.link}".encode()).hexdigest(),
                        'title': title,
                        'link': entry.link,
                        'source': source_info['name'],
                        'country': source_info['country'],
                        'credibility': source_info['credibility'],
                        'published': published,
                        'summary': summary[:400] + '...' if len(summary) > 400 else summary,
                        'full_content': f"{title}\n\nالمصدر: {source_info['name']}\n{summary}\n\nالرابط: {entry.link}"
                    })
        except Exception as e:
            print(f"Error from {source_key}: {e}")
    
    articles.sort(key=lambda x: x['credibility'], reverse=True)
    
    return {
        "status": "success", 
        "articles": articles, 
        "count": len(articles),
        "query": request.query
    }