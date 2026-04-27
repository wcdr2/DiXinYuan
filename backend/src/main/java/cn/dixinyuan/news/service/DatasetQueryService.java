package cn.dixinyuan.news.service;

import cn.dixinyuan.news.entity.DatasetSnapshotEntity;
import cn.dixinyuan.news.mapper.DatasetSnapshotMapper;
import cn.dixinyuan.news.support.JsonSupport;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

@Service
public class DatasetQueryService {
  private final DatasetSnapshotMapper datasetSnapshotMapper;
  private final JsonSupport jsonSupport;

  public DatasetQueryService(DatasetSnapshotMapper datasetSnapshotMapper, JsonSupport jsonSupport) {
    this.datasetSnapshotMapper = datasetSnapshotMapper;
    this.jsonSupport = jsonSupport;
  }

  public JsonNode latest(String type) {
    DatasetSnapshotEntity snapshot = datasetSnapshotMapper.selectList(
            new LambdaQueryWrapper<DatasetSnapshotEntity>()
                .eq(DatasetSnapshotEntity::getDatasetType, type)
                .eq(DatasetSnapshotEntity::getActive, true)
                .orderByDesc(DatasetSnapshotEntity::getCreatedAt)
                .last("LIMIT 1"))
        .stream()
        .findFirst()
        .orElse(null);
    return snapshot == null ? jsonSupport.parse("null") : jsonSupport.parse(snapshot.getPayloadJson());
  }
}
