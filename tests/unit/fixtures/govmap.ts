// מבנה התגובות של GovMap, לפי דוגמאות שפורסמו בפרויקט הקוד הפתוח nadlan-mcp (רישיון MIT).
// הערכים מקוצרים; הקואורדינטות ב-Web Mercator כמו בממשק האמיתי.
export const autocomplete = {
  resultsCount: 1,
  results: [{ text: "סוקולוב 38 חולון", id: "address|ADDR|1", type: "address", score: 1600, shape: "POINT(3871467.98 3766276.97)" }],
};

export const polygons = [
  { dealscount: "10", settlementNameHeb: "חולון", streetNameHeb: null, houseNum: null, polygon_id: "7170-31", objectid: 14248 },
  { dealscount: "6", settlementNameHeb: "חולון", streetNameHeb: null, houseNum: null, polygon_id: "7172-19", objectid: 14249 },
];

export const deals = [
  {
    objectid: 1969420,
    dealId: 3605441001,
    dealAmount: 1600000,
    dealDate: "2025-09-11T00:00:00.000Z",
    assetArea: 61,
    settlementNameHeb: "חולון",
    dealNatureDescription: "דירה בבית קומות",
    neighborhood: "קרית עבודה",
    streetNameHeb: "סוקולוב",
    houseNum: 40,
    floorNo: "שלישית",
    assetRoomNum: 3,
    gushNum: 7166,
    parcelNum: 141,
    shape: "MULTIPOLYGON(((3870720.46 3766261.47,3870704.82 3766280.49,3870715.87 3766289.56,3870731.37 3766270.53,3870720.46 3766261.47)))",
  },
  {
    objectid: 1960644,
    dealId: 3605441588,
    dealAmount: 200000,
    dealDate: "2024-10-13",
    assetArea: 20,
    settlementNameHeb: "חולון",
    dealNatureDescription: "חנות",
    propertyTypeDescription: "בנין",
    streetNameHeb: "סוקולוב",
    houseNum: 32,
    floorNo: "קרקע",
    shape: "MULTIPOLYGON(((3870903.63 3766273.36,3870887.61 3766277.30,3870893.74 3766302.55,3870903.63 3766273.36)))",
  },
  {
    objectid: 1900001,
    dealId: 3605440002,
    dealAmount: 2450000,
    dealDate: "2018-03-01",
    assetArea: 95,
    settlementNameHeb: "חולון",
    dealNatureDescription: "דירה בבית קומות",
    streetNameHeb: "סוקולוב",
    houseNum: 12,
    floorNo: "2",
    assetRoomNum: 4,
    shape: "POINT(3870800 3766300)",
  },
];
