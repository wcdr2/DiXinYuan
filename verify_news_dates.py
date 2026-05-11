#!/usr/bin/env python3
import requests
import json
from datetime import datetime
from collections import defaultdict

# Fetch news from API
print("Fetching news from API...")
response = requests.get('http://localhost:8080/api/v1/news?limit=2000')
news_list = response.json()

print(f"Total news fetched: {len(news_list)}")

# Parse dates
dates = []
out_of_range = []
future_dates = []
before_2024 = []

min_date = datetime(2024, 1, 1)
max_date = datetime.now()

for article in news_list:
    published_at = article.get('publishedAt', '')
    if not published_at:
        continue

    # Parse ISO date (e.g., "2026-04-30T10:37+08:00")
    try:
        # Remove timezone for comparison
        date_str = published_at.split('+')[0].split('T')[0]
        article_date = datetime.strptime(date_str, '%Y-%m-%d')
        dates.append(article_date)

        if article_date < min_date:
            before_2024.append({
                'id': article['id'],
                'title': article['title'][:50],
                'publishedAt': published_at,
                'url': article['originalUrl']
            })
        elif article_date > max_date:
            future_dates.append({
                'id': article['id'],
                'title': article['title'][:50],
                'publishedAt': published_at,
                'url': article['originalUrl']
            })
    except Exception as e:
        print(f"Error parsing date {published_at}: {e}")

# Statistics
if dates:
    dates.sort()
    print(f"\n=== Date Range Analysis ===")
    print(f"Earliest date: {dates[0].strftime('%Y-%m-%d')}")
    print(f"Latest date: {dates[-1].strftime('%Y-%m-%d')}")
    print(f"Expected range: 2024-01-01 to {max_date.strftime('%Y-%m-%d')}")

    print(f"\n=== Issues Found ===")
    print(f"Articles before 2024-01-01: {len(before_2024)}")
    print(f"Articles in future: {len(future_dates)}")

    if before_2024:
        print("\n--- Articles before 2024-01-01 (first 10) ---")
        for article in before_2024[:10]:
            print(f"  ID: {article['id']}")
            print(f"  Title: {article['title']}")
            print(f"  Date: {article['publishedAt']}")
            print(f"  URL: {article['url']}")
            print()

    if future_dates:
        print("\n--- Articles in future (first 10) ---")
        for article in future_dates[:10]:
            print(f"  ID: {article['id']}")
            print(f"  Title: {article['title']}")
            print(f"  Date: {article['publishedAt']}")
            print(f"  URL: {article['url']}")
            print()

    # Save problematic IDs to file
    if before_2024 or future_dates:
        with open('news_date_issues.json', 'w', encoding='utf-8') as f:
            json.dump({
                'before_2024': before_2024,
                'future_dates': future_dates,
                'total_issues': len(before_2024) + len(future_dates)
            }, f, ensure_ascii=False, indent=2)
        print(f"\nProblematic news IDs saved to news_date_issues.json")
    else:
        print("\n✓ All news dates are within valid range (2024-01-01 to present)")
else:
    print("No dates found to analyze")
