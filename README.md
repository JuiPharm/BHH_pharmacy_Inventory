# Inventory / เบิกจ่าย — Frontend (Static Site)

โครงการนี้เป็น Frontend สำหรับระบบ Inventory/เบิกจ่าย โดย Backend เป็น Google Apps Script Web App (JSON API) และฐานข้อมูลเป็น Google Sheets

คุณสมบัติหลัก:
- Static site (HTML/CSS/JS) ใช้ Bootstrap 5 ผ่าน CDN
- Deploy บน GitHub Pages ได้ทันที (แค่ push ไฟล์)
- Hash routing (`#/login`, `#/dashboard`, `#/stock`, `#/transactions`, `#/requisitions`, `#/admin`)
- เรียก Backend ด้วย `fetch` (POST) และ **ต้องใช้** `Content-Type: text/plain;charset=utf-8`
- เก็บ `sessionToken`, `role`, `profile`, `GAS_URL` ใน `localStorage`
- Dashboard ใช้ polling เรียก `action="dashboard_snapshot"` ทุก 5 วินาที (หยุดเมื่อออกจากหน้า)

---

## หมายเหตุ: เบิกสินค้า (Requisitions)

- ปุ่ม **Submit** ในหน้า Requisitions จะตัดสต็อกทันที (No Approve) และสร้าง PDF สรุปรายการเบิก
- หน่วยงาน (dept) เป็น dropdown: OPD, IPD, IV Chemo


## 1) วิธีสร้าง Repo และวางไฟล์

1. สร้าง GitHub Repository ใหม่ (Public หรือ Private ก็ได้)
2. วางไฟล์ทั้งหมดของโปรเจกต์นี้ไว้ที่ root ของ repo (ระดับเดียวกับ `index.html`)
3. Commit และ push ไปที่ branch `main`

โครงสร้างไฟล์ต้องเป็นแบบนี้:

```
/
  index.html
  app.css
  router.js
  api.js
  auth.js
  ui.js
  /assets
  /pages
    login.js
    dashboard.js
    stock.js
    transactions.js
    requisitions.js
    admin.js
```

---

## 2) เปิด GitHub Pages

ไปที่:
- `Settings` → `Pages`
- `Build and deployment` → `Source` เลือก **Deploy from a branch**
- เลือก `Branch: main` และ `Folder: /(root)`
- กด Save

จากนั้น GitHub จะให้ URL ของเว็บไซต์ (เช่น `https://<username>.github.io/<repo>/`)

---

## 3) วิธีใช้งาน

1. เปิดเว็บ GitHub Pages
2. หน้า Login ให้ใส่:
   - `GAS_URL` = URL ของ Google Apps Script Web App (Deploy เป็น Web app แล้ว)
   - `username` และ `password`
3. กด **Test Connection** เพื่อตรวจสอบการเชื่อมต่อ (`action=health`)
4. กด **Login** (`action=auth_login`)
5. เมื่อเข้าแล้ว เมนูจะปรับตาม Role (RBAC ฝั่ง UI)

---

## 4) ข้อควรระวังสำคัญ (บังคับ)

- การเรียก API ต้องเป็น **POST** และต้องใช้ header นี้เท่านั้น:

```js
headers: { "Content-Type": "text/plain;charset=utf-8" }
```

- รูปแบบ body ต้องเป็น JSON string เท่านั้น:

```js
body: JSON.stringify({ action, data, sessionToken })
```

- `sessionToken` จะถูกส่งใน body ทุกครั้งหลัง login

---

## 5) การปรับค่า/ดีบัก

- ใช้ DevTools → Console/Network ตรวจสอบ request/response
- ค่า session จะอยู่ใน `localStorage`:
  - `GAS_URL`
  - `sessionToken`
  - `role`
  - `profile` (เก็บเป็น JSON string)

---

## 6) License

Internal use / demo. ปรับแก้ได้ตามต้องการ
