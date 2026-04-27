package cn.dixinyuan.news.support;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public final class HashSupport {
  private HashSupport() {}

  public static String sha256(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder result = new StringBuilder(bytes.length * 2);
      for (byte current : bytes) {
        result.append(String.format("%02x", current));
      }
      return result.toString();
    } catch (NoSuchAlgorithmException error) {
      throw new IllegalStateException("SHA-256 is not available.", error);
    }
  }
}
