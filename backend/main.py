from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import feedparser
import hashlib
import re
import time
import urllib.request
import ssl
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
CACHE_DURATION = 60 * 5

BLOCKED_KEYWORDS = ['sex', 'porn', 'xxx', 'nude', 'إباحي', 'جنس', 'عري', 'فاحش', 'مخدرات', 'drugs']

# قاموس المرادفات الموسع - تم إصلاحه وتوسيعه
SYNONYMS = {
    'ايران': ['ايران', 'إيران', 'أيران', 'iran', 'persia', 'طهران', 'tehran'],
    'الكويت': ['الكويت', 'kuwait'],
    'امريكا': ['امريكا', 'أمريكا', 'أميركا', 'الولايات المتحدة', 'america', 'united states', 'us', 'usa', 'washington', 'واشنطن', 'ترامب', 'trump', ' بايدن', 'biden'],
    'السعودية': ['السعودية', 'السعوديه', 'saudi', 'riyadh', 'الرياض', 'بن سلمان', 'mbs', 'رؤية'],
    'الإمارات': ['الإمارات', 'الامارات', 'uae', 'dubai', 'دبي', 'ابوظبي', 'أبوظبي', 'محمد بن زايد'],
    'قطر': ['قطر', 'qatar', 'الدوحة', 'doha', 'تميم'],
    'مصر': ['مصر', 'egypt', 'القاهرة', 'cairo', 'السيسي', 'sisi'],
    'تركيا': ['تركيا', 'turkey', 'انقرة', 'ankara', 'اردوغان', 'erdogan'],
    'روسيا': ['روسيا', 'russia', 'موسكو', 'moscow', 'putin', 'بوتين'],
    'الصين': ['الصين', 'china', 'بكين', 'beijing', 'شي', 'xi'],
    'بريطانيا': ['بريطانيا', 'انجلترا', 'britain', 'uk', 'england', 'london', 'لندن'],
    'فرنسا': ['فرنسا', 'france', 'باريس', 'paris', 'ماكرون', 'macron'],
    'المانيا': ['المانيا', 'ألمانيا', 'germany', 'berlin', 'برلين'],
    'اسرائيل': ['اسرائيل', 'إسرائيل', 'israel', 'تل ابيب', 'netanyahu', 'نتنياهو'],
    'فلسطين': ['فلسطين', 'palestine', 'غزة', 'gaza', 'القدس', 'jerusalem', 'حماس', 'hamas'],
    'العراق': ['العراق', 'iraq', 'بغداد', 'baghdad'],
    'سوريا': ['سوريا', 'syria', 'دمشق', 'damascus', 'الاسد', 'assad'],
    'لبنان': ['لبنان', 'lebanon', 'بيروت', 'beirut', 'حزب الله', 'hezbollah'],
    'اليمن': ['اليمن', 'yemen', 'صنعاء', 'sanaa', 'الحوثي', 'houthi'],
    'ليبيا': ['ليبيا', 'libya', 'طرابلس', 'tripoli'],
    'السودان': ['السودان', 'sudan', 'الخرطوم', 'khartoum'],
    'الجزائر': ['الجزائر', 'algeria', 'الجزائر العاصمة'],
    'المغرب': ['المغرب', 'morocco', 'الرباط', 'rabat'],
    'تونس': ['تونس', 'tunisia', 'تونس العاصمة'],
    'الاردن': ['الاردن', 'الأردن', 'jordan', 'عمان', 'amman'],
    'البحرين': ['البحرين', 'bahrain', 'المنامة', 'manama'],
    'عمان': ['عمان', 'oman', 'مسقط', 'muscat', 'سلطنة'],
    'ukraine': ['اوكرانيا', 'أوكرانيا', 'ukraine', 'كييف', 'kyiv', 'zelensky', 'زيلينسكي'],
}

BREAKING_KEYWORDS = ['عاجل', 'عاجلة', 'breaking', 'مباشر', 'live', 'حصري', 'urgent', 'flash']

