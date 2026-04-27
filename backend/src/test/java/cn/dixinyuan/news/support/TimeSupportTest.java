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
    LocalDateTime parsed = TimeSupport.parseToLocalDateTime("2026年4月27日 10:30");

    assertThat(parsed.getYear()).isEqualTo(2026);
    assertThat(parsed.getMonthValue()).isEqualTo(4);
    assertThat(parsed.getDayOfMonth()).isEqualTo(27);
    assertThat(parsed.getHour()).isEqualTo(10);
  }
}
