package cn.dixinyuan.news.service;

import cn.dixinyuan.news.entity.NewsCandidateEntity;
import cn.dixinyuan.news.entity.NewsEntity;
import cn.dixinyuan.news.entity.NewsVersionEntity;
import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.mapper.NewsCandidateMapper;
import cn.dixinyuan.news.mapper.NewsMapper;
import cn.dixinyuan.news.mapper.NewsVersionMapper;
import cn.dixinyuan.news.support.JsonSupport;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;

@Service
public class NewsPersistenceService {
  private final NewsCandidateMapper newsCandidateMapper;
  private final NewsMapper newsMapper;
  private final NewsVersionMapper newsVersionMapper;
  private final JsonSupport jsonSupport;

  public NewsPersistenceService(
      NewsCandidateMapper newsCandidateMapper,
      NewsMapper newsMapper,
      NewsVersionMapper newsVersionMapper,
      JsonSupport jsonSupport) {
    this.newsCandidateMapper = newsCandidateMapper;
    this.newsMapper = newsMapper;
    this.newsVersionMapper = newsVersionMapper;
    this.jsonSupport = jsonSupport;
  }

  public void recordCandidate(
      Long crawlRunId,
      SourceEntity source,
      CrawledArticleCandidate raw,
      CleanedNewsArticle cleaned,
      ReviewResult review) {
    NewsCandidateEntity entity = new NewsCandidateEntity();
    entity.setCrawlRunId(crawlRunId);
    entity.setSourceId(source.getId());
    entity.setSourceCode(source.getSourceCode());
    entity.setOriginalUrl(cleaned.originalUrl());
    entity.setCanonicalUrl(cleaned.canonicalUrl());
    entity.setRawTitle(raw.title());
    entity.setRawSummary(raw.summary());
    entity.setCleanedTitle(cleaned.title());
    entity.setCleanedSummary(cleaned.summary());
    entity.setPublishedAt(cleaned.publishedAt());
    entity.setLanguage(cleaned.language());
    entity.setCategory(cleaned.category());
    entity.setKeywordsJson(jsonSupport.stringify(cleaned.keywords()));
    entity.setRegionTagsJson(jsonSupport.stringify(cleaned.regionTags()));
    entity.setIsGuangxiRelated(cleaned.guangxiRelated());
    entity.setReviewStatus(review.accepted() ? "accepted" : "rejected");
    entity.setRejectReason(review.reason());
    entity.setContentHash(cleaned.contentHash());
    entity.setRawPayloadJson(jsonSupport.stringify(cleaned.rawPayload()));
    newsCandidateMapper.insert(entity);
  }

  public PersistResult persistAccepted(Long crawlRunId, SourceEntity source, CleanedNewsArticle article) {
    NewsEntity news = newsMapper.selectOne(
        new LambdaQueryWrapper<NewsEntity>()
            .eq(NewsEntity::getSourceId, source.getId())
            .eq(NewsEntity::getCanonicalUrl, article.canonicalUrl()));
    LocalDateTime now = LocalDateTime.now();
    if (news == null) {
      news = new NewsEntity();
      news.setNewsCode(article.id());
      news.setSourceId(source.getId());
      news.setCanonicalUrl(article.canonicalUrl());
      news.setSlug(article.slug());
      news.setFirstSeenAt(now);
      news.setLastSeenAt(now);
      newsMapper.insert(news);
    } else {
      news.setLastSeenAt(now);
    }

    NewsVersionEntity existing = newsVersionMapper.selectOne(
        new LambdaQueryWrapper<NewsVersionEntity>()
            .eq(NewsVersionEntity::getNewsId, news.getId())
            .eq(NewsVersionEntity::getContentHash, article.contentHash()));
    if (existing != null) {
      newsMapper.updateById(news);
      return new PersistResult(false, true);
    }

    NewsVersionEntity version = new NewsVersionEntity();
    version.setNewsId(news.getId());
    version.setCrawlRunId(crawlRunId);
    version.setTitle(article.title());
    version.setSummary(article.summary());
    version.setCoverImage(article.coverImage());
    version.setSourceUrl(article.sourceUrl());
    version.setOriginalUrl(article.originalUrl());
    version.setPublishedAt(article.publishedAt());
    version.setLanguage(article.language());
    version.setCategory(article.category());
    version.setKeywordsJson(jsonSupport.stringify(article.keywords()));
    version.setRegionTagsJson(jsonSupport.stringify(article.regionTags()));
    version.setEntityIdsJson(jsonSupport.stringify(article.entityIds()));
    version.setIsGuangxiRelated(article.guangxiRelated());
    version.setContentHash(article.contentHash());
    newsVersionMapper.insert(version);

    news.setCurrentVersionId(version.getId());
    news.setSlug(article.slug());
    newsMapper.updateById(news);
    return new PersistResult(true, false);
  }
}
