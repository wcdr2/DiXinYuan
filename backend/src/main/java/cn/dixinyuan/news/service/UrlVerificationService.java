package cn.dixinyuan.news.service;

import java.io.IOException;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.springframework.stereotype.Service;

@Service
public class UrlVerificationService {
  private static final String USER_AGENT =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
          + "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";
  private static final int MAX_RETRIES = 3;
  private static final int INITIAL_BACKOFF_MS = 1000;

  public UrlVerificationResult verify(String url) {
    String value = NewsCleaningService.cleanText(url);
    if (value.isBlank()) {
      return UrlVerificationResult.inaccessible("", 0, "blank_url");
    }

    int attempt = 0;
    IOException lastException = null;

    while (attempt < MAX_RETRIES) {
      try {
        Connection.Response response = Jsoup.connect(value)
            .userAgent(USER_AGENT)
            .method(Connection.Method.GET)
            .timeout(12000)
            .followRedirects(true)
            .ignoreHttpErrors(true)
            .ignoreContentType(true)
            .maxBodySize(0)
            .execute();
        int status = response.statusCode();
        String finalUrl = response.url() == null ? value : response.url().toString();
        return status >= 200 && status < 400
            ? UrlVerificationResult.accessible(finalUrl, status, NewsBodyTextSupport.extractBodyTextFromHtml(response.body()))
            : UrlVerificationResult.inaccessible(finalUrl, status, "http_" + status);
      } catch (IOException error) {
        lastException = error;
        attempt++;
        if (attempt < MAX_RETRIES) {
          try {
            Thread.sleep(INITIAL_BACKOFF_MS * (long) Math.pow(2, attempt - 1));
          } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            return UrlVerificationResult.inaccessible(value, 0, "interrupted");
          }
        }
      } catch (RuntimeException error) {
        return UrlVerificationResult.inaccessible(value, 0, error.getClass().getSimpleName());
      }
    }

    return UrlVerificationResult.inaccessible(
        value, 0, lastException != null ? lastException.getClass().getSimpleName() : "unknown_error");
  }
}
