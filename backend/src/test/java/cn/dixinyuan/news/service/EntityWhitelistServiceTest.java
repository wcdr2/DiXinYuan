package cn.dixinyuan.news.service;

import static org.assertj.core.api.Assertions.assertThat;

import cn.dixinyuan.news.support.JsonSupport;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class EntityWhitelistServiceTest {
  @TempDir
  Path tempDir;

  @Test
  void readsNamesAndAliasesWithNormalizationDeduplication() throws Exception {
    Path configDir = tempDir.resolve("config");
    Files.createDirectories(configDir);
    Files.writeString(configDir.resolve("entity-whitelist.json"), """
        {
          "entities": [
            {"id":"entity-001","name":"广西测绘学会","aliases":["GX Surveying Society"],"evidenceUrl":"https://gx.example.test"},
            {"id":"entity-002","name":"广西 测绘学会","aliases":["GX Surveying Society"],"evidenceUrl":"https://other.example.test"}
          ]
        }
        """);

    EntityWhitelistService service = new EntityWhitelistService(tempDir.toString(), new JsonSupport(new ObjectMapper()));

    assertThat(service.terms()).containsExactly("广西测绘学会", "GX Surveying Society");
  }

  @Test
  void resolvesEntityIdsFromConfiguredIdNameAndEvidenceHost() throws Exception {
    Path configDir = tempDir.resolve("config");
    Files.createDirectories(configDir);
    Files.writeString(configDir.resolve("entity-whitelist.json"), """
        {
          "entities": [
            {"id":"entity-001","name":"广西测绘学会","aliases":["GX Surveying Society"],"evidenceUrl":"https://gx.example.test/about"}
          ]
        }
        """);

    EntityWhitelistService service = new EntityWhitelistService(tempDir.toString(), new JsonSupport(new ObjectMapper()));

    assertThat(service.hasEntityId("entity-001")).isTrue();
    assertThat(service.resolveEntityId("", "source", "广西测绘学会", "https://unused.example.test")).contains("entity-001");
    assertThat(service.resolveEntityId("", "source", "Different", "https://gx.example.test/news")).contains("entity-001");
  }
}
