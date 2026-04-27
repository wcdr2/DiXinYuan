package cn.dixinyuan.news.support;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class TimeSupport {
  private static final ZoneId SHANGHAI = ZoneId.of("Asia/Shanghai");

  private TimeSupport() {}

  public static LocalDateTime parseToLocalDateTime(String value) {
    if (value == null || value.isBlank()) {
      return LocalDateTime.now(SHANGHAI);
    }
    String normalized = value.trim();
    Matcher common = Pattern
        .compile("(20\\d{2})[-/.年](\\d{1,2})[-/.月](\\d{1,2})(?:[日\\sT]+(\\d{1,2})(?::(\\d{1,2}))?)?")
        .matcher(normalized);
    if (common.find()) {
      int year = Integer.parseInt(common.group(1));
      int month = Integer.parseInt(common.group(2));
      int day = Integer.parseInt(common.group(3));
      int hour = common.group(4) == null ? 0 : Integer.parseInt(common.group(4));
      int minute = common.group(5) == null ? 0 : Integer.parseInt(common.group(5));
      return LocalDateTime.of(year, month, day, hour, minute);
    }
    Matcher slash = Pattern.compile("(\\d{1,2})/(\\d{1,2})/(20\\d{2})").matcher(normalized);
    if (slash.find()) {
      return LocalDateTime.of(
          Integer.parseInt(slash.group(3)),
          Integer.parseInt(slash.group(2)),
          Integer.parseInt(slash.group(1)),
          0,
          0);
    }
    try {
      return OffsetDateTime.parse(normalized).atZoneSameInstant(SHANGHAI).toLocalDateTime();
    } catch (DateTimeParseException ignored) {
      try {
        return Instant.parse(normalized).atZone(SHANGHAI).toLocalDateTime();
      } catch (DateTimeParseException ignoredAgain) {
        return LocalDateTime.parse(normalized.replace("Z", ""));
      }
    }
  }

  public static String toIsoString(LocalDateTime value) {
    return value == null ? "" : value.atZone(SHANGHAI).toOffsetDateTime().toString();
  }
}
