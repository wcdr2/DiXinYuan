package cn.dixinyuan.news.mapper;

import cn.dixinyuan.news.dto.ArticleRowDto;
import cn.dixinyuan.news.entity.NewsEntity;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface NewsMapper extends BaseMapper<NewsEntity> {
  @Select("""
      <script>
      SELECT
        n.news_code AS id,
        n.slug AS slug,
        v.title AS title,
        v.summary AS summary,
        v.cover_image AS coverImage,
        s.name AS sourceName,
        v.source_url AS sourceUrl,
        v.original_url AS originalUrl,
        v.published_at AS publishedAt,
        v.language AS language,
        v.category AS category,
        v.keywords_json AS keywordsJson,
        v.region_tags_json AS regionTagsJson,
        v.is_guangxi_related AS isGuangxiRelated,
        v.entity_ids_json AS entityIdsJson
      FROM news n
      JOIN news_versions v ON n.current_version_id = v.id
      JOIN sources s ON n.source_id = s.id
      WHERE v.published_at &gt;= #{minPublishedAt}
        AND v.published_at &lt;= #{maxPublishedAt}
        AND s.active = 1
        AND s.whitelist_entity_id IS NOT NULL
        AND s.whitelist_entity_id &lt;&gt; ''
        AND v.url_status = 'accessible'
        AND (
          v.summary LIKE '%地球信息科学%'
          OR v.summary LIKE '%遥感%'
          OR v.summary LIKE '%测绘%'
          OR v.summary LIKE '%GIS%'
          OR v.summary LIKE '%北斗%'
          OR v.summary LIKE '%空天信息%'
          OR v.summary LIKE '%实景三维%'
          OR v.summary LIKE '%时空智能%'
          OR v.summary LIKE '%自然资源数字化%'
          OR v.summary LIKE '%低空遥感%'
          OR v.summary LIKE '%数字孪生%'
          OR v.summary LIKE '%智慧城市%'
        )
      <if test="category != null and category != '' and category != 'all'">
        AND v.category = #{category}
      </if>
      <if test="source != null and source != '' and source != 'all'">
        AND s.name = #{source}
      </if>
      <if test="region != null and region != '' and region != 'all'">
        AND JSON_CONTAINS(v.region_tags_json, JSON_QUOTE(#{region}))
      </if>
      <if test="guangxi != null and guangxi == 'only'">
        AND v.is_guangxi_related = 1
      </if>
      <if test="query != null and query != ''">
        AND (
          LOWER(v.title) LIKE CONCAT('%', #{query}, '%')
          OR LOWER(v.summary) LIKE CONCAT('%', #{query}, '%')
          OR LOWER(s.name) LIKE CONCAT('%', #{query}, '%')
          OR LOWER(CAST(v.keywords_json AS CHAR)) LIKE CONCAT('%', #{query}, '%')
          OR LOWER(CAST(v.region_tags_json AS CHAR)) LIKE CONCAT('%', #{query}, '%')
        )
      </if>
      ORDER BY v.published_at ${sortDirection}, n.id ${sortDirection}
      LIMIT #{limit} OFFSET #{offset}
      </script>
      """)
  List<ArticleRowDto> selectCurrentArticleRows(
      @Param("query") String query,
      @Param("category") String category,
      @Param("source") String source,
      @Param("region") String region,
      @Param("guangxi") String guangxi,
      @Param("sortDirection") String sortDirection,
      @Param("limit") int limit,
      @Param("offset") int offset,
      @Param("minPublishedAt") LocalDateTime minPublishedAt,
      @Param("maxPublishedAt") LocalDateTime maxPublishedAt);

  @Select("""
      <script>
      SELECT COUNT(*)
      FROM news n
      JOIN news_versions v ON n.current_version_id = v.id
      JOIN sources s ON n.source_id = s.id
      WHERE v.published_at &gt;= #{minPublishedAt}
        AND v.published_at &lt;= #{maxPublishedAt}
        AND s.active = 1
        AND s.whitelist_entity_id IS NOT NULL
        AND s.whitelist_entity_id &lt;&gt; ''
        AND v.url_status = 'accessible'
        AND (
          v.summary LIKE '%地球信息科学%'
          OR v.summary LIKE '%遥感%'
          OR v.summary LIKE '%测绘%'
          OR v.summary LIKE '%GIS%'
          OR v.summary LIKE '%北斗%'
          OR v.summary LIKE '%空天信息%'
          OR v.summary LIKE '%实景三维%'
          OR v.summary LIKE '%时空智能%'
          OR v.summary LIKE '%自然资源数字化%'
          OR v.summary LIKE '%低空遥感%'
          OR v.summary LIKE '%数字孪生%'
          OR v.summary LIKE '%智慧城市%'
        )
      <if test="category != null and category != '' and category != 'all'">
        AND v.category = #{category}
      </if>
      <if test="source != null and source != '' and source != 'all'">
        AND s.name = #{source}
      </if>
      <if test="region != null and region != '' and region != 'all'">
        AND JSON_CONTAINS(v.region_tags_json, JSON_QUOTE(#{region}))
      </if>
      <if test="guangxi != null and guangxi == 'only'">
        AND v.is_guangxi_related = 1
      </if>
      <if test="query != null and query != ''">
        AND (
          LOWER(v.title) LIKE CONCAT('%', #{query}, '%')
          OR LOWER(v.summary) LIKE CONCAT('%', #{query}, '%')
          OR LOWER(s.name) LIKE CONCAT('%', #{query}, '%')
          OR LOWER(CAST(v.keywords_json AS CHAR)) LIKE CONCAT('%', #{query}, '%')
          OR LOWER(CAST(v.region_tags_json AS CHAR)) LIKE CONCAT('%', #{query}, '%')
        )
      </if>
      </script>
      """)
  long countCurrentArticleRows(
      @Param("query") String query,
      @Param("category") String category,
      @Param("source") String source,
      @Param("region") String region,
      @Param("guangxi") String guangxi,
      @Param("minPublishedAt") LocalDateTime minPublishedAt,
      @Param("maxPublishedAt") LocalDateTime maxPublishedAt);

  @Select("""
      <script>
      SELECT
        n.news_code AS id,
        n.slug AS slug,
        v.title AS title,
        v.summary AS summary,
        v.cover_image AS coverImage,
        s.name AS sourceName,
        v.source_url AS sourceUrl,
        v.original_url AS originalUrl,
        v.published_at AS publishedAt,
        v.language AS language,
        v.category AS category,
        v.keywords_json AS keywordsJson,
        v.region_tags_json AS regionTagsJson,
        v.is_guangxi_related AS isGuangxiRelated,
        v.entity_ids_json AS entityIdsJson
      FROM news n
      JOIN news_versions v ON n.current_version_id = v.id
      JOIN sources s ON n.source_id = s.id
      WHERE v.published_at &gt;= #{minPublishedAt}
        AND v.published_at &lt;= #{maxPublishedAt}
        AND s.active = 1
        AND s.whitelist_entity_id IS NOT NULL
        AND s.whitelist_entity_id &lt;&gt; ''
        AND v.url_status = 'accessible'
        AND (
          v.summary LIKE '%地球信息科学%'
          OR v.summary LIKE '%遥感%'
          OR v.summary LIKE '%测绘%'
          OR v.summary LIKE '%GIS%'
          OR v.summary LIKE '%北斗%'
          OR v.summary LIKE '%空天信息%'
          OR v.summary LIKE '%实景三维%'
          OR v.summary LIKE '%时空智能%'
          OR v.summary LIKE '%自然资源数字化%'
          OR v.summary LIKE '%低空遥感%'
          OR v.summary LIKE '%数字孪生%'
          OR v.summary LIKE '%智慧城市%'
        )
        AND (
          n.news_code = #{value}
          OR n.slug = #{value}
          OR CONCAT(n.news_code, '-', n.slug) = #{value}
          OR #{value} LIKE CONCAT(n.news_code, '-%')
        )
      LIMIT 1
      </script>
      """)
  ArticleRowDto selectCurrentArticleRowBySlugOrId(
      @Param("value") String value,
      @Param("minPublishedAt") LocalDateTime minPublishedAt,
      @Param("maxPublishedAt") LocalDateTime maxPublishedAt);
}
