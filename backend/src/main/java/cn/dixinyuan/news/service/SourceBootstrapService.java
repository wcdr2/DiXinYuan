package cn.dixinyuan.news.service;

import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.mapper.SourceMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class SourceBootstrapService {
  private final SourceMapper sourceMapper;
  private final SourceCatalogService sourceCatalogService;

  public SourceBootstrapService(SourceMapper sourceMapper, SourceCatalogService sourceCatalogService) {
    this.sourceMapper = sourceMapper;
    this.sourceCatalogService = sourceCatalogService;
  }

  public List<SourceEntity> ensureSources() {
    sourceCatalogService.syncConfiguredSources();
    return sourceMapper.selectList(
            new LambdaQueryWrapper<SourceEntity>().eq(SourceEntity::getActive, true))
        .stream()
        .sorted(SourcePrioritySupport.comparator())
        .toList();
  }
}
