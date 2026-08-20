/* ============================================================
   엣지 케이스 탐색 — 실제 교실에서 벌어질 법한 상황들
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SRCS = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const CODE = SRCS.map(s => fs.readFileSync(path.join(ROOT, s), 'utf8'));

let pass = 0, fail = 0;
const ok = (n, c, x) => c ? (pass++, console.log('  PASS  ' + n))
                          : (fail++, console.log('  FAIL  ' + n + (x ? '  → ' + x : '')));

function boot(opts) {
  opts = opts || {};
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  const { window } = dom;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.confirm = () => true;
  const sent = [];
  window.fetch = (url, o) => {
    sent.push({ url, body: o && o.body ? JSON.parse(o.body) : null });
    return Promise.resolve({ ok: true, status: 201, text: () => Promise.resolve(''), json: () => Promise.resolve({}) });
  };
  if (opts.seed) window.localStorage.setItem('vtl.v1', JSON.stringify(opts.seed));
  CODE.forEach(c => window.eval(c));
  const d = window.document;
  const $ = id => d.getElementById(id);
  const cur = () => Array.from($('target').querySelectorAll('span'))
    .filter(s => !s.classList.contains('sp')).map(s => s.textContent).join('');
  const type = str => { $('field').value = str; $('field').dispatchEvent(new window.Event('input', { bubbles: true })); };
  const finish = () => { let g = 0; while (!$('result').classList.contains('on') && g++ < 80) { const c = cur(); if (!c) break; type(c); } };
  return { window, d, $, cur, type, finish, sent };
}

/* ── 1. 공용 PC: 앞 시간 학생 이름이 그대로 남는다 ── */
console.log('\n── 1. 공용 PC · 앞 사람 이름 잔류 ──');
{
  const yesterday = new Date(Date.now() - 26 * 3600e3).toISOString();
  const { $, finish, sent } = boot({
    seed: { name: '앞반학생', cls: '1-2', no: '10201', best: {}, records: [{ lv: '낱말', grade: 'B', kpm: 100, acc: 90, at: yesterday }], badges: {}, cleared: {} }
  });
  ok('본인 확인 바 표시', $('confirm-bar').hidden === false);
  ok('확인 바에 이전 이름 안내', $('cb-name').textContent.includes('앞반학생'), $('cb-name').textContent);
  finish();
  ok('확인 전에는 전송하지 않음', sent.length === 0, sent.length + '건');
  ok('안내 메시지 표시', $('sync-msg').textContent.includes('본인 확인'), $('sync-msg').textContent);
}

console.log('\n── 1-1. "아니요, 다른 사람이에요" ──');
{
  const b = boot({ seed: { name: '앞반학생', cls: '1-2', no: '10201', best: {}, records: [], badges: {}, cleared: {} } });
  b.$('cb-no').dispatchEvent(new b.window.MouseEvent('click', { bubbles: true }));
  ok('이름 비워짐', b.$('who').value === '');
  ok('학번 비워짐', b.$('wno').value === '');
  ok('반은 유지 (같은 교실이므로)', b.$('wclass').value === '1-2', b.$('wclass').value);
  ok('확인 바 사라짐', b.$('confirm-bar').hidden === true);
  b.finish();
  ok('이름이 없으니 전송 안 함', b.sent.length === 0, b.sent.length + '건');
}

console.log('\n── 1-2. "네, 저예요" ──');
{
  const b = boot({ seed: { name: '앞반학생', cls: '1-2', no: '10201', best: {}, records: [], badges: {}, cleared: {} } });
  b.$('cb-yes').dispatchEvent(new b.window.MouseEvent('click', { bubbles: true }));
  ok('확인 바 사라짐', b.$('confirm-bar').hidden === true);
  b.finish();
  ok('확인 후에는 전송됨', b.sent.length === 1, b.sent.length + '건');
  ok('이름이 정확히 전달', b.sent.length && b.sent[0].body[0].student_name === '앞반학생');
}

