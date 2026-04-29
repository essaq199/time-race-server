import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/app-ads.txt", (_req, res) => {
  res.type("text/plain");
  res.send("google.com, pub-6160127047032913, DIRECT, f08c47fec0942fa0");
});

app.use("/api", router);

app.get("/privacy", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>سياسة الخصوصية - Time Race</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.8; }
  h1 { color: #6b21a8; border-bottom: 2px solid #f97316; padding-bottom: 10px; }
  h2 { color: #6b21a8; margin-top: 30px; }
  .date { color: #888; font-size: 14px; }
  .en { direction: ltr; text-align: left; margin-top: 40px; border-top: 2px solid #eee; padding-top: 20px; }
</style>
</head>
<body>
<h1>سياسة الخصوصية - Time Race / سباق الوقت</h1>
<p class="date">آخر تحديث: أبريل 2025</p>

<h2>المعلومات التي نجمعها</h2>
<p>تطبيق <strong>سباق الوقت (Time Race)</strong> لا يجمع أي معلومات شخصية تعريفية. عند اللعب عبر الإنترنت، يستخدم التطبيق اسم اللاعب الذي تدخله فقط خلال جلسة اللعب، ولا يتم حفظه أو مشاركته.</p>

<h2>بيانات اللعبة</h2>
<p>يتصل التطبيق بخادمنا فقط لأغراض اللعب الجماعي عبر الإنترنت (إنشاء الغرف والانضمام إليها). لا نحتفظ بأي سجلات لبيانات اللاعبين أو نتائج الألعاب.</p>

<h2>الإعلانات</h2>
<p>قد يعرض التطبيق إعلانات من خلال خدمة Google AdMob. تستخدم هذه الإعلانات معرّف الإعلان (Advertising ID) لتقديم إعلانات مناسبة. يمكنك إيقاف تخصيص الإعلانات من إعدادات جهازك.</p>

<h2>مشاركة البيانات</h2>
<p>لا نشارك بياناتك الشخصية مع أطراف ثالثة، باستثناء مزودي الإعلانات (Google AdMob) وفق سياستهم الخاصة.</p>

<h2>أذونات التطبيق</h2>
<p>يطلب التطبيق إذن الوصول للإنترنت فقط لتمكين ميزة اللعب الجماعي.</p>

<h2>الأطفال</h2>
<p>تطبيقنا مناسب لجميع الأعمار ولا يجمع بيانات من الأطفال.</p>

<h2>تواصل معنا</h2>
<p>إذا كان لديك أي استفسار، يمكنك التواصل معنا عبر: <strong>SibaqAlwaqt@gmail.com</strong></p>

<div class="en">
<h1>Privacy Policy - Time Race</h1>
<p class="date">Last updated: April 2025</p>

<h2>Information We Collect</h2>
<p><strong>Time Race</strong> does not collect any personally identifiable information. When playing online, the app uses only the player name you enter during the game session — it is never stored or shared.</p>

<h2>Game Data</h2>
<p>The app connects to our server solely for online multiplayer functionality (creating and joining rooms). We do not retain any player data or game results.</p>

<h2>Advertisements</h2>
<p>The app may display advertisements through Google AdMob. These ads may use your device's Advertising ID to show relevant ads. You can opt out of personalized ads in your device settings.</p>

<h2>Data Sharing</h2>
<p>We do not share your personal data with third parties, except with advertising providers (Google AdMob) in accordance with their own privacy policy.</p>

<h2>App Permissions</h2>
<p>The app only requests Internet access permission to enable the multiplayer feature.</p>

<h2>Children</h2>
<p>Our app is suitable for all ages and does not collect data from children.</p>

<h2>Contact Us</h2>
<p>If you have any questions, please contact us at: <strong>SibaqAlwaqt@gmail.com</strong></p>
</div>
</body>
</html>`);
});

// AdMob pub-6160127047032913 verified 2026-04-29T14:41:23.984Z
export default app;
