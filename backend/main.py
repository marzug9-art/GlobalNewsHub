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

app = FastAPI(title="GlobalNewsHub")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== إعدادات التسريع والذاكرة المؤقتة =====
CACHE = {}
CACHE_LOCK = threading.Lock()
CACHE_DURATION = 60 * 5 # حفظ النتائج لمدة 5 دقائق

BLOCKED_KEYWORDS = ['sex', 'porn', 'xxx', 'nude', 'إباحي', 'جنس', 'عري', 'فاحش', 'مخدرات', 'drugs']

SYNONYMS = {
    'ايران': ['ايران', 'إيران', 'أيران', 'iran', 'persia'],
    'الكويت': ['الكويت', 'kuwait'],
    'السعودية': ['السعودية', 'saudi', 'riyadh'],
    'الإمارات': ['الإمارات', 'uae', 'dubai'],
    'قطر': ['قطر', 'qatar', 'الدوحة'],
    'عمان': ['عمان', 'oman', 'مسقط'],
    'البحرين': ['البحرين', 'bahrain', 'المنامة'],
}

BREAKING_KEYWORDS = ['عاجل', 'عاجلة', 'breaking', 'مباشر', 'live', 'حصري']

# المصادر الإخبارية الرئيسية (سريعة وموثوقة)
NEWS_SOURCES = {
    'aljazeera': {'name': 'الجزيرة', 'url': 'https://www.aljazeera.com/xml/rss/all.xml', 'credibility': 85, 'country': 'قطر'},
    'alarabiya': {'name': 'العربية', 'url': 'https://www.alarabiya.net/ar/rss', 'credibility': 82, 'country': 'السعودية'},
    'skynewsarabia': {'name': 'Sky News Arabia', 'url': 'https://www.skynewsarabia.com/rss', 'credibility': 84, 'country': 'UAE'},
    'bbc_arabic': {'name': 'BBC عربي', 'url': 'https://feeds.bbci.co.uk/arabic/rss.xml', 'credibility': 93, 'country': 'بريطانيا'},
    'cnn': {'name': 'CNN', 'url': 'http://rss.cnn.com/rss/edition_world.rss', 'credibility': 90, 'country': 'أمريكا'},
    'reuters': {'name': 'Reuters', 'url': 'https://www.reutersagency.com/feed/', 'credibility': 96, 'country': 'عالمي'},
    'theguardian': {'name': 'The Guardian', 'url': 'https://www.theguardian.com/world/rss', 'credibility': 92, 'country': 'بريطانيا'},
    'nytimes': {'name': 'New York Times', 'url': 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'credibility': 93, 'country': 'أمريكا'},
    'rt_arabic': {'name': 'RT عربي', 'url': 'https://arabic.rt.com/rss', 'credibility': 78, 'country': 'روسيا'},
    'dw_arabic': {'name': 'DW عربي', 'url': 'https://rss.dw.com/xml/rss/ar-all', 'credibility': 90, 'country': 'ألمانيا'},
    'france24_arabic': {'name': 'فرانس 24 عربي', 'url': 'http://www.france24.com/ar/rss.xml', 'credibility': 88, 'country': 'فرنسا'},
    'okaz': {'name': 'عكاظ', 'url': 'https://www.okaz.com.sa/rss', 'credibility': 83, 'country': 'السعودية'},
    'alkhaleej': {'name': 'الخليج', 'url': 'https://www.alkhaleej.ae/rss', 'credibility': 84, 'country': 'الإمارات'},
    'albayan': {'name': 'البيان', 'url': 'https://www.albayan.ae/rss', 'credibility': 83, 'country': 'الإمارات'},
    'alqabas': {'name': 'القبس', 'url': 'https://alqabas.com/feed', 'credibility': 81, 'country': 'الكويت'},
    'omandaily': {'name': 'عمان', 'url': 'https://www.omandaily.om/rss', 'credibility': 80, 'country': 'عمان'},
    'akhbar_alkhaleej': {'name': 'أخبار الخليج', 'url': 'https://www.akhbar-alkhaleej.com/feed', 'credibility': 80, 'country': 'البحرين'},
    'aljazeera_en': {'name': 'Al Jazeera English', 'url': 'https://www.aljazeera.com/xml/rss/all.xml', 'credibility': 88, 'country': 'قطر'},
    'apnews': {'name': 'AP News', 'url': 'https://apnews.com/apf-topnews.rss', 'credibility': 97, 'country': 'أمريكا'},
    'euronews': {'name': 'Euronews', 'url': 'https://www.euronews.com/rss', 'credibility': 89, 'country': 'أوروبا'},
}