console.log('\n── 1-3. 이름을 직접 고치면 확인으로 친다 ──');
{
  const b = boot({ seed: { name: '앞반학생', cls: '1-2', no: '10201', best: {}, records: [], badges: {}, cleared: {} } });
  b.$('who').value = '새학생';
  b.$('who').dispatchEvent(new b.window.Event('input', { bubbles: true }));
  ok('확인 바 사라짐', b.$('confirm-bar').hidden === true);
  b.finish();
  ok('새 이름으로 전송', b.sent.length && b.sent[0].body[0].student_name === '새학생',
     b.sent.length ? b.sent[0].body[0].student_name : '(없음)');
}

console.log('\n── 1-4. 저장된 이름이 없으면 확인 바 없음 ──');
{
  const b = boot();
  ok('확인 바 숨김', b.$('confirm-bar').hidden === true);
}

console.log('\n── 1-5. 이름 공백 정규화 ──');
{
  const b = boot();
  b.$('who').value = '  김  민준  ';
  b.$('who').dispatchEvent(new b.window.Event('input', { bubbles: true }));
  b.$('wclass').value = b.$('wclass').options[1].value;
  b.$('wclass').dispatchEvent(new b.window.Event('change', { bubbles: true }));
  b.finish();
  ok('앞뒤·중복 공백 정리', b.sent.length && b.sent[0].body[0].student_name === '김 민준',
     b.sent.length ? JSON.stringify(b.sent[0].body[0].student_name) : '(없음)');
}

/* ── 2. 이름에 공백만 입력 ── */
console.log('\n── 2. 이름이 공백뿐일 때 ──');
{
  const b = boot();
  b.$('who').value = '   ';
  b.$('who').dispatchEvent(new b.window.Event('input', { bubbles: true }));
  b.$('wclass').value = b.$('wclass').options[1].value;
  b.$('wclass').dispatchEvent(new b.window.Event('change', { bubbles: true }));
  b.finish();
  ok('공백 이름은 전송하지 않음', b.sent.length === 0, b.sent.length + '건');
}

/* ── 3. 한글 상태에서 기호를 치면 경고가 사라지는가 ── */
console.log('\n── 3. 한글 모드에서 기호 입력 ──');
{
  const b = boot();
  b.type('ㅅㅍ');
  ok('한글 경고 표시', !b.$('guard').hidden);
  b.type('(');            // 한글 모드에서도 괄호는 그대로 들어온다
  ok('기호로는 경고가 풀리지 않음', b.$('guard').hidden === false,
     'guard.hidden=' + b.$('guard').hidden);
  b.type('(0');           // 숫자도 마찬가지
  ok('숫자로도 풀리지 않음', b.$('guard').hidden === false);
  b.type('s');            // 영문 글자가 오면 그때 해제
  ok('영문 글자가 오면 해제', b.$('guard').hidden === true);
}

/* ── 4. 이름 입력칸에서 CapsLock 을 쓰면 ── */
console.log('\n── 4. 이름칸에서 CapsLock ──');
{
  const b = boot();
  const e = new b.window.KeyboardEvent('keydown', { key: 'A', bubbles: true });
  e.getModifierState = k => k === 'CapsLock';
  b.$('who').dispatchEvent(e);
  ok('이름칸의 CapsLock 은 연습 패드를 잠그지 않음', !b.$('pad').classList.contains('locked'),
     'locked=' + b.$('pad').classList.contains('locked'));
  const e2 = new b.window.KeyboardEvent('keydown', { key: 'A', bubbles: true });
  e2.getModifierState = k => k === 'CapsLock';
  b.$('field').dispatchEvent(e2);
  ok('연습 패드에서는 정상 감지', b.$('pad').classList.contains('locked'));
}

/* ── 5. 전부 건너뛰기 ── */
console.log('\n── 5. 한 글자도 안 치고 전부 건너뛰기 ──');
{
  const b = boot();
  for (let i = 0; i < 20; i++) b.$('skip').dispatchEvent(new b.window.MouseEvent('click', { bubbles: true }));
  ok('무한 루프/예외 없이 처리', true);
  ok('결과 화면이 뜨지 않거나 정상값', !b.$('result').classList.contains('on') || /^\d+$/.test(b.$('r-kpm').textContent),
     'kpm=' + b.$('r-kpm').textContent);
}

