package cn.dixinyuan.news.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import cn.dixinyuan.news.entity.CrawlRunEntity;
import cn.dixinyuan.news.mapper.CrawlRunMapper;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class CrawlWindowServiceTest {
  @Test
  void firstRunStartsAtConfiguredMinimum() {
    CrawlRunMapper mapper = mock(CrawlRunMapper.class);
    when(mapper.selectList(any(Wrapper.class))).thenReturn(List.of());
    CrawlWindowService service = new CrawlWindowService(mapper, "2024-01-01T00:00:00", 10);

    CrawlWindow window = service.resolve(null, LocalDateTime.of(2026, 4, 29, 12, 0));

    assertThat(window.startAt()).isEqualTo(LocalDateTime.of(2024, 1, 1, 0, 0));
    assertThat(window.firstRun()).isTrue();
  }

  @Test
  void laterRunsOverlapLatestSuccessfulWindowEnd() {
    CrawlRunEntity latest = new CrawlRunEntity();
    latest.setWindowEndAt(LocalDateTime.of(2026, 4, 29, 11, 30));
    CrawlRunMapper mapper = mock(CrawlRunMapper.class);
    when(mapper.selectList(any(Wrapper.class))).thenReturn(List.of(latest));
    CrawlWindowService service = new CrawlWindowService(mapper, "2024-01-01T00:00:00", 10);

    CrawlWindow window = service.resolve(null, LocalDateTime.of(2026, 4, 29, 12, 0));

    assertThat(window.startAt()).isEqualTo(LocalDateTime.of(2026, 4, 29, 11, 20));
    assertThat(window.firstRun()).isFalse();
  }

  @Test
  void futureLatestWindowEndDoesNotCreateReversedWindow() {
    CrawlRunEntity latest = new CrawlRunEntity();
    latest.setWindowEndAt(LocalDateTime.of(2026, 4, 29, 12, 30));
    CrawlRunMapper mapper = mock(CrawlRunMapper.class);
    when(mapper.selectList(any(Wrapper.class))).thenReturn(List.of(latest));
    CrawlWindowService service = new CrawlWindowService(mapper, "2024-01-01T00:00:00", 10);

    CrawlWindow window = service.resolve(null, LocalDateTime.of(2026, 4, 29, 12, 0));

    assertThat(window.startAt()).isEqualTo(LocalDateTime.of(2026, 4, 29, 11, 50));
    assertThat(window.endAt()).isEqualTo(LocalDateTime.of(2026, 4, 29, 12, 0));
  }

  @Test
  void requestedStartAfterEndIsClampedToOverlapWindow() {
    CrawlRunMapper mapper = mock(CrawlRunMapper.class);
    when(mapper.selectList(any(Wrapper.class))).thenReturn(List.of());
    CrawlWindowService service = new CrawlWindowService(mapper, "2024-01-01T00:00:00", 10);

    CrawlWindow window = service.resolve(
        LocalDateTime.of(2026, 4, 29, 12, 30),
        LocalDateTime.of(2026, 4, 29, 12, 0));

    assertThat(window.startAt()).isEqualTo(LocalDateTime.of(2026, 4, 29, 11, 50));
    assertThat(window.endAt()).isEqualTo(LocalDateTime.of(2026, 4, 29, 12, 0));
  }
}
