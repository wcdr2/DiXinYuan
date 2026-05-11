package cn.dixinyuan.news.service;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

public final class NewsBodyTextSupport {
  private static final int MAX_BODY_TEXT_LENGTH = 20000;
  private static final int MAX_SUMMARY_LENGTH = 260;

  private NewsBodyTextSupport() {}

  public static String extractBodyText(Document doc) {
    if (doc == null) {
      return "";
    }
    String paragraphs = doc
        .select("article p, [class*=TRS_Editor] p, [class*=article] p, [class*=content] p, [id*=content] p, p")
        .stream()
        .map(Element::text)
        .map(NewsCleaningService::cleanText)
        .filter(text -> text.length() >= 20)
        .distinct()
        .reduce("", (left, right) -> left.isBlank() ? right : left + " " + right);
    String bodyText = paragraphs.isBlank() && doc.body() != null
        ? NewsCleaningService.cleanText(doc.body().text())
        : paragraphs;
    return truncate(bodyText);
  }

  public static String extractBodyTextFromHtml(String html) {
    if (html == null || html.isBlank()) {
      return "";
    }
    return extractBodyText(Jsoup.parse(html));
  }

  public static String chooseSummaryFromBodyText(String bodyText) {
    String text = NewsCleaningService.cleanText(bodyText);
    if (text.isBlank()) {
      return "";
    }
    for (String sentence : text.split("(?<=[。！？.!?])\\s*")) {
      String candidate = NewsCleaningService.cleanText(sentence);
      if (candidate.length() >= 12 && NewsCleaningService.hasRequiredSummaryTerm(candidate)) {
        return snippetAroundRequiredTerm(candidate);
      }
    }
    if (NewsCleaningService.hasRequiredSummaryTerm(text)) {
      return snippetAroundRequiredTerm(text);
    }
    return "";
  }

  public static boolean isSummaryFromBody(String summary, String bodyText) {
    String cleanSummary = normalizeForContainment(summary);
    String cleanBody = normalizeForContainment(bodyText);
    return !cleanSummary.isBlank() && !cleanBody.isBlank() && cleanBody.contains(cleanSummary);
  }

  public static String bodyTextFromPayload(Map<String, Object> payload) {
    if (payload == null || payload.isEmpty()) {
      return "";
    }
    Object bodyText = payload.get("bodyText");
    return bodyText == null ? "" : NewsCleaningService.cleanText(String.valueOf(bodyText));
  }

  public static List<String> requiredTermsIn(String text) {
    String value = text == null ? "" : text;
    return NewsCleaningService.REQUIRED_SUMMARY_TERMS.stream()
        .filter(value::contains)
        .toList();
  }

  private static String snippetAroundRequiredTerm(String text) {
    String value = NewsCleaningService.cleanText(text);
    if (value.length() <= MAX_SUMMARY_LENGTH) {
      return value;
    }
    int firstIndex = NewsCleaningService.REQUIRED_SUMMARY_TERMS.stream()
        .mapToInt(value::indexOf)
        .filter(index -> index >= 0)
        .min()
        .orElse(0);
    int start = Math.max(0, firstIndex - 90);
    return value.substring(start, Math.min(value.length(), start + MAX_SUMMARY_LENGTH)).trim();
  }

  private static String normalizeForContainment(String value) {
    return NewsCleaningService.cleanText(value)
        .replaceAll("\\s+", " ")
        .toLowerCase(Locale.ROOT);
  }

  private static String truncate(String value) {
    String text = NewsCleaningService.cleanText(value);
    return text.length() > MAX_BODY_TEXT_LENGTH ? text.substring(0, MAX_BODY_TEXT_LENGTH) : text;
  }
}
