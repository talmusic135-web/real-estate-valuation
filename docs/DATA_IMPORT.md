# ייבוא נתונים

## 1. מבנה השדות האחיד (CSV)

שורה ראשונה = כותרות. עמודה שחסרה או ריקה נשמרת כ-null (לא ממלאים ערכים).

| עמודה | חובה | הערות |
|---|---|---|
| source_record_id | כן | מזהה ייחודי במקור. ייבוא חוזר עם אותו מזהה מעדכן ולא משכפל |
| record_type | לא | `completed_transaction` (ברירת מחדל), `active_listing`, `historical_listing` |
| city | כן | |
| neighborhood, street, house_number, address | לא | |
| block, parcel | לא | גוש וחלקה |
| latitude, longitude | לא | WGS84 |
| transaction_date | לעסקאות | `YYYY-MM-DD` או `DD/MM/YYYY` |
| transaction_price_ils | לעסקאות | שקלים, אפשר עם פסיקים |
| listing_date, last_seen_at | לא | למודעות |
| asking_price_ils | למודעות | |
| property_type | לא | דירה / דירת גן / פנטהאוז / דופלקס / דירת גג (או באנגלית) |
| rooms, area_sqm, floor, building_floors, building_year | לא | |
| elevator, balcony, storage, mamad | לא | כן/לא, true/false, 1/0 |
| balcony_area_sqm, parking_spaces | לא | |
| condition | לא | חדש / משופץ / שמור / דורש שיפוץ |
| source_url | לא | קישור למקור/למודעה |
| data_confidence | לא | 0–1 |

קובץ דוגמה: `public/sample-import.csv`.

## 2. פורמט אתר מידע הנדל״ן הממשלתי

עמודות נתמכות: `DEALDATETIME, FULLADRESS / DISPLAYADRESS, GUSH (גוש-חלקה-תת), DEALNATUREDESCRIPTION, ASSETROOMNUM, FLOORNO, DEALNATURE (שטח), DEALAMOUNT, BUILDINGFLOORS, BUILDINGYEAR, KEYVALUE`.
המיפוי (`src/lib/connectors/normalize.ts → normalizeGovIl`) מבוסס על מבנה הנתונים שהאתר מציג, ויש לאמת אותו מול קובץ/ממשק רשמי בשלב 2.

## בדיקות שמתבצעות בייבוא

שורה נדחית (ולא "מתוקנת") אם: חסרים עיר/מזהה, לעסקה חסרים מחיר או תאריך, שטח מחוץ ל-10–2,000 מ״ר, מחיר מחוץ ל-100 אלף עד 200 מיליון ₪, או קואורדינטות מחוץ לישראל. הדוח על השורות שנדחו מוצג במסך.
