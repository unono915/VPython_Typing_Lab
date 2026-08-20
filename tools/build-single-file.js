/* ============================================================
   단일 파일 배포본 생성기 (선택 사항)

   웹사이트 자체는 빌드가 필요 없다. 이 스크립트는 오직
   "USB에 담아 인터넷 없는 실습실에서 쓰는 용도"의
   HTML 한 장을 만들기 위한 것이다.

   실행:  node tools/build-single-file.js
   결과:  dist/VPython_Typing_Lab_offline.html
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT = path.join(OUT_DIR, 'VPython_Typing_Lab_offline.html');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

let html = read('index.html');

// <link rel="stylesheet" href="assets/css/style.css"> → 인라인 <style>
html = html.replace(
  /<link rel="stylesheet" href="assets\/css\/style\.css">/,
  '<style>\n' + read('assets/css/style.css') + '\n</style>'
);

// <script src="..."> → 인라인 <script>
html = html.replace(
  /<script src="(assets\/js\/[^"]+)"><\/script>/g,
  (_, src) => '<script>\n' + read(src) + '\n</script>'
);

// 남은 외부 참조가 없는지 검증 (data: URI 파비콘은 허용)
const leftover = html.match(/(?:src|href)="(?!data:|https:\/\/github\.com)[^"]*\.(?:css|js)"/g);
if (leftover) {
  console.error('인라인되지 않은 참조가 남았습니다:', leftover);
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');

const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`생성: ${path.relative(ROOT, OUT)}  (${kb} KB)`);
console.log('이 파일 하나만 있으면 인터넷 없이 동작합니다.');
