from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import feedparser
import hashlib
import re
import time
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
import requests # تأكد من إضافتها في requirements.txt

app = FastAPI(title="GlobalNewsHub")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CACHE = {}
CACHE_LOCK = threading.Lock()
CACHE_DURATION = 60 * 5 

BLOCKED_KEYWORDS = ['sex', 'porn', 'xxx', 'nude', 'إباحي', 'جنس', 'عري', 'فاحش', 'مخدرات', 'drugs']

SYNONYMS = {
    'ايران': ['ايران', 'إيران', 'أيران', 'iran', 'persia'],
    'الكويت': ['الكويت', 'kuwait'],
    'السعودية': ['السعودية', 'السعوديه', 'saudi', 'riyadh', 'الرياض'],
    'الإمارات': ['الإمارات', 'الامارات', 'uae', 'dubai', 'دبي'],
    'قطر': ['قطر', 'qatar', 'الدوحة', 'doha'],
    'عمان': ['عمان', 'oman', 'مسقط', 'muscat'],
    'البحرين': ['البحرين', 'bahrain', 'المنامة', 'manama'],
}

BREAKING_KEYWORDS = ['عاجل', 'عاجلة', 'breaking', 'مباشر', 'live', 'حصري']

# ✅ مصادر البحث الدولي الموثوقة
INTERNATIONAL_SOURCES = {
    'aljazeera': {'name': 'الجزيرة', 'url': 'https://www.aljazeera.com/xml/rss/all.xml', 'credibility': 85, 'country': 'قطر'},
    'alarabiya': {'name': 'العربية', 'url': 'https://www.alarabiya.net/ar/rss', 'credibility': 82, 'country': 'السعودية'},
    'skynewsarabia': {'name': 'Sky News Arabia', 'url': 'https://www.skynewsarabia.com/rss', 'credibility': 84, 'country': 'UAE'},
    'bbc_arabic': {'name': 'BBC عربي', 'url': 'https://feeds.bbci.co.uk/arabic/rss.xml', 'credibility': 93, 'country': 'بريطانيا'},
    'cnn': {'name': 'CNN', 'url': 'http://rss.cnn.com/rss/edition_world.rss', 'credibility': 90, 'country': 'أمريكا'},
    'reuters': {'name': 'Reuters', 'url': 'https://www.reutersagency.com/feed/', 'credibility': 96, 'country': 'عالمي'},
    'rt_arabic': {'name': 'RT عربي', 'url': 'https://arabic.rt.com/rss', 'credibility': 78, 'country': 'روسيا'},
    'dw_arabic': {'name': 'DW عربي', 'url': 'https://rss.dw.com/xml/rss/ar-all', 'credibility': 90, 'country': 'ألمانيا'},
    'france24_arabic': {'name': 'فرانس 24 عربي', 'url': 'http://www.france24.com/ar/rss.xml', 'credibility': 88, 'country': 'فرنسا'},
    'aljazeera_en': {'name': 'Al Jazeera English', 'url': 'https://www.aljazeera.com/xml/rss/all.xml', 'credibility': 88, 'country': 'قطر'},
    'apnews': {'name': 'AP News', 'url': 'https://apnews.com/apf-topnews.rss', 'credibility': 97, 'country': 'أمريكا'},
    'euronews': {'name': 'Euronews', 'url': 'https://www.euronews.com/rss', 'credibility': 89, 'country': 'أوروبا'},
}

SECONDARY_SOURCES = {
    'al_monitor': {'name': 'Al-Monitor', 'url': 'https://www.al-monitor.com/rss', 'credibility': 88, 'country': 'عالمي'},
    'middle_east_eye': {'name': 'Middle East Eye', 'url': 'https://www.middleeasteye.net/rss.xml', 'credibility': 85, 'country': 'بريطانيا'},
    'carnegie_mec': {'name': 'Carnegie MEC', 'url': 'https://carnegie-mec.org/feed/', 'credibility': 92, 'country': 'لبنان'},
    'voa_arabic': {'name': 'VOA عربي', 'url': 'https://www.voanews.com/api/zr8z-lq4r', 'credibility': 87, 'country': 'أمريكا'},
}

class SearchRequest(BaseModel):
    query: str
    language: Optional[str] = "ar"
    source_filter: Optional[str] = None
    max_days: Optional[int] = 3
    global_search: Optional[bool] = False

@app.get("/")
def root():
    return {"message": "GlobalNewsHub API - Fixed RSS Connections"}

def is_content_safe(text: str) -> bool:
    text_lower = text.lower()
    return not any(word in text_lower for word in BLOCKED_KEYWORDS)

def clean_html(raw_html: str) -> str:
    if not raw_html: return ""
    clean_text = re.sub(r'<[^>]+>', '', raw_html)
    return re.sub(r'\s+', ' ', clean_text).strip()[:300] + ('...' if len(clean_text) > 300 else '')

