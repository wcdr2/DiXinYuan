package cn.dixinyuan.news.service;

import cn.dixinyuan.news.dto.SourceDto;
import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.mapper.SourceMapper;
import cn.dixinyuan.news.support.JsonSupport;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class SourceQueryService {
  private final SourceMapper sourceMapper;
  private final JsonSupport jsonSupport;

  public SourceQueryService(SourceMapper sourceMapper, JsonSupport jsonSupport) {
    this.sourceMapper = sourceMapper;
    this.jsonSupport = jsonSupport;
  }

  public List<SourceDto> list() {
    return sourceMapper
        .selectList(new LambdaQueryWrapper<SourceEntity>()
            .eq(SourceEntity::getActive, true)
            .isNotNull(SourceEntity::getWhitelistEntityId)
            .ne(SourceEntity::getWhitelistEntityId, "")
            .orderByAsc(SourceEntity::getId))
        .stream()
        .map(source -> new SourceDto(
            source.getSourceCode(),
            source.getName(),
            source.getType(),
            source.getSiteUrl(),
            source.getLanguage(),
            source.getTrustLevel(),
            source.getWhitelistEntityId(),
            source.getActive(),
            jsonSupport.parse(source.getCrawlRuleJson())))
        .toList();
  }
}
