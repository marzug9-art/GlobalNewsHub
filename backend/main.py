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