# المدونات والمقالات التحليلية الموثوقة (Secondary Sources)
SECONDARY_SOURCES = {
    'middleeasteye': {'name': 'Middle East Eye', 'url': 'https://www.middleeasteye.net/rss', 'credibility': 82, 'country': 'عالمي'},
    'almonitor': {'name': 'Al-Monitor', 'url': 'https://www.al-monitor.com/rss', 'credibility': 85, 'country': 'عالمي'},
    'foreignpolicy': {'name': 'Foreign Policy', 'url': 'https://foreignpolicy.com/feed/', 'credibility': 90, 'country': 'أمريكا'},
    'theglobeandmail': {'name': 'The Globe and Mail', 'url': 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/world/?outputType=xml', 'credibility': 88, 'country': 'كندا'},
    'scmp': {'name': 'South China Morning Post', 'url': 'https://www.scmp.com/rss/322209/feed', 'credibility': 87, 'country': 'هونغ كونغ'},
    'trtworld': {'name': 'TRT World', 'url': 'https://www.trtworld.com/rss', 'credibility': 79, 'country': 'تركيا'},
    'africanews': {'name': 'Africanews', 'url': 'https://www.africanews.com/feed/', 'credibility': 80, 'country': 'أفريقيا'},
    'asiatimes': {'name': 'Asia Times', 'url': 'https://asiatimes.com/feed/', 'credibility': 83, 'country': 'آسيا'},
}

class SearchRequest(BaseModel):
    query: str
    language: Optional[str] = "ar"
    source_filter: Optional[str] = None
    max_days: Optional[int] = 3
    global_search: Optional[bool] = False
    include_blogs: Optional[bool] = False

@app.get("/")
def root():
    return {"message": "GlobalNewsHub API - Optimized with Blogs & Caching"}

def is_content_safe(text: str) -> bool:
    text_lower = text.lower()
    return not any(word in text_lower for word in BLOCKED_KEYWORDS)

def clean_html(raw_html: str) -> str:
    if not raw_html: return ""
    clean_text = re.sub(r'<[^>]+>', '', raw_html)
    return re.sub(r'\s+', ' ', clean_text).strip()[:300] + ('...' if len(clean_text) > 300 else '')

def fetch_single_source(source_key, source_info, search_terms, cutoff_date):
    """دالة لجلب مصدر واحد فقط بشكل متوازٍ"""
    articles = []
    try:
        feed = feedparser.parse(source_info['url'])
        # جلب 8 أخبار فقط للمدونات و10 للمصادر الرئيسية لتوفير الوقت
        limit = 8 if source_key in SECONDARY_SOURCES else 10
        
        for entry in feed.entries[:limit]:
            title = entry.title
            if not is_content_safe(title): continue
            
            raw_summary = entry.get('summary', entry.get('description', ''))
            summary = clean_html(raw_summary)
            if not is_content_safe(summary): continue
            
            try:
                published_dt = parsedate_to_datetime(entry.get('published'))
                if published_dt < cutoff_date: continue
                published_str = published_dt.strftime('%Y-%m-%d %H:%M')
            except: 
                published_str = 'تاريخ غير محدد'
            
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
    # 1. التحقق من الذاكرة المؤقتة أولاً
    cache_key = f"{request.query}_{request.source_filter}_{request.max_days}_{request.global_search}_{request.include_blogs}"
    with CACHE_LOCK:
        if cache_key in CACHE:
            cached_time, cached_data = CACHE[cache_key]
            if time.time() - cached_time < CACHE_DURATION:
                return cached_data

    query_lower = request.query.lower().strip()
    search_terms = [query_lower]
    for ar_word, synonyms in SYNONYMS.items():
        if ar_word in query_lower or any(syn in query_lower for syn in synonyms):
            search_terms.extend(synyms)
            break
    search_terms = list(set(search_terms))
    cutoff_date = datetime.now() - timedelta(days=request.max_days)

    # 2. تحديد المصادر المطلوبة (أساسية + ثانوية إذا طلب المستخدم)
    target_sources = dict(NEWS_SOURCES)
    
    # إذا كان البحث الشامل أو تم تفعيل المدونات، نضيف المصادر الثانوية
    if request.global_search or request.include_blogs:
        target_sources.update(SECONDARY_SOURCES)
        
    # إذا حدد المستخدم مصدراً معيناً، نفلتر القائمة
    if request.source_filter:
        filtered = {k: v for k, v in target_sources.items() if request.source_filter.lower() in v['name'].lower()}
        if filtered: target_sources = filtered

    # 3. التنفيذ المتوازي (Parallel Execution)
    all_articles = []
    # زيادة عدد العمال إلى 15 عند تضمين المدونات
    max_workers = 15 if (request.global_search or request.include_blogs) else 10
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(fetch_single_source, key, info, search_terms, cutoff_date): key 
            for key, info in target_sources.items()
        }
        for future in as_completed(futures):
            all_articles.extend(future.result())

    # ترتيب النتائج: عاجل أولاً، ثم الأحدث
    all_articles.sort(key=lambda x: (not x['is_breaking'], x['published']), reverse=True)
    
    response_data = {
        "status": "success", 
        "articles": all_articles[:60], # زيادة السقف قليلاً عند دمج المدونات
        "count": len(all_articles), 
        "query": request.query
    }

    # 4. حفظ النتيجة في الذاكرة المؤقتة
    with CACHE_LOCK:
        CACHE[cache_key] = (time.time(), response_data)

    return response_data