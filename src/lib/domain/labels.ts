// תוויות בעברית לכל ערכי ה-enum במערכת

export const propertyTypeLabels: Record<string, string> = {
  apartment: "דירה",
  garden: "דירת גן",
  penthouse: "פנטהאוז",
  duplex: "דופלקס",
  roof: "דירת גג",
  other: "נכס אחר",
};

export const conditionLabels: Record<string, string> = {
  new: "חדש",
  renovated: "משופץ",
  maintained: "שמור",
  needs_renovation: "דורש שיפוץ",
  unknown: "לא ידוע",
};

export const triLabels: Record<string, string> = { yes: "כן", no: "לא", unknown: "לא ידוע" };

export const parkingLabels: Record<string, string> = {
  none: "אין",
  one: "אחת",
  two_plus: "שתיים או יותר",
  unknown: "לא ידוע",
};

export const airDirectionLabels: Record<string, string> = {
  north: "צפון",
  south: "דרום",
  east: "מזרח",
  west: "מערב",
};

export const recordTypeLabels: Record<string, string> = {
  completed_transaction: "עסקה שהושלמה",
  active_listing: "מודעה פעילה",
  historical_listing: "מודעה היסטורית",
};

export const confidenceLabels: Record<string, string> = {
  high: "גבוהה",
  medium: "בינונית",
  low: "נמוכה",
  insufficient: "אין מספיק נתונים",
};

export const statusLabels: Record<string, string> = {
  draft: "טיוטה",
  completed: "הושלמה",
  insufficient_data: "חסרים נתונים",
};

export const tierLabels: Record<string, string> = {
  street: "אותו רחוב",
  radius: "ברדיוס החיפוש",
  neighborhood: "אותה שכונה",
  adjacent: "שכונה סמוכה",
  city: "אותה עיר (הרחבה)",
  older: "עסקה ישנה (הרחבת טווח תאריכים)",
};

export const radiusOptions = [
  { value: 250, label: "250 מטר" },
  { value: 500, label: "500 מטר" },
  { value: 1000, label: "קילומטר" },
  { value: 2000, label: "2 ק״מ" },
];
