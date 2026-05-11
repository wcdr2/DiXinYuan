package cn.dixinyuan.news.service;

public record ReviewResult(boolean accepted, String reason, String verifiedUrl) {
  public ReviewResult(boolean accepted, String reason) {
    this(accepted, reason, "");
  }
}
