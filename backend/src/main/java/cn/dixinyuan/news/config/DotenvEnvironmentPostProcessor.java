package cn.dixinyuan.news.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

public class DotenvEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {
  private static final String PROPERTY_SOURCE_NAME = "localDotenv";

  @Override
  public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
    Map<String, Object> values = new LinkedHashMap<>();
    for (Path path : candidatePaths()) {
      readDotenv(path, environment, values);
    }
    if (!values.isEmpty()) {
      environment.getPropertySources().addLast(new MapPropertySource(PROPERTY_SOURCE_NAME, values));
    }
  }

  @Override
  public int getOrder() {
    return Ordered.HIGHEST_PRECEDENCE + 20;
  }

  private static List<Path> candidatePaths() {
    Path cwd = Path.of("").toAbsolutePath().normalize();
    return List.of(
        cwd.resolve(".env.local"),
        cwd.resolve(".env"),
        cwd.resolve("..").resolve(".env.local").normalize(),
        cwd.resolve("..").resolve(".env").normalize());
  }

  private static void readDotenv(
      Path path,
      ConfigurableEnvironment environment,
      Map<String, Object> values) {
    if (!Files.isRegularFile(path)) {
      return;
    }

    try {
      for (String line : Files.readAllLines(path, StandardCharsets.UTF_8)) {
        String trimmed = line.trim();
        if (trimmed.isEmpty() || trimmed.startsWith("#") || !trimmed.contains("=")) {
          continue;
        }
        int separator = trimmed.indexOf('=');
        String key = trimmed.substring(0, separator).trim();
        String value = unquote(trimmed.substring(separator + 1).trim());
        if (!key.isEmpty() && environment.getProperty(key) == null && !values.containsKey(key)) {
          values.put(key, value);
        }
      }
    } catch (IOException ignored) {
      // Local env files are optional; startup should continue if they cannot be read.
    }
  }

  private static String unquote(String value) {
    if (value.length() >= 2) {
      char first = value.charAt(0);
      char last = value.charAt(value.length() - 1);
      if ((first == '"' && last == '"') || (first == '\'' && last == '\'')) {
        return value.substring(1, value.length() - 1);
      }
    }
    return value;
  }
}
