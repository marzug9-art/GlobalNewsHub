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

# 🛡️ النقطة 0: كلمات محظورة لمنع المحتوى غير الأخلاقي أو المشبوه
BLOCKED_KEYWORDS = [
    'sex', 'porn', 'xxx', 'nude', 'إباحي', 'جنس', 'عري', 'فاحش', 'مخدرات', 'drugs'
]

# 🔍 النقطة 1: قاموس المرادفات الشامل (عربي / إنجليزي)
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

# 🚨 النقطة 4: كلمات تدل على الأخبار العاجلة
BREAKING_KEYWORDS = ['عاجل', 'عاجلة', 'breaking', 'مباشر', 'live', 'حصري']

# 🌍 النقطة 5: مصادر عالمية متنوعة (تمت إضافة المزيد)
NEWS_SOURCES = {
    # 🇦 عربية
    'aljazeera': {'name': 'الجزيرة', 'url': 'https://www.aljazeera.com/xml/rss/all.xml', 'credibility': 85, 'country': 'قطر'},
    'alarabiya': {'name': 'العربية', 'url': 'https://www.alarabiya.net/ar/rss', 'credibility': 82, 'country': 'السعودية'},
    'skynewsarabia': {'name': 'Sky News Arabia', 'url': 'https://www.skynewsarabia.com/rss', 'credibility': 84, 'country': 'UAE'},
    'bbc_arabic': {'name': 'BBC عربي', 'url': 'https://feeds.bbci.co.uk/arabic/rss.xml', 'credibility': 93, 'country': 'بريطانيا'},
    'france24_arabic': {'name': 'فرانس 24 عربي', 'url': 'http://www.france24.com/ar/rss.xml', 'credibility': 88, 'country': 'فرنسا'},
    'rt_arabic': {'name': 'RT عربي', 'url': 'https://arabic.rt.com/rss', 'credibility': 78, 'country': 'روسيا'},
    
    # 🇬🇧 بريطانية
    'bbc': {'name': 'BBC', 'url': 'http://feeds.bbci.co.uk/news/world/rss.xml', 'credibility': 95, 'country': 'بريطانيا'},
    'theguardian': {'name': 'The Guardian', 'url': 'https://www.theguardian.com/world/rss', 'credibility': 92, 'country': 'بريطانيا'},
    
    # 🇺 أمريكية
    'cnn': {'name': 'CNN', 'url': 'http://rss.cnn.com/rss/edition_world.rss', 'credibility': 90, 'country': 'أمريكا'},
    'nytimes': {'name': 'New York Times', 'url': 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'credibility': 93, 'country': 'أمريكا'},
    
    # 🇫🇷 فرنسية
    'lemonde': {'name': 'Le Monde', 'url': 'https://www.lemonde.fr/rss/une.xml', 'credibility': 91, 'country': 'فرنسا'},
    
    # 🇮 إيرانية
    'presstv': {'name': 'Press TV', 'url': 'https://www.presstv.com/RSSFeed/rss', 'credibility': 75, 'country': 'إيران'},
    
    # 🇮🇱 إسرائيلية
    'haaretz': {'name': 'Haaretz', 'url': 'https://www.haaretz.com/csp/feeds/1.593', 'credibility': 85, 'country': 'إسرائيل'},
    'timesofisrael': {'name': 'Times of Israel', 'url': 'https://www.timesofisrael.com/feed/', 'credibility': 83, 'country': 'إسرائيل'},
    
    # 🌍 عالمية
    'reuters': {'name': 'Reuters', 'url': 'https://www.reutersagency.com/feed/', 'credibility': 96, 'country': 'عالمي'},
}