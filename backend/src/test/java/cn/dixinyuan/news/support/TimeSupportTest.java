package cn.dixinyuan.news.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class TimeSupportTest {
  @Test
  void parsesOffsetDateTimeIntoLocalDateTime() {
    LocalDateTime parsed = TimeSupport.parseToLocalDateTime("2026-04-15T12:04:00+00:00");

    assertThat(parsed.getYear()).isEqualTo(2026);
    assertThat(parsed.getMonthValue()).isEqualTo(4);
    assertThat(parsed.getDayOfMonth()).isEqualTo(15);
  }

  @Test
  void parsesCommonChineseDateTime() {
    LocalDateTime parsed = TimeSupport.parseToLocalDateTime("2026\u5e744\u670827\u65e5 10:30");

    assertThat(parsed.getYear()).isEqualTo(2026);
    assertThat(parsed.getMonthValue()).isEqualTo(4);
    assertThat(parsed.getDayOfMonth()).isEqualTo(27);
    assertThat(parsed.getHour()).isEqualTo(10);
  }

  @Test
  void parsesEnglishMonthDates() {
    LocalDateTime parsed = TimeSupport.parseToLocalDateTime("April 29, 2026 09:45");

    assertThat(parsed.getYear()).isEqualTo(2026);
    assertThat(parsed.getMonthValue()).isEqualTo(4);
    assertThat(parsed.getDayOfMonth()).isEqualTo(29);
    assertThat(parsed.getHour()).isEqualTo(9);
    assertThat(parsed.getMinute()).isEqualTo(45);
  }

  @Test
  void parsesCompactDatesFromChineseGovernmentUrls() {
    LocalDateTime parsed = TimeSupport.parseToLocalDateTime("https://example.gov.cn/news/202604/t20260427_123.html");

    assertThat(parsed.getYear()).isEqualTo(2026);
    assertThat(parsed.getMonthValue()).isEqualTo(4);
    assertThat(parsed.getDayOfMonth()).isEqualTo(27);
  }
}
