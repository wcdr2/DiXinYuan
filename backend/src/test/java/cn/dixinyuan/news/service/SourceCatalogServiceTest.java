package cn.dixinyuan.news.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.mapper.SourceMapper;
import cn.dixinyuan.news.support.JsonSupport;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

class SourceCatalogServiceTest {
  @TempDir
  Path tempDir;

  @Test
  void upsertUpdatesExistingSourcesAndInsertsNewOnesWithoutDeleting() throws Exception {
    Path configDir = tempDir.resolve("config");
    Files.createDirectories(configDir);
    Files.writeString(configDir.resolve("entity-whitelist.json"), """
        {
          "entities": [
            {"id":"entity-existing","name":"Existing Source","aliases":[],"evidenceUrl":"https://existing.test"},
            {"id":"entity-new","name":"New Source","aliases":[],"evidenceUrl":"https://new.test"}
          ]
        }
        """);
    Path sourceFile = tempDir.resolve("sources.json");
    Files.writeString(sourceFile, """
        [
          {"id":"existing","name":"Existing Source","type":"government","siteUrl":"https://existing.test","language":"zh","trustLevel":"high","whitelistEntityId":"entity-existing","isActive":true,"crawlRule":{"itemLimit":30}},
          {"id":"new-source","name":"New Source","type":"research","siteUrl":"https://new.test","language":"en","trustLevel":"medium","whitelistEntityId":"entity-new","isActive":false,"crawlRule":{"parser":"rss"}}
        ]
        """);

    SourceMapper mapper = mock(SourceMapper.class);
    SourceEntity existing = new SourceEntity();
    existing.setId(7L);
    existing.setSourceCode("existing");
    when(mapper.selectOne(any(Wrapper.class))).thenReturn(existing, null);
    when(mapper.updateById(any(SourceEntity.class))).thenReturn(1);
    when(mapper.insert(any(SourceEntity.class))).thenAnswer(invocation -> {
      SourceEntity inserted = invocation.getArgument(0);
      inserted.setId(8L);
      return 1;
    });

    SourceCatalogService service = new SourceCatalogService(
        tempDir.toString(),
        new JsonSupport(new ObjectMapper()),
        mapper,
        new TransactionTemplate(transactionManager()),
        new EntityWhitelistService(tempDir.toString(), new JsonSupport(new ObjectMapper())));

    List<SourceEntity> sources = service.upsertFromFile(sourceFile);

    assertThat(sources).hasSize(2);
    assertThat(sources.get(0).getName()).isEqualTo("Existing Source");
    assertThat(sources.get(0).getWhitelistEntityId()).isEqualTo("entity-existing");
    assertThat(sources.get(1).getActive()).isFalse();
    verify(mapper).updateById(any(SourceEntity.class));
    verify(mapper).insert(any(SourceEntity.class));
    verify(mapper, never()).delete(any());
  }

  @Test
  void requiresWhitelistBindingWithoutAppendingAllEntityTermsToCrawlRules() throws Exception {
    Path configDir = tempDir.resolve("config");
    Files.createDirectories(configDir);
    Files.writeString(configDir.resolve("entity-whitelist.json"), """
        {
          "entities": [
            {"id":"entity-existing","name":"Existing Source","aliases":[],"evidenceUrl":"https://existing.test"},
            {"id":"entity-gx","name":"广西测绘学会","aliases":["GX Surveying Society"],"evidenceUrl":"https://gx.example.test"}
          ]
        }
        """);
    Path sourceFile = tempDir.resolve("sources.json");
    Files.writeString(sourceFile, """
        [
          {"id":"existing","name":"Existing Source","type":"government","siteUrl":"https://existing.test","language":"zh","trustLevel":"high","isActive":true,"crawlRule":{"whitelist":["遥感"],"requireKeywordMatch":false}}
        ]
        """);

    SourceMapper mapper = mock(SourceMapper.class);
    when(mapper.selectOne(any(Wrapper.class))).thenReturn(null);
    when(mapper.insert(any(SourceEntity.class))).thenAnswer(invocation -> {
      SourceEntity inserted = invocation.getArgument(0);
      inserted.setId(8L);
      return 1;
    });

    SourceCatalogService service = new SourceCatalogService(
        tempDir.toString(),
        new JsonSupport(new ObjectMapper()),
        mapper,
        new TransactionTemplate(transactionManager()),
        new EntityWhitelistService(tempDir.toString(), new JsonSupport(new ObjectMapper())));

    List<SourceEntity> sources = service.upsertFromFile(sourceFile);

    assertThat(sources.getFirst().getCrawlRuleJson())
        .contains("遥感")
        .contains("\"requireKeywordMatch\":true");
    assertThat(sources.getFirst().getCrawlRuleJson())
        .doesNotContain("广西测绘学会")
        .doesNotContain("GX Surveying Society");
    assertThat(sources.getFirst().getWhitelistEntityId()).isEqualTo("entity-existing");
  }

  @Test
  void disablesRetiredMediaAndPortalSourcesEvenWhenWhitelisted() throws Exception {
    Path configDir = tempDir.resolve("config");
    Files.createDirectories(configDir);
    Files.writeString(configDir.resolve("entity-whitelist.json"), """
        {
          "entities": [
            {"id":"source-news-cn","name":"新华网","aliases":["news.cn"],"evidenceUrl":"https://www.news.cn"}
          ]
        }
        """);
    Path sourceFile = tempDir.resolve("sources.json");
    Files.writeString(sourceFile, """
        [
          {"id":"news-cn","name":"新华网","type":"media","siteUrl":"https://www.news.cn","language":"zh","trustLevel":"high","whitelistEntityId":"source-news-cn","isActive":true,"crawlRule":{"parser":"xinhua-search"}}
        ]
        """);

    SourceMapper mapper = mock(SourceMapper.class);
    when(mapper.selectOne(any(Wrapper.class))).thenReturn(null);
    when(mapper.insert(any(SourceEntity.class))).thenAnswer(invocation -> {
      SourceEntity inserted = invocation.getArgument(0);
      inserted.setId(9L);
      return 1;
    });

    SourceCatalogService service = new SourceCatalogService(
        tempDir.toString(),
        new JsonSupport(new ObjectMapper()),
        mapper,
        new TransactionTemplate(transactionManager()),
        new EntityWhitelistService(tempDir.toString(), new JsonSupport(new ObjectMapper())));

    List<SourceEntity> sources = service.upsertFromFile(sourceFile);

    assertThat(sources.getFirst().getWhitelistEntityId()).isEqualTo("source-news-cn");
    assertThat(sources.getFirst().getActive()).isFalse();
  }

  private static PlatformTransactionManager transactionManager() {
    return new PlatformTransactionManager() {
      @Override
      public TransactionStatus getTransaction(TransactionDefinition definition) {
        return new SimpleTransactionStatus();
      }

      @Override
      public void commit(TransactionStatus status) {}

      @Override
      public void rollback(TransactionStatus status) {}
    };
  }
}
