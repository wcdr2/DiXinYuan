package cn.dixinyuan.news.support;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class JsonSupport {
  private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
  private final ObjectMapper objectMapper;

  public JsonSupport(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public JsonNode readFile(Path path) {
    try {
      return objectMapper.readTree(Files.readString(path));
    } catch (IOException error) {
      throw new IllegalStateException("Failed to read JSON file: " + path, error);
    }
  }

  public String stringify(JsonNode node) {
    return stringify((Object) node);
  }

  public String stringify(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (IOException error) {
      throw new IllegalStateException("Failed to serialize JSON.", error);
    }
  }

  public JsonNode parse(String json) {
    try {
      return objectMapper.readTree(json);
    } catch (IOException error) {
      throw new IllegalStateException("Failed to parse JSON.", error);
    }
  }

  public List<String> parseStringList(String json) {
    try {
      return objectMapper.readValue(json, STRING_LIST);
    } catch (IOException error) {
      throw new IllegalStateException("Failed to parse JSON array.", error);
    }
  }
}
