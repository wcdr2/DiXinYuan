package cn.dixinyuan.news.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class UrlVerificationServiceTest {
  private HttpServer server;
  private String baseUrl;
  private final UrlVerificationService service = new UrlVerificationService();

  @BeforeEach
  void startServer() throws Exception {
    server = HttpServer.create(new InetSocketAddress(0), 0);
    baseUrl = "http://localhost:" + server.getAddress().getPort();
    server.start();
  }

  @AfterEach
  void stopServer() {
    server.stop(0);
  }

  @Test
  void acceptsReachablePages() {
    server.createContext("/article", exchange -> {
      byte[] bytes = "ok".getBytes(java.nio.charset.StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(200, bytes.length);
      exchange.getResponseBody().write(bytes);
      exchange.close();
    });

    UrlVerificationResult result = service.verify(baseUrl + "/article");

    assertThat(result.accessible()).isTrue();
    assertThat(result.statusCode()).isEqualTo(200);
  }

  @Test
  void rejectsMissingPages() {
    server.createContext("/missing", exchange -> {
      exchange.sendResponseHeaders(404, -1);
      exchange.close();
    });

    UrlVerificationResult result = service.verify(baseUrl + "/missing");

    assertThat(result.accessible()).isFalse();
    assertThat(result.error()).isEqualTo("http_404");
  }
}
