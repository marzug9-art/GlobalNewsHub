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

CACHE = {}
CACHE_LOCK = threading.Lock()
CACHE_DURATION = 60 * 5 # حفظ النتائج لمدة 5 دقائق

BLOCKED_KEYWORDS = ['sex', 'porn', 'xxx', 'nude', 'إباحي', 'جنس', 'عري', 'فاحش', 'مخدرات', 'drugs']

# قاموس المرادفات المحسن
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

# ✅ مصادر البحث العادي (فقط المصادر السريعة والموثوقة جداً - 12 مصدراً)
PRIMARY_SOURCES = {
    'aljazeera': {'name': 'الجزيرة', 'url': 'https://www.aljazeera.com/xml/rss/all.xml', 'credibility': 85, 'country': 'قطر'},
    'alarabiya': {'name': 'العربية', 'url': 'https://www.alarabiya.net/ar/rss', 'credibility': 82, 'country': 'السعودية'},
    'skynewsarabia': {'name': 'Sky News Arabia', 'url': 'https://www.skynewsarabia.com/rss', 'credibility': 84, 'country': 'UAE'},
    'bbc_arabic': {'name': 'BBC عربي', 'url': 'https://feeds.bbci.co.uk/arabic/rss.xml', 'credibility': 93, 'country': 'بريطانيا'},
    'cnn': {'name': 'CNN', 'url': 'http://rss.cnn.com/rss/edition_world.rss', 'credibility': 90, 'country': 'أمريكا'},
    'reuters': {'name': 'Reuters', 'url': 'https://www.reutersagency.com/feed/', 'credibility': 96, 'country': 'عالمي'},
    'rt_arabic': {'name': 'RT عربي', 'url': 'https://arabic.rt.com/rss', 'credibility': 78, 'country': 'روسيا'},
    'dw_arabic': {'name': 'DW عربي', 'url': 'https://rss.dw.com/xml/rss/ar-all', 'credibility': 90, 'country': 'ألمانيا'},
    'france24_arabic': {'name': 'فرانس 24 عربي', 'url': 'http://www.france24.com/ar/rss.xml', 'credibility': 88, 'country': 'فرنسا'},
    'okaz': {'name': 'عكاظ', 'url': 'https://www.okaz.com.sa/rss', 'credibility': 83, 'country': 'السعودية'},
    'alkhaleej': {'name': 'الخليج', 'url': 'https://www.alkhaleej.ae/rss', 'credibility': 84, 'country': 'الإمارات'},
    'alqabas': {'name': 'القبس', 'url': 'https://alqabas.com/feed', 'credibility': 81, 'country': 'الكويت'},
}

# ✅ مصادر البحث الشامل (مدونات + تحليلات + مصادر إضافية - 9 مصادر)
SECONDARY_SOURCES = {
    'gulf_economy': {'name': 'الخليج الاقتصادي', 'url': 'https://gulf-economy.com/feed/', 'credibility': 82, 'country': 'خليجي'},
    'vision_uae': {'name': 'رؤية الإمارات', 'url': 'https://vision2030.ae/feed/', 'credibility': 85, 'country': 'الإمارات'},
    'kuwait_digital': {'name': 'الكويت الرقمية', 'url': 'https://kuwait-digital.com/feed/', 'credibility': 78, 'country': 'الكويت'},
    'bahrain_today': {'name': 'البحرين اليوم', 'url': 'https://bahrain-today.com/feed/', 'credibility': 79, 'country': 'البحرين'},
    'oman_future': {'name': 'عمان المستقبل', 'url': 'https://oman-future.com/feed/', 'credibility': 80, 'country': 'عمان'},
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
    return {"message": "GlobalNewsHub API - Optimized & Separated Sources"}

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

def fetch_single_source(source_key, source_info, search_terms, cutoff_date):
    articles = []
    try:
        feed = feedparser.parse(source_info['url'])
        for entry in feed.entries[:10]: # جلب آخر 10 أخبار فقط من كل مصدر للسرعة
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
    cache_key = f"{request.query}_{request.source_filter}_{request.max_days}_{request.global_search}"
    with CACHE_LOCK:
        if cache_key in CACHE:
            cached_time, cached_data = CACHE[cache_key]
            if time.time() - cached_time < CACHE_DURATION:
                return cached_data

    query_lower = request.query.lower().strip()
    
    # إضافة النص الأصلي للبحث لضمان العثور على الأخبار المحلية
    search_terms = [query_lower] 
    
    for ar_word, synonyms in SYNONYMS.items():
        if ar_word in query_lower or any(syn in query_lower for syn in synonyms):
            search_terms.extend(synonyms)
            break
            
    # إزالة التكرار
    seen = set()
    unique_terms = []
    for term in search_terms:
        if term not in seen:
            seen.add(term)
            unique_terms.append(term)
    search_terms = unique_terms

    cutoff_date = datetime.now() - timedelta(days=request.max_days)

    # ✅ الفصل التام للمصادر بناءً على نوع البحث
    if request.global_search:
        target_sources = SECONDARY_SOURCES # البحث الشامل يستخدم المدونات والتحليلات فقط
    else:
        target_sources = PRIMARY_SOURCES   # البحث العادي يستخدم المصادر الإخبارية السريعة فقط
    
    # إذا تم تحديد مصدر معين في البحث العادي
    if request.source_filter and not request.global_search:
        filtered = {k: v for k, v in target_sources.items() if request.source_filter.lower() in v['name'].lower()}
        if filtered:
            target_sources = filtered

    all_articles = []
    # تنفيذ متوازٍ لـ 12 مصدراً كحد أقصى (سريع جداً)
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