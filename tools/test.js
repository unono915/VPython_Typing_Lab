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

// index.html 에 적힌 <script src> 를 그대로 읽어 순서대로 주입한다.
// 스크립트가 늘어나도 테스트를 따로 고칠 필요가 없다.
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
if (!scripts.length) throw new Error('index.html 에서 script 태그를 찾지 못했습니다');

// 네트워크는 막고, 전송 payload 를 가로챈다.
const sent = [];
window.fetch = (url, opt) => {
  sent.push({ url, body: opt && opt.body ? JSON.parse(opt.body) : null });
  return Promise.resolve({ ok: true, status: 201, text: () => Promise.resolve(''), json: () => Promise.resolve({}) });
};

for (const rel of scripts) {
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

console.log('\n── 6. 신원 입력 ──');
ok('index.html 의 스크립트 4개 로드', scripts.length === 4, scripts.join(', '));
ok('반 선택지 채워짐', $('wclass').options.length > 1, $('wclass').options.length + '개');
ok('반·이름 없이 끝낸 판은 전송되지 않음', sent.length === 0, sent.length + '건');

$('who').value = '김민준';
$('who').dispatchEvent(new window.Event('input', { bubbles: true }));
$('wclass').value = $('wclass').options[1].value;
$('wclass').dispatchEvent(new window.Event('change', { bubbles: true }));
$('wno').value = '10315';
$('wno').dispatchEvent(new window.Event('input', { bubbles: true }));

const st = JSON.parse(window.localStorage.getItem('vtl.v1'));
ok('이름 저장', st.name === '김민준');
ok('반 저장', !!st.cls, st.cls);
ok('학번 저장', st.no === '10315');
ok('개인정보 안내가 전송 상태로 갱신', $('privacy').textContent.includes('선생님'), $('privacy').textContent);

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

console.log('\n── 9-1. 신원 입력 후 완주 → 서버 전송 ──');
document.querySelectorAll('.lv')[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
let g3 = 0;
while (!$('result').classList.contains('on') && g3++ < 60) {
  const cur = currentTarget();
  if (!cur) break;
  field.value = cur;
  field.dispatchEvent(new window.Event('input', { bubbles: true }));
}
ok('전송 1건 발생', sent.length === 1, sent.length + '건');
if (sent.length) {
  const body = sent[0].body[0];
  const ALLOWED = ['class_code', 'student_name', 'student_no', 'level_id', 'level_name',
                   'grade', 'kpm', 'accuracy', 'errors', 'best_combo', 'seconds', 'chars'];
  ok('엔드포인트가 /rest/v1/runs', sent[0].url.endsWith('/rest/v1/runs'), sent[0].url);
  ok('반 포함', !!body.class_code, body.class_code);
  ok('이름 포함', body.student_name === '김민준');
  ok('학번 포함', body.student_no === '10315');
  ok('level_id 유효', ['words', 'symbols', 'lines'].includes(body.level_id), body.level_id);
  ok('등급 유효', /^[SABCD]$/.test(body.grade), body.grade);
  ok('seconds >= 1 (DB CHECK 통과)', body.seconds >= 1, String(body.seconds));
  ok('chars >= 1 (DB CHECK 통과)', body.chars >= 1, String(body.chars));
  ok('kpm 0~2000 (DB CHECK 통과)', body.kpm >= 0 && body.kpm <= 2000, String(body.kpm));
  ok('허용된 필드만 전송 (불필요한 개인정보 없음)',
     Object.keys(body).every(k => ALLOWED.includes(k)), Object.keys(body).join(','));
  ok('전송 결과 메시지 표시', $('sync-msg').textContent.length > 0, $('sync-msg').textContent);
}

console.log('\n── 10. 공백 포함 문제 처리 ──');
// LEVEL 3 문항은 전부 공백이나 들여쓰기를 포함한다
document.querySelectorAll('.lv')[2].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
let found = null, g2 = 0;
while (g2++ < 30) {
  const cur = currentTarget();
  if (cur.includes(' ')) { found = cur; break; }
  field.value = cur;
  field.dispatchEvent(new window.Event('input', { bubbles: true }));
  if ($('result').classList.contains('on')) break;
}
ok('공백 포함 문제 렌더 확인', found !== null, found ? '"' + found + '"' : '이번 판에는 없었음(무작위)');

console.log('\n── 10-1. 한글 입력 감지 ──');
document.querySelectorAll('.lv')[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const accBefore = $('s-acc').textContent;
field.value = '사프';                       // 한/영 안 누르고 친 상황
field.dispatchEvent(new window.Event('input', { bubbles: true }));
ok('한글 경고 표시', !$('guard').hidden);
ok('경고에 한/영 안내', $('guard').textContent.includes('한/영'), $('guard').textContent);
ok('패드 잠김 표시', $('pad').classList.contains('locked'));
ok('한글은 입력칸에서 제거됨', field.value === '', JSON.stringify(field.value));
ok('한글을 오타로 세지 않음', $('s-acc').textContent === accBefore,
   accBefore + ' → ' + $('s-acc').textContent);
ok('타이머 시작 안 함', $('s-tm').textContent.startsWith('0'), $('s-tm').textContent);

console.log('\n── 10-2. 영문으로 돌아오면 해제 ──');
field.value = currentTarget()[0];
field.dispatchEvent(new window.Event('input', { bubbles: true }));
ok('경고 사라짐', $('guard').hidden === true);
ok('패드 잠금 해제', !$('pad').classList.contains('locked'));
ok('정상 채점 재개', $('target').querySelectorAll('.ok').length > 0);

console.log('\n── 10-3. CapsLock 감지 ──');
document.querySelectorAll('.lv')[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const capsDown = new window.KeyboardEvent('keydown', { key: 'A', bubbles: true });
capsDown.getModifierState = k => k === 'CapsLock';
document.dispatchEvent(capsDown);
ok('CapsLock 경고 표시', !$('guard').hidden);
ok('경고에 Caps Lock 안내', $('guard').textContent.includes('Caps Lock'), $('guard').textContent);
field.value = 'SPHERE';
field.dispatchEvent(new window.Event('input', { bubbles: true }));
ok('대문자 입력 되돌림', field.value === '', JSON.stringify(field.value));
ok('CapsLock 중에는 타이머 시작 안 함', $('s-tm').textContent.startsWith('0'), $('s-tm').textContent);

const capsUp = new window.KeyboardEvent('keyup', { key: 'CapsLock', bubbles: true });
capsUp.getModifierState = () => false;
document.dispatchEvent(capsUp);
ok('CapsLock 끄면 경고 해제', $('guard').hidden === true);

console.log('\n── 11. 서버가 거부한 기록은 재시도 큐에 쌓지 않는다 ──');
// 400 을 돌려주는 서버를 흉내낸다
window.fetch = () => Promise.resolve({
  ok: false, status: 400,
  text: () => Promise.resolve('{"code":"23514","message":"check constraint"}'),
  json: () => Promise.resolve({})
});
const qBefore = window.TLSync.pending();
window.TLSync.send({
  class_code: '1-1', student_name: '테스트', student_no: null,
  level_id: 'words', level_name: '낱말', grade: 'S',
  kpm: 99999, accuracy: 100, errors: 0, best_combo: 0, seconds: 1, chars: 1
}).then(state => {
  ok('400 응답은 rejected 로 처리', state === 'rejected', state);
  ok('큐에 쌓이지 않음', window.TLSync.pending() === qBefore,
     qBefore + ' → ' + window.TLSync.pending());
  done();
});

function done() {
console.log('\n════════════════════════════');
console.log(`  통과 ${pass} · 실패 ${fail}`);
console.log('════════════════════════════\n');
process.exit(fail ? 1 : 0);
}
