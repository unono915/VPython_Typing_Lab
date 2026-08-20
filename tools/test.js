/* VPython Typing Lab — 헤드리스 스모크 테스트 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  → ' + extra : '')); }
}

const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: 'https://example.test/'
});
const { window } = dom;
const { document } = window;

// scrollIntoView / confirm 스텁
window.HTMLElement.prototype.scrollIntoView = function () {};
window.confirm = () => true;

// 스크립트 주입 (index.html 의 순서 그대로)
for (const rel of ['assets/js/data.js', 'assets/js/app.js']) {
  window.eval(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

const $ = id => document.getElementById(id);
const field = $('field');

function typeChars(str) {
  for (const ch of str) {
    field.value += ch;
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
  }
}
function currentTarget() {
  // 화면에 렌더된 문자들을 이어붙이면 현재 문제 문자열
  return Array.from($('target').querySelectorAll('span'))
    .filter(s => !s.classList.contains('sp'))
    .map(s => s.classList.contains('sp') ? ' ' : s.textContent)
    .join('');
}

console.log('\n── 1. 초기 렌더 ──');
ok('레벨 버튼 3개', document.querySelectorAll('.lv').length === 3);
ok('첫 레벨 활성', document.querySelector('.lv').classList.contains('on'));
ok('업적 8개 렌더', document.querySelectorAll('.bg-item').length === 8);
ok('업적 전부 미획득', document.querySelectorAll('.bg-item.got').length === 0);
ok('기록 비어 있음 안내', $('records').textContent.includes('아직 기록이 없습니다'));
ok('문제 렌더됨', currentTarget().length > 0, 'target="' + currentTarget() + '"');
ok('결과 숨김', !$('result').classList.contains('on'));

console.log('\n── 2. 오타 → 콤보 리셋 ──');
let t = currentTarget();
typeChars(t[0]);
ok('정타 후 진행바 > 0', parseFloat($('progbar').style.width) > 0);
field.value += 'ZZ';                                    // 확실한 오타
field.dispatchEvent(new window.Event('input', { bubbles: true }));
ok('오타 시 콤보 0', $('combo-n').textContent === '0');
ok('정확도 100 미만', parseInt($('s-acc').textContent) < 100, $('s-acc').textContent);
ok('오타 표시(.bad) 존재', $('target').querySelectorAll('.bad').length > 0);

console.log('\n── 3. 교정 후 진행 ──');
field.value = t;                                        // 통째로 교정
field.dispatchEvent(new window.Event('input', { bubbles: true }));
ok('다음 문제로 넘어감', currentTarget() !== t || $('s-prg').textContent.startsWith('1'));
ok('진행 카운터 증가', $('s-prg').textContent.replace(/\s/g, '').startsWith('1'));

console.log('\n── 4. 한 판 완주 ──');
let guard = 0;
while (!$('result').classList.contains('on') && guard++ < 60) {
  const cur = currentTarget();
  if (!cur) break;
  field.value = cur;
  field.dispatchEvent(new window.Event('input', { bubbles: true }));
}
ok('결과 화면 표시', $('result').classList.contains('on'));
ok('등급 값 유효', /^[SABCD]$/.test($('grade-l').textContent), $('grade-l').textContent);
ok('타수 숫자', /^\d+$/.test($('r-kpm').textContent), $('r-kpm').textContent);
ok('정확도 표시', /%$/.test($('r-acc').textContent), $('r-acc').textContent);
ok('오타 문자 TOP 표시', $('worst').textContent.length > 0);
ok('업적 최소 1개 획득', document.querySelectorAll('.bg-item.got').length >= 1,
   document.querySelectorAll('.bg-item.got').length + '개');
ok('기록 1건 추가', document.querySelectorAll('.rec').length === 1);
ok('레벨 카드에 최고 기록', document.querySelector('.lv .lvrec').textContent.includes('최고'));
ok('"틀린 것만 다시" 노출', !$('retry-wrong').hidden);
ok('"다음 단계" 노출', !$('next-level').hidden);

console.log('\n── 5. localStorage 저장 ──');
const saved = JSON.parse(window.localStorage.getItem('vtl.v1'));
ok('best 저장됨', !!saved.best.words, JSON.stringify(saved.best));
ok('records 저장됨', saved.records.length === 1);
ok('cleared.words = true', saved.cleared.words === true);

console.log('\n── 6. 이름 입력 ──');
$('who').value = '김민준';
$('who').dispatchEvent(new window.Event('input', { bubbles: true }));
ok('이름 저장', JSON.parse(window.localStorage.getItem('vtl.v1')).name === '김민준');

console.log('\n── 7. 레벨 전환 ──');
document.querySelectorAll('.lv')[2].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
ok('LEVEL 3 활성', document.querySelectorAll('.lv')[2].classList.contains('on'));
ok('결과 화면 닫힘', !$('result').classList.contains('on'));
ok('LEVEL 3 문제 로드', currentTarget().length > 0, '"' + currentTarget() + '"');
ok('지표 초기화', $('s-kpm').textContent === '0');

console.log('\n── 8. 건너뛰기 ──');
const before = currentTarget();
$('skip').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
ok('문제가 바뀜', currentTarget() !== before);

console.log('\n── 9. 붙여넣기 차단 ──');
const pasteEvt = new window.Event('paste', { bubbles: true, cancelable: true });
field.dispatchEvent(pasteEvt);
ok('paste preventDefault', pasteEvt.defaultPrevented);

console.log('\n── 10. 공백 포함 문제 처리 ──');
// LEVEL 3 에는 공백과 들여쓰기가 있다
let found = null, g2 = 0;
while (g2++ < 30) {
  const cur = currentTarget();
  if (cur.includes(' ')) { found = cur; break; }
  field.value = cur;
  field.dispatchEvent(new window.Event('input', { bubbles: true }));
  if ($('result').classList.contains('on')) break;
}
ok('공백 포함 문제 렌더 확인', found !== null, found ? '"' + found + '"' : '이번 판에는 없었음(무작위)');

console.log('\n════════════════════════════');
console.log(`  통과 ${pass} · 실패 ${fail}`);
console.log('════════════════════════════\n');
process.exit(fail ? 1 : 0);
