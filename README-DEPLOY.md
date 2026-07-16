# A2 Store — Deploy Statis (Netlify / Vercel / GitHub Pages)

## 1. Isi Firebase Config
Edit file: `firebase/config.js` — ganti nilai `PASTE_*` dengan config dari
Firebase Console → Project Settings → Your apps → Web app.

## 2. Aktifkan di Firebase Console
- Authentication → Sign-in method → **Google** (enable).
- Realtime Database → Create database (mode locked, aturan diatur nanti).
- Storage → Get started.
- Authentication → Settings → **Authorized domains** → tambahkan domain
  Netlify/Vercel/custom domain kamu (misal `your-app.netlify.app`).

## 3. Deploy
### Netlify
- Drag & drop folder ini ke https://app.netlify.com/drop, ATAU
- New site → Deploy manually → upload folder.
- Publish directory: root folder ini.

### Vercel
- `vercel` CLI di folder ini, atau import folder via dashboard.
- Framework preset: **Other** (static). Output dir: `.` (root).

### GitHub Pages
- Push isi folder ini ke branch `gh-pages`, aktifkan Pages.

## 4. Set Admin
Setelah login pertama kali dengan Google, buka Realtime Database dan tambahkan:
```
admins/
  <UID_KAMU>: true
```
UID bisa dilihat di Authentication → Users.

## 5. Selesai
Buka URL hosting kamu. Halaman otomatis redirect ke `home.html`.
