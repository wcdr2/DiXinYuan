package cn.dixinyuan.news.service;

public record PersistResult(boolean insertedVersion, boolean duplicateVersion) {}