def parse_date_safely(entry):
    date_fields = ['published', 'updated', 'created']
    for field in date_fields:
        raw_date = entry.get(field)
        if raw_date:
            try:
                dt = parsedate_to_datetime(raw_date)
                return dt.strftime('%Y-%m-%d %H:%M'), dt
            except Exception:
                formats = ['%Y-%m-%dT%H:%M:%S%z', '%a, %d %b %Y %H:%M:%S %z', '%Y-%m-%d %H:%M:%S']
                for fmt in formats:
                    try:
                        dt = datetime.strptime(raw_date, fmt)
                        return dt.strftime('%Y-%m-%d %H:%M'), dt
                    except ValueError:
                        continue
    return None, None

# دالة جلب مصدر واحد باستخدام requests لمحاكاة المتصفح وتجاوز الحظر الجغرافي
def fetch_single_source(source_key, source_info, search_terms, cutoff_date):
    articles = []
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            'Accept-Language': 'ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'no-cache'
        }
        
        # جلب محتوى RSS يدوياً أولاً
        response = requests.get(source_info['url'], headers=headers, timeout=10)
        response.raise_for_status()
        
        # تحليل المحتوى الذي تم جلبه بنجاح
        feed = feedparser.parse(response.text)
        
        if not feed.entries:
            print(f"No entries found for {source_key}")
            return articles

        for entry in feed.entries[:15]: 
            title = entry.title
            if not is_content_safe(title): continue
            
            raw_summary = entry.get('summary', entry.get('description', ''))
            summary = clean_html(raw_summary)
            if not is_content_safe(summary): continue
            
            published_str, published_dt = parse_date_safely(entry)
            if published_dt is None:
                published_dt = datetime.now()
                published_str = published_dt.strftime('%Y-%m-%d %H:%M')
                
            if published_dt < cutoff_date: continue
            
            searchable_text = f"{title} {summary}".lower()
            if any(term in searchable_text for term in search_terms):
                articles.append({
                    'id': hashlib.md5(f"{source_key}{entry.link}".encode()).hexdigest(),
                    'title': title, 'link': entry.link, 'source': source_info['name'],
                    'country': source_info['country'], 'credibility': source_info['credibility'],
                    'published': published_str, 'summary': summary,
                    'is_breaking': any(kw in title.lower() for kw in BREAKING_KEYWORDS),
                    'full_content': f"{title}\n\n{summary}"
                })
    except Exception as e:
        print(f"Error fetching {source_key}: {e}")
    return articles

@app.post("/api/search")
def search_news(request: SearchRequest):
    try: # إضافة try-except شاملة للمسار الرئيسي لمنع توقف الخادم
        cache_key = f"{request.query}_{request.source_filter}_{request.max_days}_{request.global_search}"
        with CACHE_LOCK:
            if cache_key in CACHE:
                cached_time, cached_data = CACHE[cache_key]
                if time.time() - cached_time < CACHE_DURATION:
                    return cached_data

        query_lower = request.query.lower().strip()
        search_terms = [query_lower] 
        
        for ar_word, synonyms in SYNONYMS.items():
            if ar_word in query_lower or any(syn in query_lower for syn in synonyms):
                search_terms.extend(synonyms)
                break
                
        seen = set()
        unique_terms = []
        for term in search_terms:
            if term not in seen:
                seen.add(term)
                unique_terms.append(term)
        search_terms = unique_terms

        cutoff_date = datetime.now() - timedelta(days=request.max_days)

        if request.global_search:
            target_sources = SECONDARY_SOURCES 
        else:
            target_sources = INTERNATIONAL_SOURCES   
        
        if request.source_filter and not request.global_search:
            filtered = {k: v for k, v in target_sources.items() if request.source_filter.lower() in v['name'].lower()}
            if filtered:
                target_sources = filtered

        all_articles = []
        with ThreadPoolExecutor(max_workers=12) as executor:
            futures = {
                executor.submit(fetch_single_source, key, info, search_terms, cutoff_date): key 
                for key, info in target_sources.items()
            }
            for future in as_completed(futures):
                all_articles.extend(future.result())

        all_articles.sort(key=lambda x: (not x['is_breaking'], x['published']), reverse=True)
        
        response_data = {
            "status": "success", "articles": all_articles[:50],
            "count": len(all_articles), "query": request.query
        }

        with CACHE_LOCK:
            CACHE[cache_key] = (time.time(), response_data)

        return response_data
    except Exception as e:
        # في حالة حدوث أي خطأ غير متوقع، نعيد رسالة واضحة بدلاً من توقف الخادم
        print(f"CRITICAL ERROR in search_news: {e}")
        return {"status": "error", "message": "حدث خطأ داخلي في الخادم، يرجى المحاولة لاحقاً.", "articles": []}