# مصادر RSS دولية موثوقة ومفتوحة عالمياً
INTERNATIONAL_SOURCES = {
    'aljazeera': {'name': 'الجزيرة', 'url': 'https://www.aljazeera.com/xml/rss/all.xml', 'credibility': 85, 'country': 'قطر'},
    'alarabiya': {'name': 'العربية', 'url': 'https://www.alarabiya.net/feed.rss', 'credibility': 82, 'country': 'السعودية'},
    'skynewsarabia': {'name': 'Sky News Arabia', 'url': 'https://www.skynewsarabia.com/rss', 'credibility': 84, 'country': 'الإمارات'},
    'bbc_arabic': {'name': 'BBC عربي', 'url': 'https://feeds.bbci.co.uk/arabic/rss.xml', 'credibility': 93, 'country': 'بريطانيا'},
    'bbc_world': {'name': 'BBC World', 'url': 'http://feeds.bbci.co.uk/news/world/rss.xml', 'credibility': 95, 'country': 'بريطانيا'},
    'cnn_world': {'name': 'CNN World', 'url': 'http://rss.cnn.com/rss/edition_world.rss', 'credibility': 90, 'country': 'أمريكا'},
    'cnn_top': {'name': 'CNN Top', 'url': 'http://rss.cnn.com/rss/cnn_topstories.rss', 'credibility': 90, 'country': 'أمريكا'},
    'reuters_world': {'name': 'Reuters World', 'url': 'https://news.google.com/rss/search?q=site:reuters.com&hl=en-US&gl=US&ceid=US:en', 'credibility': 96, 'country': 'عالمي'},
    'rt_arabic': {'name': 'RT عربي', 'url': 'https://arabic.rt.com/rss', 'credibility': 78, 'country': 'روسيا'},
    'dw_arabic': {'name': 'DW عربي', 'url': 'https://rss.dw.com/xml/rss/ar-all', 'credibility': 90, 'country': 'ألمانيا'},
    'france24_arabic': {'name': 'فرانس 24', 'url': 'https://www.france24.com/ar/%D8%A7%D9%84%D8%B9%D8%A7%D8%AC%D9%84/rss', 'credibility': 88, 'country': 'فرنسا'},
    'aljazeera_en': {'name': 'Al Jazeera EN', 'url': 'https://www.aljazeera.com/xml/rss/all.xml', 'credibility': 88, 'country': 'قطر'},
    'apnews': {'name': 'AP News', 'url': 'https://rsshub.app/apnews/topics/apf-topnews', 'credibility': 97, 'country': 'أمريكا'},
    'euronews': {'name': 'Euronews', 'url': 'https://www.euronews.com/rss', 'credibility': 89, 'country': 'أوروبا'},
    'guardian_world': {'name': 'The Guardian', 'url': 'https://www.theguardian.com/world/rss', 'credibility': 92, 'country': 'بريطانيا'},
    'nytimes_world': {'name': 'NY Times', 'url': 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'credibility': 93, 'country': 'أمريكا'},
    'washingtonpost': {'name': 'Washington Post', 'url': 'https://feeds.washingtonpost.com/rss/world', 'credibility': 92, 'country': 'أمريكا'},
    'google_news_ar': {'name': 'Google News عربي', 'url': 'https://news.google.com/rss?hl=ar&gl=SA&ceid=SA:ar', 'credibility': 80, 'country': 'عالمي'},
    'google_news_en': {'name': 'Google News EN', 'url': 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en', 'credibility': 80, 'country': 'عالمي'},
}

SECONDARY_SOURCES = {
    'al_monitor': {'name': 'Al-Monitor', 'url': 'https://www.al-monitor.com/feed', 'credibility': 88, 'country': 'عالمي'},
    'middle_east_eye': {'name': 'Middle East Eye', 'url': 'https://www.middleeasteye.net/rss', 'credibility': 85, 'country': 'بريطانيا'},
    'voa_arabic': {'name': 'VOA عربي', 'url': 'https://www.voanews.com/api/z-oqzq4xq', 'credibility': 87, 'country': 'أمريكا'},
    'carnegie': {'name': 'Carnegie', 'url': 'https://carnegieendowment.org/rss', 'credibility': 92, 'country': 'أمريكا'},
}

class SearchRequest(BaseModel):
    query: str
    language: Optional[str] = "ar"
    source_filter: Optional[str] = None
    max_days: Optional[int] = 3
    global_search: Optional[bool] = False

@app.get("/")
def root():
    return {"message": "GlobalNewsHub API - Fully Fixed", "version": "2.0"}

def is_content_safe(text: str) -> bool:
    if not text:
        return True
    text_lower = text.lower()
    return not any(word in text_lower for word in BLOCKED_KEYWORDS)

def clean_html(raw_html: str) -> str:
    if not raw_html:
        return ""
    clean_text = re.sub(r'<[^>]+>', '', raw_html)
    clean_text = re.sub(r'\s+', ' ', clean_text).strip()
    if len(clean_text) > 400:
        clean_text = clean_text[:400] + '...'
    return clean_text

def parse_date_safely(entry):
    date_fields = ['published', 'updated', 'created']
    for field in date_fields:
        raw_date = entry.get(field)
        if raw_date:
            try:
                dt = parsedate_to_datetime(raw_date)
                return dt.strftime('%Y-%m-%d %H:%M'), dt
            except Exception:
                pass
            formats = [
                '%Y-%m-%dT%H:%M:%S%z',
                '%a, %d %b %Y %H:%M:%S %z',
                '%Y-%m-%d %H:%M:%S',
                '%Y-%m-%dT%H:%M:%SZ',
            ]
            for fmt in formats:
                try:
                    dt = datetime.strptime(raw_date, fmt)
                    return dt.strftime('%Y-%m-%d %H:%M'), dt
                except ValueError:
                    continue
    return None, None

def fetch_single_source(source_key, source_info, search_terms, cutoff_date, strict_date=True):
    articles = []
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        req = urllib.request.Request(
            source_info['url'],
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                'Accept-Language': 'ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7',
            }
        )
        
        with urllib.request.urlopen(req, timeout=15, context=ctx) as response:
            rss_data = response.read()
            
        feed = feedparser.parse(rss_data)
        
        if not feed.entries:
            return articles

        for entry in feed.entries[:20]:
            try:
                title = entry.get('title', '')
                if not title or not is_content_safe(title):
                    continue
                
                raw_summary = entry.get('summary', entry.get('description', ''))
                summary = clean_html(raw_summary)
                if not is_content_safe(summary):
                    continue
                
                published_str, published_dt = parse_date_safely(entry)
                
                # تطبيق فلتر التاريخ فقط إذا كان strict_date=True
                if strict_date and published_dt:
                    if published_dt < cutoff_date:
                        continue
                
                # إذا لم يوجد تاريخ، نستخدم تاريخ اليوم
                if published_dt is None:
                    published_dt = datetime.now()
                    published_str = published_dt.strftime('%Y-%m-%d %H:%M')
                
                searchable_text = f"{title} {summary}".lower()
                
                # التحقق من المطابقة
                matched = False
                for term in search_terms:
                    if term in searchable_text:
                        matched = True
                        break
                
                if matched:
                    articles.append({
                        'id': hashlib.md5(f"{source_key}{entry.get('link', '')}{title}".encode()).hexdigest(),
                        'title': title,
                        'link': entry.get('link', ''),
                        'source': source_info['name'],
                        'country': source_info['country'],
                        'credibility': source_info['credibility'],
                        'published': published_str,
                        'summary': summary if summary else title,
                        'is_breaking': any(kw in title.lower() for kw in BREAKING_KEYWORDS),
                        'full_content': f"{title}\n\n{summary}"
                    })
            except Exception as e:
                print(f"Error processing entry from {source_key}: {e}")
                continue
                
    except Exception as e:
        print(f"Error fetching {source_key}: {e}")
    return articles