/* ── 6. 매우 짧은 시간 완주 → 타수 상한 ── */
console.log('\n── 6. 순간 완주 시 타수 ──');
{
  const b = boot();
  b.finish();
  const kpm = parseInt(b.$('r-kpm').textContent, 10);
  ok('타수가 2000 이하로 묶임', kpm <= 2000, String(kpm));
  ok('타수가 음수/NaN 아님', kpm >= 0 && !isNaN(kpm), String(kpm));
}

/* ── 7. localStorage 손상 ── */
console.log('\n── 7. 저장 데이터가 깨졌을 때 ──');
{
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  dom.window.localStorage.setItem('vtl.v1', '{깨진 JSON');
  dom.window.fetch = () => Promise.resolve({ ok: true, status: 201, text: () => Promise.resolve('') });
  let threw = null;
  try { CODE.forEach(c => dom.window.eval(c)); } catch (e) { threw = e; }
  ok('예외 없이 부팅', !threw, threw && threw.message);
  ok('문제 정상 로드', dom.window.document.getElementById('target').textContent.length > 0);
}

/* ── 8. 결과 화면 이름 표시 ── */
console.log('\n── 8. 결과 카드 이름 표시 ──');
{
  const b = boot();
  b.finish();
  ok('이름 없으면 이름줄 비어 있음', b.$('r-who').textContent === '', b.$('r-who').textContent);
  const b2 = boot({ seed: { name: '김민준', cls: '1-3', no: '10315', best: {}, records: [], badges: {}, cleared: {} } });
  b2.finish();
  ok('이름 있으면 결과에 표시', b2.$('r-who').textContent.includes('김민준'), b2.$('r-who').textContent);
  ok('결과 카드에 반 표시', b2.$('r-who').textContent.includes('1-3'), b2.$('r-who').textContent);
  ok('결과 카드에 학번 표시', b2.$('r-who').textContent.includes('10315'), b2.$('r-who').textContent);
}

/* ── 9. 업적: 삼단 완주 판정 시점 ── */
console.log('\n── 9. 삼단 완주 업적 ──');
{
  const b = boot();
  b.finish();                                        // LEVEL 1
  b.d.querySelectorAll('.lv')[1].dispatchEvent(new b.window.MouseEvent('click', { bubbles: true }));
  b.finish();                                        // LEVEL 2
  b.d.querySelectorAll('.lv')[2].dispatchEvent(new b.window.MouseEvent('click', { bubbles: true }));
  b.finish();                                        // LEVEL 3
  const got = [...b.d.querySelectorAll('.bg-item.got .n')].map(e => e.textContent);
  ok('세 단계 완주 후 "삼단 완주" 획득', got.includes('삼단 완주'), got.join(', '));
}

/* ── 10. 오프라인(sync 꺼짐) 동작 ── */
console.log('\n── 10. sync:false 일 때 ──');
{
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  let called = 0;
  dom.window.fetch = () => { called++; return Promise.resolve({ ok: true, status: 201, text: () => Promise.resolve('') }); };
  CODE.forEach((c, i) => dom.window.eval(SRCS[i].endsWith('config.js') ? c.replace('sync: true', 'sync: false') : c));
  const $ = id => dom.window.document.getElementById(id);
  ok('반 선택칸 숨김', $('wclass-wrap').style.display === 'none');
  ok('학번칸 숨김', $('wno-wrap').style.display === 'none');
  ok('개인정보 문구가 오프라인용', $('privacy').textContent.includes('브라우저에만'), $('privacy').textContent);
  const cur = () => Array.from($('target').querySelectorAll('span')).filter(s => !s.classList.contains('sp')).map(s => s.textContent).join('');
  let g = 0;
  while (!$('result').classList.contains('on') && g++ < 80) { const c = cur(); if (!c) break; $('field').value = c; $('field').dispatchEvent(new dom.window.Event('input', { bubbles: true })); }
  ok('완주 정상', $('result').classList.contains('on'));
  ok('네트워크 호출 없음', called === 0, called + '회');
}

console.log('\n════════════════════════════');
console.log(`  통과 ${pass} · 실패 ${fail}`);
console.log('════════════════════════════\n');
// jsdom 의 setInterval 이 남아 프로세스가 안 끝나므로 명시적으로 종료한다
process.exit(fail ? 1 : 0);
