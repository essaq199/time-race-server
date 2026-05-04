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
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.type("text/html");
  res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>سباق الوقت - Time Race</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Segoe UI', Arial, sans-serif;
    background: #0f0a1f;
    color: #fff;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 40px 20px;
  }
  .icon {
    width: 120px; height: 120px;
    border-radius: 28px;
    background: linear-gradient(135deg, #6b21a8, #f97316);
    display: flex; align-items: center; justify-content: center;
    font-size: 60px;
    margin: 0 auto 24px;
    box-shadow: 0 20px 60px rgba(249,115,22,0.4);
  }
  h1 {
    font-size: 2.5rem;
    font-weight: 800;
    background: linear-gradient(135deg, #f97316, #a855f7);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 8px;
  }
  .subtitle {
    font-size: 1.1rem;
    color: #a78bfa;
    margin-bottom: 32px;
  }
  .desc {
    font-size: 1rem;
    color: #d1d5db;
    max-width: 500px;
    line-height: 1.8;
    margin-bottom: 40px;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
    margin-bottom: 40px;
  }
  .badge {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 50px;
    padding: 10px 20px;
    font-size: 0.9rem;
    color: #e5e7eb;
  }
  .badge span { margin-left: 6px; }
  .cta {
    display: inline-block;
    background: linear-gradient(135deg, #f97316, #a855f7);
    color: #fff;
    text-decoration: none;
    padding: 16px 40px;
    border-radius: 50px;
    font-size: 1.1rem;
    font-weight: 700;
    box-shadow: 0 8px 30px rgba(249,115,22,0.4);
    transition: transform 0.2s;
  }
  .cta:hover { transform: scale(1.05); }
  .footer {
    margin-top: 60px;
    color: #6b7280;
    font-size: 0.85rem;
  }
  .footer a { color: #a78bfa; text-decoration: none; }
</style>
</head>
<body>
  <div class="icon">⏱</div>
  <h1>سباق الوقت</h1>
  <p class="subtitle">Time Race — تحدى أصدقاءك في سباق المعرفة!</p>
  <p class="desc">
    لعبة أسئلة عربية تنافسية في الوقت الفعلي. تنافس ضد لاعبين من جميع أنحاء العالم في تصنيفات متعددة — رياضة، علوم، تاريخ، ترفيه، وأكثر.
  </p>
  <div class="badges">
    <div class="badge">🎮<span>لعب جماعي أونلاين</span></div>
    <div class="badge">🏆<span>لوحة المتصدرين</span></div>
    <div class="badge">❓<span>أكثر من 500 سؤال</span></div>
    <div class="badge">🌍<span>عربي وإنجليزي</span></div>
  </div>
  <a class="cta" href="https://apps.apple.com/app/id6764367677">
    ⬇️ حمّل المجاني من App Store
  </a>
  <div class="footer">
    <p>© 2026 Essa Alqahtani &nbsp;|&nbsp; <a href="/privacy">سياسة الخصوصية</a></p>
  </div>
</body>
</html>`);
});

app.get("/app-ads.txt", (_req, res) => {
  res.type("text/plain");
  res.send("google.com, pub-6160127047032913, DIRECT, f08c47fec0942fa0");
});

app.use("/api", router);

app.get("/privacy", (_req, res) => {
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
<p>يتصل التطبيق بخادمنا فقط لأغراض اللعب الجماعي عبر الإنترنت. لا نحتفظ بأي سجلات لبيانات اللاعبين أو نتائج الألعاب.</p>
<h2>الإعلانات</h2>
<p>قد يعرض التطبيق إعلانات من خلال خدمة Google AdMob. يمكنك إيقاف تخصيص الإعلانات من إعدادات جهازك.</p>
<h2>تواصل معنا</h2>
<p>إذا كان لديك أي استفسار: <strong>SibaqAlwaqt@gmail.com</strong></p>
<div class="en">
<h1>Privacy Policy - Time Race</h1>
<p class="date">Last updated: April 2025</p>
<h2>Information We Collect</h2>
<p><strong>Time Race</strong> does not collect any personally identifiable information. When playing online, the app uses only the player name you enter during the game session.</p>
<h2>Advertisements</h2>
<p>The app may display advertisements through Google AdMob. You can opt out of personalized ads in your device settings.</p>
<h2>Contact Us</h2>
<p>Questions? Contact us at: <strong>SibaqAlwaqt@gmail.com</strong></p>
</div>
</body>
</html>`);
});

// AdMob pub-6160127047032913 verified 1777474014303
export default app;