@app.post("/api/search")
def search_news(request: SearchRequest):
    try:
        cache_key = f"{request.query}_{request.source_filter}_{request.max_days}_{request.global_search}"
        with CACHE_LOCK:
            if cache_key in CACHE:
                cached_time, cached_data = CACHE[cache_key]
                if time.time() - cached_time < CACHE_DURATION:
                    return cached_data

        query_lower = request.query.lower().strip()
        
        # بناء قائمة مصطلحات البحث - إصلاح الخطأ الإملائي
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

        if request.global_search:
            target_sources = SECONDARY_SOURCES
        else:
            target_sources = INTERNATIONAL_SOURCES
        
        if request.source_filter and not request.global_search:
            filtered = {k: v for k, v in target_sources.items() 
                       if request.source_filter.lower() in v['name'].lower()}
            if filtered:
                target_sources = filtered

        all_articles = []
        
        # المرحلة الأولى: البحث مع فلتر التاريخ
        with ThreadPoolExecutor(max_workers=15) as executor:
            futures = {
                executor.submit(fetch_single_source, key, info, search_terms, cutoff_date, True): key 
                for key, info in target_sources.items()
            }
            for future in as_completed(futures):
                all_articles.extend(future.result())

        # المرحلة الثانية: إذا لم توجد نتائج، البحث بدون فلتر التاريخ (fallback)
        if len(all_articles) == 0 and not request.global_search:
            print(f"No results with date filter, trying without for query: {query_lower}")
            with ThreadPoolExecutor(max_workers=15) as executor:
                futures = {
                    executor.submit(fetch_single_source, key, info, search_terms, cutoff_date, False): key 
                    for key, info in target_sources.items()
                }
                for future in as_completed(futures):
                    all_articles.extend(future.result())

        all_articles.sort(key=lambda x: (not x['is_breaking'], x['published']), reverse=True)
        
        # إزالة التكرار في النتائج
        seen_ids = set()
        unique_articles = []
        for art in all_articles:
            if art['id'] not in seen_ids:
                seen_ids.add(art['id'])
                unique_articles.append(art)
        
        response_data = {
            "status": "success",
            "articles": unique_articles[:50],
            "count": len(unique_articles),
            "query": request.query,
            "search_terms": search_terms[:5]
        }

        with CACHE_LOCK:
            CACHE[cache_key] = (time.time(), response_data)

        return response_data
        
    except Exception as e:
        print(f"Global error: {e}")
        return {
            "status": "error",
            "message": str(e),
            "articles": [],
            "count": 0
        }