#!/usr/bin/env python3
import requests
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# Fetch news from API
print("Fetching news from API...")
response = requests.get('http://localhost:8080/api/v1/news?limit=2000')
news_list = response.json()

print(f"Total news fetched: {len(news_list)}")

# Verify URLs
def verify_url(article):
    url = article['originalUrl']
    article_id = article['id']
    title = article['title'][:50]

    try:
        response = requests.head(url, timeout=10, allow_redirects=True)
        accessible = response.status_code < 400
        return {
            'id': article_id,
            'title': title,
            'url': url,
            'accessible': accessible,
            'status_code': response.status_code,
            'final_url': response.url
        }
    except requests.exceptions.Timeout:
        return {
            'id': article_id,
            'title': title,
            'url': url,
            'accessible': False,
            'status_code': 'TIMEOUT',
            'error': 'Request timeout'
        }
    except Exception as e:
        return {
            'id': article_id,
            'title': title,
            'url': url,
            'accessible': False,
            'status_code': 'ERROR',
            'error': str(e)
        }

# Sample verification (first 100 articles to avoid overwhelming servers)
sample_size = min(100, len(news_list))
print(f"\nVerifying URL accessibility for {sample_size} articles (sample)...")

results = []
inaccessible = []

with ThreadPoolExecutor(max_workers=10) as executor:
    futures = {executor.submit(verify_url, article): article for article in news_list[:sample_size]}

    for i, future in enumerate(as_completed(futures), 1):
        result = future.result()
        results.append(result)

        if not result['accessible']:
            inaccessible.append(result)

        if i % 10 == 0:
            print(f"Progress: {i}/{sample_size} verified")

# Statistics
accessible_count = len([r for r in results if r['accessible']])
inaccessible_count = len(inaccessible)

print(f"\n=== URL Accessibility Report ===")
print(f"Total verified: {len(results)}")
print(f"Accessible: {accessible_count} ({accessible_count*100//len(results)}%)")
print(f"Inaccessible: {inaccessible_count} ({inaccessible_count*100//len(results)}%)")

if inaccessible:
    print(f"\n--- Inaccessible URLs (first 10) ---")
    for article in inaccessible[:10]:
        print(f"  ID: {article['id']}")
        print(f"  Title: {article['title']}")
        print(f"  URL: {article['url']}")
        print(f"  Status: {article.get('status_code', 'N/A')}")
        print(f"  Error: {article.get('error', 'N/A')}")
        print()

# Save results
with open('url_verification_report.json', 'w', encoding='utf-8') as f:
    json.dump({
        'summary': {
            'total_verified': len(results),
            'accessible': accessible_count,
            'inaccessible': inaccessible_count,
            'sample_size': sample_size,
            'total_news': len(news_list)
        },
        'inaccessible_urls': inaccessible,
        'all_results': results
    }, f, ensure_ascii=False, indent=2)

print(f"\nFull report saved to url_verification_report.json")
print(f"\nNote: This is a sample of {sample_size} articles out of {len(news_list)} total.")
print("To verify all URLs, increase sample_size in the script.")
