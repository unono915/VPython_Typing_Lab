/* 오프라인 단일 파일이 실제로 자립 동작하는지 확인 */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const path = require('path');
const file = path.join(__dirname, '..', 'dist', 'VPython_Typing_Lab_offline.html');

const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
  runScripts: 'dangerously', pretendToBeVisual: true,
  url: 'file:///C:/x/VPython_Typing_Lab_offline.html',
  resources: undefined,          // 외부 리소스 로드 안 함 = 오프라인 재현
  beforeParse(w) { w.HTMLElement.prototype.scrollIntoView = () => {}; }
});
const d = dom.window.document;
const $ = id => d.getElementById(id);
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  PASS  ' + n)) : (fail++, console.log('  FAIL  ' + n)); };

console.log('\n── 오프라인 단일 파일 ──');
ok('인라인 style 존재', d.querySelectorAll('style').length === 1);
ok('외부 stylesheet 없음', d.querySelectorAll('link[rel=stylesheet]').length === 0);
ok('외부 script src 없음', d.querySelectorAll('script[src]').length === 0);
ok('레벨 3개 렌더', d.querySelectorAll('.lv').length === 3);
ok('업적 8개 렌더', d.querySelectorAll('.bg-item').length === 8);
ok('문제 로드됨', $('target').textContent.trim().length > 0);
ok('결과 숨김', !$('result').classList.contains('on'));

// 한 판 완주
const field = $('field'), W = dom.window;
let g = 0;
while (!$('result').classList.contains('on') && g++ < 60) {
  const cur = Array.from($('target').querySelectorAll('span'))
    .filter(s => !s.classList.contains('sp')).map(s => s.textContent).join('');
  if (!cur) break;
  field.value = cur;
  field.dispatchEvent(new W.Event('input', { bubbles: true }));
}
ok('한 판 완주 → 결과 표시', $('result').classList.contains('on'));
ok('등급 유효', /^[SABCD]$/.test($('grade-l').textContent));
// file:// 에서는 브라우저가 localStorage 를 막을 수 있다.
// 앱이 예외로 죽지 않고 계속 동작하는지가 요구사항이다.
let lsBlocked = false, lsValue = null;
try { lsValue = W.localStorage.getItem('vtl.v1'); } catch (e) { lsBlocked = true; }
ok('localStorage 차단돼도 앱은 살아 있음', $('result').classList.contains('on'));
console.log('  INFO  localStorage ' + (lsBlocked ? '차단됨(file:// 정책) → 기록 미저장으로 우아하게 강등'
                                                 : '사용 가능 → 기록 저장됨'));

// 차단 상황에서도 재시작이 되는지
$('again').dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
ok('차단 상태에서 재시작 동작', !$('result').classList.contains('on'));

console.log(`\n  통과 ${pass} · 실패 ${fail}\n`);
process.exit(fail ? 1 : 0);
