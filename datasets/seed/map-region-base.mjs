import { guangxiCityProfiles } from "./guangxi-regions-base.mjs";

const geometryAssets = [
  {
    id: "baise",
    path: "M56 250 L148 180 L232 198 L218 286 L114 350 L52 308 Z",
    labelX: 138,
    labelY: 258,
  },
  {
    id: "hechi",
    path: "M158 116 L290 78 L338 154 L244 208 L160 176 L132 138 Z",
    labelX: 226,
    labelY: 144,
  },
  {
    id: "liuzhou",
    path: "M300 96 L414 92 L452 176 L364 234 L274 198 L252 142 Z",
    labelX: 350,
    labelY: 148,
  },
  {
    id: "guilin",
    path: "M430 88 L542 100 L576 180 L488 222 L402 184 L388 126 Z",
    labelX: 482,
    labelY: 146,
  },
  {
    id: "hezhou",
    path: "M552 114 L666 128 L684 226 L594 246 L560 184 Z",
    labelX: 618,
    labelY: 168,
  },
  {
    id: "laibin",
    path: "M236 218 L350 228 L390 320 L304 362 L218 306 L206 246 Z",
    labelX: 300,
    labelY: 276,
  },
  {
    id: "guigang",
    path: "M390 226 L504 236 L520 324 L412 362 L366 302 Z",
    labelX: 446,
    labelY: 286,
  },
  {
    id: "wuzhou",
    path: "M518 252 L650 260 L690 360 L582 418 L522 322 Z",
    labelX: 610,
    labelY: 320,
  },
  {
    id: "nanning",
    path: "M216 314 L332 290 L388 366 L308 438 L204 386 Z",
    labelX: 294,
    labelY: 362,
  },
  {
    id: "chongzuo",
    path: "M118 352 L214 316 L202 386 L264 452 L160 500 L84 434 Z",
    labelX: 166,
    labelY: 414,
  },
  {
    id: "qinzhou",
    path: "M314 438 L392 394 L454 446 L408 516 L328 520 L284 474 Z",
    labelX: 368,
    labelY: 456,
  },
  {
    id: "beihai",
    path: "M336 520 L410 516 L456 548 L398 586 L314 576 L288 548 Z",
    labelX: 372,
    labelY: 552,
  },
  {
    id: "fangchenggang",
    path: "M158 500 L264 452 L286 474 L286 548 L202 582 L132 548 Z",
    labelX: 210,
    labelY: 536,
  },
  {
    id: "yulin",
    path: "M412 364 L528 334 L588 424 L504 506 L408 516 L456 446 Z",
    labelX: 494,
    labelY: 432,
  },
];

const regions = guangxiCityProfiles.map((city) => ({
  id: city.id,
  name: city.labelZh,
  nameEn: city.labelEn,
  type: "city",
  geometryKey: city.id,
  center: city.center,
  zoom: city.zoom,
  bdDistrictName: city.bdDistrictName,
  summary: city.mapSummaryZh,
  summaryEn: city.mapSummaryEn,
  aliases: city.aliases,
  matchTerms: city.matchTerms,
  graphRegionId: city.id,
  isPriorityRegion: city.isPriorityRegion,
}));

export const guangxiMapBase = {
  viewBox: "0 0 740 640",
  geometryAssets,
  regions,
};
