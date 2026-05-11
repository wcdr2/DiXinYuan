package cn.dixinyuan.news.support;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.time.temporal.ChronoField;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class TimeSupport {
  private static final ZoneId SHANGHAI = ZoneId.of("Asia/Shanghai");
  private static final List<DateTimeFormatter> ENGLISH_DATE_TIME_FORMATTERS = List.of(
      englishFormatter("MMMM d, uuuu HH:mm"),
      englishFormatter("MMMM d, uuuu h:mm a"),
      englishFormatter("MMM d, uuuu HH:mm"),
      englishFormatter("MMM d, uuuu h:mm a"),
      englishFormatter("d MMMM uuuu HH:mm"),
      englishFormatter("d MMMM uuuu h:mm a"),
      englishFormatter("d MMM uuuu HH:mm"),
      englishFormatter("d MMM uuuu h:mm a"));
  private static final List<DateTimeFormatter> ENGLISH_DATE_FORMATTERS = List.of(
      englishFormatter("MMMM d, uuuu"),
      englishFormatter("MMM d, uuuu"),
      englishFormatter("d MMMM uuuu"),
      englishFormatter("d MMM uuuu"));

  private TimeSupport() {}

  public static LocalDateTime parseToLocalDateTime(String value) {
    if (value == null || value.isBlank()) {
      return LocalDateTime.now(SHANGHAI);
    }
    String normalized = value.trim();
    Matcher stableCommon = Pattern
        .compile("(20\\d{2})[-/.\\u5e74](\\d{1,2})[-/.\\u6708](\\d{1,2})(?:[\\u65e5\\sT]+(\\d{1,2})(?::(\\d{1,2}))?)?")
        .matcher(normalized);
    if (stableCommon.find()) {
      int year = Integer.parseInt(stableCommon.group(1));
      int month = Integer.parseInt(stableCommon.group(2));
      int day = Integer.parseInt(stableCommon.group(3));
      int hour = stableCommon.group(4) == null ? 0 : Integer.parseInt(stableCommon.group(4));
      int minute = stableCommon.group(5) == null ? 0 : Integer.parseInt(stableCommon.group(5));
      return LocalDateTime.of(year, month, day, hour, minute);
    }
    Matcher compactDate = Pattern.compile("(?<!\\d)(20\\d{2})(\\d{2})(\\d{2})(?!\\d)").matcher(normalized);
    if (compactDate.find()) {
      return LocalDateTime.of(
          Integer.parseInt(compactDate.group(1)),
          Integer.parseInt(compactDate.group(2)),
          Integer.parseInt(compactDate.group(3)),
          0,
          0);
    }
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
    String normalizedEnglish = normalized
        .replaceAll("(?i)\\b(at|updated|published|posted)\\b", " ")
        .replaceAll("\\s+", " ")
        .trim();
    for (DateTimeFormatter formatter : ENGLISH_DATE_TIME_FORMATTERS) {
      try {
        return LocalDateTime.parse(normalizedEnglish, formatter);
      } catch (DateTimeParseException ignored) {
        // Try the next formatter.
      }
    }
    for (DateTimeFormatter formatter : ENGLISH_DATE_FORMATTERS) {
      try {
        return LocalDate.parse(normalizedEnglish, formatter).atStartOfDay();
      } catch (DateTimeParseException ignored) {
        // Try the next formatter.
      }
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

  private static DateTimeFormatter englishFormatter(String pattern) {
    return new DateTimeFormatterBuilder()
        .parseCaseInsensitive()
        .appendPattern(pattern)
        .parseDefaulting(ChronoField.HOUR_OF_DAY, 0)
        .parseDefaulting(ChronoField.MINUTE_OF_HOUR, 0)
        .toFormatter(Locale.ENGLISH)
        .withResolverStyle(ResolverStyle.SMART);
  }
}
