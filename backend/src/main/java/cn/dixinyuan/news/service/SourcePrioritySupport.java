package cn.dixinyuan.news.service;

import cn.dixinyuan.news.entity.SourceEntity;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

public final class SourcePrioritySupport {
  private static final List<String> PRIORITY_SOURCE_CODES = List.of(
      "gx-dnr", "gx-gov", "nn-dnr", "lz-dnr", "gl-dnr", "wz-dnr", "bh-dnr", "fcg-dnr",
      "qz-dnr", "gg-dnr", "yl-dnr", "bs-dnr", "hz-dnr", "hc-dnr", "lb-dnr", "cz-dnr",
      "gx-chxh", "wl-entity-001", "digital-guangxi", "glut-cgg", "gxu-zyhjcl",
      "cagis", "csgpc", "mnr", "ngcc");
  private static final List<String> GUANGXI_TERMS = List.of(
      "广西", "南宁", "柳州", "桂林", "梧州", "北海", "防城港", "钦州", "贵港", "玉林",
      "百色", "贺州", "河池", "来宾", "崇左", "guangxi");

  private SourcePrioritySupport() {}

  public static Comparator<SourceEntity> comparator() {
    return Comparator
        .comparingInt(SourcePrioritySupport::priorityRank)
        .thenComparingInt(SourcePrioritySupport::regionRank)
        .thenComparingInt(SourcePrioritySupport::languageRank)
        .thenComparing(source -> source.getSourceCode() == null ? "" : source.getSourceCode());
  }

  private static int priorityRank(SourceEntity source) {
    int index = PRIORITY_SOURCE_CODES.indexOf(source.getSourceCode());
    return index < 0 ? 1000 : index;
  }

  private static int regionRank(SourceEntity source) {
    String text = (safe(source.getSourceCode()) + " " + safe(source.getName()) + " " + safe(source.getSiteUrl()))
        .toLowerCase(Locale.ROOT);
    return GUANGXI_TERMS.stream().anyMatch(term -> text.contains(term.toLowerCase(Locale.ROOT))) ? 0 : 1;
  }

  private static int languageRank(SourceEntity source) {
    return "zh".equalsIgnoreCase(source.getLanguage()) ? 0 : 1;
  }

  private static String safe(String value) {
    return value == null ? "" : value;
  }
}
