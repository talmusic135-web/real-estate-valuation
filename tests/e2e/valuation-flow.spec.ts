import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function fillBasic(page: import("@playwright/test").Page, rooms: string, area: string) {
  await page.goto("/valuations/new");
  await page.locator('input[name="city"]').fill("רמת גן");
  await page.locator('input[name="neighborhood"]').fill("מרכז העיר");
  await page.locator('input[name="street"]').fill("ביאליק");
  await page.locator('input[name="rooms"]').fill(rooms);
  await page.locator('input[name="areaSqm"]').fill(area);
  await page.locator('input[name="floor"]').fill("3");
  await page.locator('select[name="elevator"]').selectOption("yes");
  await page.locator('select[name="parking"]').selectOption("one");
  await page.locator('select[name="mamad"]').selectOption("yes");
  await page.locator('select[name="condition"]').selectOption("maintained");
}

test("save a draft and reopen it", async ({ page }) => {
  await fillBasic(page, "3", "75");
  await page.locator('input[name="title"]').fill("טיוטת בדיקה E2E");
  await page.getByRole("button", { name: "שמירת טיוטה" }).click();
  await expect(page).toHaveURL(/\/valuations\/[a-z0-9]+$/);
  await expect(page.getByText("זו טיוטה")).toBeVisible();
  await page.getByRole("link", { name: "עריכת טיוטה" }).click();
  await expect(page.locator('input[name="rooms"]')).toHaveValue("3");
  await expect(page.locator('input[name="areaSqm"]')).toHaveValue("75");
});

test("validation errors are shown in Hebrew", async ({ page }) => {
  await page.goto("/valuations/new");
  await page.locator('input[name="city"]').fill("רמת גן");
  await page.locator('input[name="rooms"]').fill("3.3");
  await page.locator('input[name="areaSqm"]').fill("80");
  await page.getByRole("button", { name: "שמירת טיוטה" }).click();
  await expect(page.locator("form [role=alert]")).toContainText("חצי חדר");
});

test("run a valuation, see separated results, re-run with different rooms, export PDF", async ({ page, request }) => {
  await fillBasic(page, "4", "95");
  await page.getByRole("button", { name: "הרצת הערכת שווי" }).click();
  await expect(page.getByTestId("estimate")).toBeVisible({ timeout: 30_000 });
  const estimate1 = await page.getByTestId("estimate").innerText();
  expect(estimate1).toMatch(/₪/);
  await expect(page.getByText("נתוני הדגמה סינתטיים").first()).toBeVisible();
  await expect(page.getByTestId("comparables-table")).toBeVisible();
  await expect(page.getByTestId("listings-table")).toBeVisible();
  await expect(page.getByTestId("sources-used")).toContainText("מאגר עסקאות הנדל״ן הממשלתי");
  await expect(page.getByTestId("ai-summary")).not.toBeEmpty();
  const url1 = page.url();
  const id1 = url1.split("/").pop()!;

  // הסבר לעסקה: לחיצה על שורה פותחת סיבות
  await page.getByTestId("comparables-table").locator("tbody tr").first().click();
  await expect(page.getByText("למה נבחר / מה שונה")).toBeVisible();

  // שינוי חדרים ושטח → גרסה חדשה עם תוצאה שונה
  await page.getByRole("link", { name: "שינוי נתונים והרצה כגרסה חדשה" }).click();
  await page.locator('input[name="rooms"]').fill("5");
  await page.locator('input[name="areaSqm"]').fill("125");
  await page.getByRole("button", { name: "הרצת הערכה כגרסה חדשה" }).click();
  await expect(page).not.toHaveURL(url1);
  await expect(page.getByTestId("estimate")).toBeVisible({ timeout: 30_000 });
  const estimate2 = await page.getByTestId("estimate").innerText();
  expect(estimate2).not.toEqual(estimate1);
  await expect(page.getByText("גרסה של")).toBeVisible();

  // השוואה בין הגרסאות
  await page.getByRole("link", { name: "השוואה" }).first().click();
  await expect(page.getByTestId("compare-table")).toContainText("125 מ״ר");

  // דוח ו-PDF
  await page.goto(`/valuations/${id1}/report`);
  await expect(page.getByTestId("report")).toContainText("עסקאות השוואה");
  await expect(page.getByTestId("report")).toContainText("מתחרים פעילים");
  await expect(page.getByTestId("report")).toContainText("המלצה למתווך");
  const pdf = await request.get(`/api/valuations/${id1}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  // ההערכות נשמרו בהיסטוריה
  await page.goto("/valuations");
  await expect(page.getByTestId("history-table")).toContainText("5 חד׳, 125 מ״ר");
});

test("no estimate is shown when there is not enough data", async ({ page }) => {
  await page.goto("/valuations/new");
  await page.locator('input[name="city"]').fill("מצפה רמון");
  await page.locator('input[name="rooms"]').fill("4");
  await page.locator('input[name="areaSqm"]').fill("90");
  await page.getByRole("button", { name: "הרצת הערכת שווי" }).click();
  await expect(page.getByText("לא הופק אומדן שווי")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("estimate")).toHaveCount(0);
});

test("data sources show which are connected", async ({ page }) => {
  await page.goto("/sources");
  const c = page.getByTestId("connectors");
  await expect(c).toContainText("לא מחובר");
  await expect(c).toContainText("נתוני הדגמה");
});

test("transactions and competitors screens are separate and filterable", async ({ page }) => {
  await page.goto("/transactions?city=" + encodeURIComponent("חיפה") + "&roomsMin=3&roomsMax=4");
  await expect(page.getByTestId("transactions-table")).toBeVisible();
  const rooms = await page.getByTestId("transactions-table").locator("tbody tr td:nth-child(4)").allInnerTexts();
  expect(rooms.every((r) => Number(r) >= 3 && Number(r) <= 4)).toBe(true);
  await page.goto("/competitors?city=" + encodeURIComponent("חיפה"));
  await expect(page.getByTestId("competitors-table")).toBeVisible();
  await expect(page.getByText("מחירים מבוקשים ואינם מחירי מכירה")).toBeVisible();
});
