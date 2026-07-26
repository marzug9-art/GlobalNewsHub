from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import feedparser
import hashlib

app = FastAPI(title="GlobalNewsHub")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

NEWS_SOURCES = {
    'bbc': 'http://feeds.bbci.co.uk/news/world/rss.xml',
    'aljazeera': 'https://www.aljazeera.com/xml/rss/all.xml',
    'cnn': 'http://rss.cnn.com/rss/edition_world.rss',
}

class SearchRequest(BaseModel):
    query: str
    language: Optional[str] = "ar"

@app.get("/")
def root():
    return {"message": "GlobalNewsHub API is running!"}

@app.post("/api/search")
def search_news(request: SearchRequest):
    articles = []
    for source_name, feed_url in NEWS_SOURCES.items():
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries[:10]:
                if request.query.lower() in entry.title.lower() or request.query.lower() in entry.get('summary', '').lower():
                    articles.append({
                        'id': hashlib.md5(entry.link.encode()).hexdigest(),
                        'title': entry.title,
                        'link': entry.link,
                        'source': source_name,
                        'published': entry.get('published', ''),
                        'summary': entry.get('summary', '')[:200] + '...',
                        'credibility': {'bbc': 95, 'cnn': 90, 'aljazeera': 85}.get(source_name, 70)
                    })
        except Exception as e:
            print(f"Error: {e}")
    return {"status": "success", "articles": articles}