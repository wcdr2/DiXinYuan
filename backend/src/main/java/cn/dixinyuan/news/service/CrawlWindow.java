package cn.dixinyuan.news.service;

import java.time.LocalDateTime;

public record CrawlWindow(LocalDateTime startAt, LocalDateTime endAt, boolean firstRun) {}
