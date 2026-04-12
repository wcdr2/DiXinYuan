import Link from "next/link";
import { withLocale } from "@/lib/site";
import type { Locale, MapDataset, MapRegion } from "@/lib/types";

interface MapPreviewProps {
  locale: Locale;
  dataset: MapDataset;
}

function getRegionLabel(locale: Locale, region: MapRegion) {
  return locale === "zh" ? region.name : region.nameEn;
}

export function MapPreview({ locale, dataset }: MapPreviewProps) {
  if (dataset.regions.length === 0) {
    return null;
  }

  const topRegions = [...dataset.regions]
    .sort(
      (left, right) =>
        Number(right.isPriorityRegion) - Number(left.isPriorityRegion) ||
        right.articleCount - left.articleCount ||
        left.name.localeCompare(right.name, "zh-CN"),
    )
    .slice(0, 5);

  return (
    <div className="map-preview">
      <div className="map-preview__visual map-preview__visual--live">
        <div className="map-preview__visual-copy">
          <span className="map-preview__badge">{locale === "zh" ? "百度真实地图" : "Baidu live map"}</span>
          <strong>{locale === "zh" ? "广西 14 市真实底图联动分析" : "Live Guangxi city-level thematic analysis"}</strong>
          <p>
            {locale === "zh"
              ? "以百度真实矢量底图承载城市热度、专题切换、新闻联动和图谱入口。"
              : "A live Baidu vector basemap linked to city heat, thematic modes, news results and graph entry points."}
          </p>
        </div>
        <div className="map-preview__stats">
          <div>
            <strong>{dataset.metrics.cityCount}</strong>
            <span>{locale === "zh" ? "设区市" : "Cities"}</span>
          </div>
          <div>
            <strong>{dataset.metrics.specialRegionCount}</strong>
            <span>{locale === "zh" ? "专题区域" : "Special region"}</span>
          </div>
        </div>
      </div>

      <div className="map-preview__list">
        {topRegions.map((region, index) => (
          <Link key={region.id} href={withLocale(locale, `/map?region=${region.id}`)} className="map-preview__list-item">
            <span>{`0${index + 1}`.slice(-2)}</span>
            <strong>{getRegionLabel(locale, region)}</strong>
            <small>{locale === "zh" ? `${region.articleCount} 篇` : `${region.articleCount} items`}</small>
          </Link>
        ))}
      </div>
    </div>
  );
}
