/* ============================================================
   교사용 대시보드 헤드리스 테스트
   Supabase Auth / REST 를 스텁으로 대체해 로직만 검증한다.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, x) => c ? (pass++, console.log('  PASS  ' + n))
                          : (fail++, console.log('  FAIL  ' + n + (x ? '  → ' + x : '')));

const ROWS = [
  { created_at: '2026-08-20T01:00:00Z', class_code: '1-3', student_name: '김민준', student_no: '10315', level_id: 'words',   level_name: '낱말',       grade: 'B', kpm: 168, accuracy: 96, errors: 3,  best_combo: 52,  seconds: 34, chars: 95 },
  { created_at: '2026-08-20T01:10:00Z', class_code: '1-3', student_name: '김민준', student_no: '10315', level_id: 'symbols', level_name: '기호 섞기',  grade: 'C', kpm: 122, accuracy: 91, errors: 9,  best_combo: 24,  seconds: 61, chars: 124 },
  { created_at: '2026-08-20T02:00:00Z', class_code: '1-3', student_name: '이서연', student_no: '10308', level_id: 'words',   level_name: '낱말',       grade: 'A', kpm: 214, accuracy: 98, errors: 1,  best_combo: 88,  seconds: 27, chars: 96 },
  { created_at: '2026-08-20T02:20:00Z', class_code: '1-3', student_name: '이서연', student_no: '10308', level_id: 'lines',   level_name: '코드 한 줄', grade: 'B', kpm: 141, accuracy: 97, errors: 2,  best_combo: 63,  seconds: 88, chars: 207 },
  { created_at: '2026-08-20T03:00:00Z', class_code: '1-4', student_name: '박도윤', student_no: '10422', level_id: 'words',   level_name: '낱말',       grade: 'D', kpm: 74,  accuracy: 82, errors: 18, best_combo: 11,  seconds: 77, chars: 95 },
  { created_at: '2026-08-20T03:30:00Z', class_code: '1-4', student_name: '최지우', student_no: '10407', level_id: 'words',   level_name: '낱말',       grade: 'S', kpm: 271, accuracy: 99, errors: 1,  best_combo: 131, seconds: 21, chars: 95 }
];

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/teacher.html' });
const { window } = dom, d = window.document;
const $ = id => d.getElementById(id);

let lastAuthBody = null, restCalls = [];
window.alert = () => {};
window.confirm = () => true;     // 삭제 확인 대화상자
window.fetch = (url, opt) => {
  if (url.includes('/auth/v1/token')) {
    lastAuthBody = JSON.parse(opt.body);
    if (lastAuthBody.password === 'wrong') {
      return Promise.resolve({ ok: false, status: 400,
        json: () => Promise.resolve({ error_description: '아이디 또는 비밀번호가 올바르지 않습니다' }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ access_token: 'FAKE_TOKEN' }) });
  }
  restCalls.push({ url, headers: opt && opt.headers });
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ROWS) });
};

for (const rel of ['assets/js/config.js', 'assets/js/teacher.js']) {
  window.eval(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function submit() {
  $('login-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  return new Promise(r => setTimeout(r, 30));
}

(async () => {
  console.log('\n── 1. 초기 상태 ──');
  ok('로그인 화면 표시', !$('login').hidden);
  ok('대시보드 숨김', $('dash').hidden === true);
  ok('계정 만드는 법 안내 있음', $('login').textContent.includes('Auto Confirm'));

  console.log('\n── 2. 잘못된 비밀번호 ──');
  $('email').value = 'teacher@school.kr';
  $('pw').value = 'wrong';
  await submit();
  ok('오류 메시지 표시', $('login-err').textContent.length > 0, $('login-err').textContent);
  ok('대시보드 여전히 숨김', $('dash').hidden === true);

  console.log('\n── 3. 로그인 성공 ──');
  $('pw').value = 'correct-horse';
  await submit();
  ok('대시보드 표시', $('dash').hidden === false);
  ok('로그인 화면 숨김', $('login').hidden === true);
  ok('비밀번호 입력칸 비워짐 (화면에 남기지 않음)', $('pw').value === '');
  ok('토큰은 sessionStorage 에만', window.sessionStorage.getItem('vtl.teacher.token') === 'FAKE_TOKEN'
     && window.localStorage.getItem('vtl.teacher.token') === null);
  ok('REST 호출에 Bearer 토큰 사용',
     restCalls.length > 0 && restCalls[0].headers.Authorization === 'Bearer FAKE_TOKEN');
  ok('runs 를 최신순으로 조회', restCalls[0].url.includes('order=created_at.desc'), restCalls[0].url);

  console.log('\n── 4. 요약 카드 ──');
  const cards = [...d.querySelectorAll('.card .v')].map(e => e.textContent);
  ok('참여 학생 4명', cards[0].startsWith('4'), cards[0]);
  ok('총 기록 6판', cards[1].startsWith('6'), cards[1]);
  const avgKpm = Math.round(ROWS.reduce((a, r) => a + r.kpm, 0) / ROWS.length);
  ok('평균 타수 계산 정확', cards[2].startsWith(String(avgKpm)), cards[2] + ' vs ' + avgKpm);

  console.log('\n── 5. 학생별 요약 ──');
  const rows = [...$('t-summary').querySelectorAll('tbody tr')];
  ok('학생 4명 집계', rows.length === 4, rows.length + '행');
  const top = rows[0].querySelectorAll('td');
  ok('기본 정렬 = 최고 타수 내림차순 → 최지우', top[1].textContent === '최지우', top[1].textContent);
  ok('최고 타수 271', top[4].textContent === '271', top[4].textContent);
  ok('최고 등급 S 표시', rows[0].querySelector('.gr').textContent === 'S');
  const minjun = rows.find(r => r.querySelectorAll('td')[1].textContent === '김민준');
  ok('김민준 2판 집계', minjun.querySelectorAll('td')[3].textContent === '2');
  ok('김민준 최고 타수 168', minjun.querySelectorAll('td')[4].textContent === '168');
  ok('김민준 평균 정확도 94%', minjun.querySelectorAll('td')[5].textContent === '94%',
     minjun.querySelectorAll('td')[5].textContent);
  ok('김민준 단계 표시 2개 활성', minjun.querySelectorAll('.lvdot.on').length === 2);
  ok('낮은 정확도에 bad 표시', [...rows].some(r => r.querySelector('td.bad')));

  console.log('\n── 6. 필터 ──');
  $('f-class').value = '1-4';
  $('f-class').dispatchEvent(new window.Event('change', { bubbles: true }));
  ok('반 필터 → 2명', $('t-summary').querySelectorAll('tbody tr').length === 2);
  $('f-class').value = '';
  $('f-level').value = 'words';
  $('f-level').dispatchEvent(new window.Event('change', { bubbles: true }));
  ok('단계 필터 → 낱말 4판', $('run-cnt').textContent === '4판', $('run-cnt').textContent);
  $('f-level').value = '';
  $('f-level').dispatchEvent(new window.Event('change', { bubbles: true }));
  $('f-q').value = '이서연';
  $('f-q').dispatchEvent(new window.Event('input', { bubbles: true }));
  ok('이름 검색 → 1명', $('t-summary').querySelectorAll('tbody tr').length === 1);
  $('f-q').value = '10422';
  $('f-q').dispatchEvent(new window.Event('input', { bubbles: true }));
  ok('학번 검색 → 1명', $('t-summary').querySelectorAll('tbody tr').length === 1);
  $('f-q').value = '';
  $('f-q').dispatchEvent(new window.Event('input', { bubbles: true }));

  console.log('\n── 7. 정렬 ──');
  const th = [...$('t-summary').querySelectorAll('th')].find(e => e.dataset.k === 'student_name');
  th.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const names = [...$('t-summary').querySelectorAll('tbody tr')].map(r => r.querySelectorAll('td')[1].textContent);
  ok('이름 가나다순 정렬', names.join(',') === [...names].sort((a, b) => a.localeCompare(b, 'ko')).join(','), names.join(','));

  console.log('\n── 8. 최근 기록 표 ──');
  ok('6판 표시', $('t-runs').querySelectorAll('tbody tr').length === 6);
  ok('등급 배지 렌더', $('t-runs').querySelectorAll('.gr').length === 6);

  console.log('\n── 9-1. 명렬표 대조 (누가 아직 안 했나) ──');
  $('roster-toggle').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('명렬표 패널 열림', $('roster').hidden === false);
  $('f-class').value = '1-3';
  $('f-class').dispatchEvent(new window.Event('change', { bubbles: true }));
  $('roster-text').value = '김민준\n이서연\n한지호\n오세훈';
  $('roster-run').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const out = $('roster-out').textContent;
  ok('완료 인원 집계', out.includes('2') && out.includes('4'), out.slice(0, 60));
  const miss = [...$('roster-out').querySelectorAll('.ro-chip.miss')].map(e => e.textContent);
  ok('미완료 2명 정확히 식별', miss.length === 2 && miss.includes('한지호') && miss.includes('오세훈'),
     miss.join(', '));
  ok('완료 학생은 미완료에 없음', !miss.includes('김민준') && !miss.includes('이서연'));
  ok('명렬표는 localStorage 에만', window.localStorage.getItem('vtl.teacher.roster') !== null);

  console.log('\n── 9-2. 명렬표에 없는 이름 (오타 탐지) ──');
  $('roster-text').value = '김민준';
  $('roster-run').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const extra = [...$('roster-out').querySelectorAll('.ro-chip.extra')].map(e => e.textContent);
  ok('명렬표에 없는 이름을 따로 표시', extra.includes('이서연'), extra.join(', '));

  console.log('\n── 9-3. 쉼표·탭 구분도 허용 ──');
  $('roster-text').value = '김민준, 이서연,\t한지호';
  $('roster-run').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const miss2 = [...$('roster-out').querySelectorAll('.ro-chip.miss')].map(e => e.textContent);
  ok('구분자 혼용 처리', miss2.length === 1 && miss2[0] === '한지호', miss2.join(', '));
  $('f-class').value = '';
  $('f-class').dispatchEvent(new window.Event('change', { bubbles: true }));

  console.log('\n── 9-4. 기록 삭제 ──');
  ROWS.forEach((r, i) => { r.id = 'id-' + i; });
  restCalls = [];
  $('reload').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 30));
  const delBtns = $('t-runs').querySelectorAll('.del');
  ok('행마다 삭제 버튼', delBtns.length === 6, delBtns.length + '개');
  let deleteReq = null;
  const prevFetch = window.fetch;
  window.fetch = (url, opt) => {
    if (opt && opt.method === 'DELETE') { deleteReq = { url, opt }; return Promise.resolve({ ok: true, status: 204 }); }
    return prevFetch(url, opt);
  };
  delBtns[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 30));
  ok('DELETE 요청 전송', !!deleteReq, deleteReq && deleteReq.url);
  ok('id 로 정확히 지정', deleteReq && deleteReq.url.includes('id=eq.id-'), deleteReq && deleteReq.url);
  ok('Bearer 토큰 사용', deleteReq && deleteReq.opt.headers.Authorization === 'Bearer FAKE_TOKEN');
  ok('표에서 즉시 사라짐', $('t-runs').querySelectorAll('tbody tr').length === 5,
     $('t-runs').querySelectorAll('tbody tr').length + '행');
  window.fetch = prevFetch;

  console.log('\n── 9. 로그아웃 ──');
  $('logout').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('로그인 화면 복귀', !$('login').hidden && $('dash').hidden === true);
  ok('토큰 삭제됨', window.sessionStorage.getItem('vtl.teacher.token') === null);

  console.log(`\n  통과 ${pass} · 실패 ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
