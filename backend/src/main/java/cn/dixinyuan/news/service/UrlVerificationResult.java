package cn.dixinyuan.news.service;

public record UrlVerificationResult(boolean accessible, String finalUrl, int statusCode, String error, String bodyText) {
  public static UrlVerificationResult accessible(String finalUrl, int statusCode) {
    return accessible(finalUrl, statusCode, "");
  }

  public static UrlVerificationResult accessible(String finalUrl, int statusCode, String bodyText) {
    return new UrlVerificationResult(true, finalUrl, statusCode, "", bodyText == null ? "" : bodyText);
  }

  public static UrlVerificationResult inaccessible(String finalUrl, int statusCode, String error) {
    return new UrlVerificationResult(false, finalUrl == null ? "" : finalUrl, statusCode, error == null ? "" : error, "");
  }
}
