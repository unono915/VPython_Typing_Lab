/* ============================================================
   VPython Typing Lab — 엔진
   의존성 없음 · file:// 에서도 동작 (ES Module 사용 안 함)
   ============================================================ */
(function () {
  'use strict';

  var LEVELS = TYPING_DATA.levels;
  var BADGES = TYPING_DATA.badges;
  var STORE_KEY = 'vtl.v1';
  var MAX_RECORDS = 12;

  /* ── 저장소 ───────────────────────────────────────── */
  var store = load();

  function load() {
    var blank = { name: '', best: {}, records: [], badges: {}, cleared: {} };
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return blank;
      var o = JSON.parse(raw);
      return {
        name: o.name || '',
        best: o.best || {},
        records: o.records || [],
        badges: o.badges || {},
        cleared: o.cleared || {}
      };
    } catch (e) {
      return blank;
    }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* 사생활 보호 모드 등 */ }
  }

  /* ── DOM ──────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  var field = $('field'), pad = $('pad'), targetEl = $('target'), nextEl = $('next'),
      tapmsg = $('tapmsg'), progbar = $('progbar'),
      comboEl = $('combo'), comboN = $('combo-n'),
      sKpm = $('s-kpm'), sAcc = $('s-acc'), sPrg = $('s-prg'), sTm = $('s-tm'),
      resultEl = $('result'), whoInput = $('who');

  /* ── 상태 ─────────────────────────────────────────── */
  var lv = 0, queue = [], idx = 0, target = '', prevLen = 0,
      started = 0, timer = null,
      doneChars = 0, keys = 0, errs = 0, errMap = {},
      combo = 0, bestCombo = 0, wrongItems = [], itemHadError = false;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function charLabel(c) {
    if (c === ' ') return '공백';
    if (c === undefined) return '초과';
    return esc(c);
  }

  /* ── 단계 UI ──────────────────────────────────────── */
  var levelsNav = $('levels');
  function paintLevels() {
    levelsNav.innerHTML = '';
    LEVELS.forEach(function (L, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lv' + (i === lv ? ' on' : '');
      b.setAttribute('aria-pressed', i === lv ? 'true' : 'false');
      var best = store.best[L.id];
      b.innerHTML =
        '<span class="k">LEVEL ' + (i + 1) + '</span>' +
        '<b>' + esc(L.name) + '</b>' +
        '<span class="h">' + esc(L.hint) + '</span>' +
        '<span class="lvrec">' + (best
          ? '최고 <b>' + best.kpm + '타</b> · ' + best.grade
          : '기록 없음') + '</span>';
      b.addEventListener('click', function () { start(i); });
      levelsNav.appendChild(b);
    });
  }

  /* ── 렌더 ─────────────────────────────────────────── */
  function render() {
    var typed = field.value, html = '';
    for (var i = 0; i < target.length; i++) {
      var ch = target[i], cls;
      if (i < typed.length) cls = (typed[i] === ch) ? 'ok' : 'bad';
      else if (i === typed.length) cls = 'cur';
      else cls = 'todo';
      html += '<span class="' + cls + '">' +
              (ch === ' ' ? '<span class="sp"> </span>' : esc(ch)) +
              '</span>';
    }
    if (typed.length > target.length) {
      html += '<span class="bad">' + esc(typed.slice(target.length)) + '</span>';
    }
    targetEl.innerHTML = html;
    progbar.style.width = Math.min(100, typed.length / target.length * 100) + '%';
  }

  function loadItem() {
    target = queue[idx];
    field.value = '';
    prevLen = 0;
    itemHadError = false;
    render();
    nextEl.innerHTML = (idx + 1 < queue.length)
      ? '다음 &nbsp;<b>' + esc(queue[idx + 1]) + '</b>'
      : '<b>마지막 문제입니다</b>';
    sPrg.innerHTML = idx + '<i> / ' + queue.length + '</i>';
  }

  /* ── 콤보 ─────────────────────────────────────────── */
  function paintCombo() {
    comboN.textContent = combo;
    comboEl.className = 'combo' +
      (combo >= 3 ? ' show' : '') +
      (combo >= 100 ? ' t4' : combo >= 50 ? ' t3' : combo >= 25 ? ' t2' : combo >= 10 ? ' t1' : '');
    if (combo >= 3) {
      comboEl.classList.add('pulse');
      setTimeout(function () { comboEl.classList.remove('pulse'); }, 220);
    }
  }
  function breakCombo() {
    combo = 0;
    paintCombo();
    pad.classList.add('shake');
    setTimeout(function () { pad.classList.remove('shake'); }, 220);
  }

  /* ── 지표 ─────────────────────────────────────────── */
  function tick() {
    if (!started) return;
    var sec = (Date.now() - started) / 1000;
    sTm.innerHTML = Math.round(sec) + '<i>초</i>';
    var min = sec / 60;
    sKpm.textContent = min > 0.02 ? Math.round(doneChars / min) : 0;
  }
  function accuracy() {
    return keys > 0 ? Math.round((keys - errs) / keys * 100) : 100;
  }
  function paintAcc() {
    var a = accuracy();
    sAcc.innerHTML = a + '<i>%</i>';
    sAcc.parentElement.className = 'st' + (keys > 4 ? (a >= 95 ? ' good' : (a < 85 ? ' bad' : '')) : '');
  }

  /* ── 입력 ─────────────────────────────────────────── */
  field.addEventListener('input', function () {
    if (!started) {
      started = Date.now();
      timer = setInterval(tick, 200);
      tapmsg.classList.add('hide');
    }
    var typed = field.value;

    // 새로 친 글자만 채점한다 (백스페이스는 세지 않음)
    if (typed.length > prevLen) {
      for (var i = prevLen; i < typed.length; i++) {
        keys++;
        if (typed[i] === target[i]) {
          combo++;
          if (combo > bestCombo) bestCombo = combo;
        } else {
          errs++;
          itemHadError = true;
          errMap[target[i]] = (errMap[target[i]] || 0) + 1;
          breakCombo();
        }
      }
      if (combo > 0) paintCombo();
    }
    prevLen = typed.length;
    render();
    paintAcc();

    if (typed === target) {
      doneChars += target.length;
      if (itemHadError) wrongItems.push(target);
      idx++;
      if (idx >= queue.length) finish();
      else loadItem();
    }
  });

  // 붙여넣으면 연습이 성립하지 않는다
  field.addEventListener('paste', function (e) { e.preventDefault(); });

  /* ── 등급 ─────────────────────────────────────────── */
  function gradeOf(kpm, acc, par) {
    var g;
    if (kpm >= par[0]) g = 'S';
    else if (kpm >= par[1]) g = 'A';
    else if (kpm >= par[2]) g = 'B';
    else if (kpm >= par[3]) g = 'C';
    else g = 'D';

    // 정확도 게이트 — 빨라도 부정확하면 등급이 막힌다
    var order = ['D', 'C', 'B', 'A', 'S'];
    var cap = acc < 80 ? 'C' : acc < 90 ? 'B' : acc < 95 ? 'A' : 'S';
    if (order.indexOf(g) > order.indexOf(cap)) g = cap;
    return g;
  }

  function verdict(g, acc) {
    if (acc < 85) return '정확도부터 올리세요. 속도는 그다음입니다.';
    if (acc < 95) return '괜찮습니다. 정확도 95%를 목표로 하세요.';
    if (g === 'S') return '완벽합니다. 다음 단계로 넘어가세요.';
    if (g === 'A') return '정확합니다. 이제 속도를 올려도 됩니다.';
    return '정확도는 좋습니다. 손가락이 자리를 외울 때까지 반복하세요.';
  }

  /* ── 완료 ─────────────────────────────────────────── */
  function finish() {
    clearInterval(timer); timer = null;
    var L = LEVELS[lv];
    var sec = (Date.now() - started) / 1000;
    var kpm = Math.round(doneChars / (sec / 60));
    var acc = accuracy();
    var grade = gradeOf(kpm, acc, L.par);

    var r = {
      kpm: kpm, acc: acc, errors: errs, seconds: Math.round(sec),
      bestCombo: bestCombo, levelId: L.id, chars: doneChars, grade: grade
    };

    store.cleared[L.id] = true;

    // 신기록 판정
    var prevBest = store.best[L.id];
    var isNew = !prevBest || kpm > prevBest.kpm;
    if (isNew) store.best[L.id] = { kpm: kpm, acc: acc, grade: grade };

    store.records.unshift({
      lv: L.name, grade: grade, kpm: kpm, acc: acc,
      at: new Date().toISOString()
    });
    store.records = store.records.slice(0, MAX_RECORDS);

    var earned = [];
    BADGES.forEach(function (b) {
      if (store.badges[b.id]) return;
      if (b.test(r, store)) { store.badges[b.id] = true; earned.push(b); }
    });
    save();

    // ── 화면 ──
    var gradeBox = $('grade');
    gradeBox.dataset.g = grade;
    $('grade-l').textContent = grade;
    $('newrec').className = 'newrec' + (isNew && prevBest ? ' on' : '');
    $('r-title').textContent = 'LEVEL ' + (lv + 1) + ' · ' + L.name + ' 완주';
    $('r-sub').textContent = verdict(grade, acc);
    $('r-who').textContent = store.name ? store.name + ' · ' + new Date().toLocaleDateString('ko-KR') : '';

    $('r-kpm').textContent = kpm;
    $('r-kpm-best').textContent = store.best[L.id] ? '최고 ' + store.best[L.id].kpm : '';
    $('r-acc').textContent = acc + '%';
    $('r-combo').textContent = bestCombo;
    $('r-err').textContent = errs;

    // 오타 문자 TOP 5
    var pairs = Object.keys(errMap)
      .map(function (k) { return [k, errMap[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 5);
    var w = $('worst');
    if (!pairs.length) {
      w.innerHTML = '<b>한 번도 안 틀렸습니다.</b> 다음 단계로 가세요.';
    } else {
      w.innerHTML = '<b>가장 많이 틀린 문자</b> — ' + pairs.map(function (p) {
        return '<code>' + charLabel(p[0]) + '</code>' + p[1] + '번';
      }).join(' ') +
      '<span class="tip">이 문자들만 따로 몇 번 더 쳐 보세요. 기호가 위에 올라왔다면 정상입니다 — 다들 거기서 막힙니다.</span>';
    }

    $('earned').innerHTML = earned.map(function (b) {
      return '<span>' + b.icon + ' ' + esc(b.name) + ' 획득</span>';
    }).join('');

    $('retry-wrong').hidden = wrongItems.length === 0;
    var hasNext = lv + 1 < LEVELS.length;
    var nb = $('next-level');
    nb.hidden = !hasNext;
    if (hasNext) nb.textContent = 'LEVEL ' + (lv + 2) + ' 도전';

    resultEl.classList.add('on');
    sPrg.innerHTML = queue.length + '<i> / ' + queue.length + '</i>';
    paintLevels(); paintBadges(); paintRecords();
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ── 시작 ─────────────────────────────────────────── */
  function reset() {
    clearInterval(timer); timer = null;
    idx = 0; started = 0; doneChars = 0; keys = 0; errs = 0; errMap = {};
    combo = 0; bestCombo = 0; prevLen = 0; wrongItems = []; itemHadError = false;
    sKpm.textContent = '0';
    sAcc.innerHTML = '100<i>%</i>';
    sAcc.parentElement.className = 'st';
    sTm.innerHTML = '0<i>초</i>';
    comboEl.className = 'combo';
    resultEl.classList.remove('on');
    tapmsg.classList.remove('hide');
  }

  function start(newLv, customQueue) {
    if (typeof newLv === 'number') lv = newLv;
    reset();
    var L = LEVELS[lv];
    queue = customQueue && customQueue.length
      ? shuffle(customQueue)
      : shuffle(L.items).slice(0, Math.min(L.count, L.items.length));
    paintLevels();
    loadItem();
    field.focus();
  }

  /* ── 업적 / 기록 ──────────────────────────────────── */
  function paintBadges() {
    $('badges').innerHTML = BADGES.map(function (b) {
      var got = !!store.badges[b.id];
      return '<div class="bg-item' + (got ? ' got' : '') + '">' +
        '<span class="ic">' + b.icon + '</span>' +
        '<span><span class="n">' + esc(b.name) + '</span>' +
        '<span class="d">' + esc(b.desc) + '</span></span></div>';
    }).join('');
  }

  function paintRecords() {
    var el = $('records');
    if (!store.records.length) {
      el.innerHTML = '<div class="rec-empty">아직 기록이 없습니다. 한 판 쳐 보세요.</div>';
      return;
    }
    el.innerHTML = store.records.map(function (r) {
      var d = new Date(r.at);
      var when = (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
                 String(d.getHours()).padStart(2, '0') + ':' +
                 String(d.getMinutes()).padStart(2, '0');
      return '<div class="rec">' +
        '<span class="g">' + r.grade + '</span>' +
        '<span class="lv">' + esc(r.lv) + '</span>' +
        '<span class="m">' + r.kpm + '타 · ' + r.acc + '%</span>' +
        '<span class="t">' + when + '</span></div>';
    }).join('');
  }

  /* ── 조작 ─────────────────────────────────────────── */
  $('restart').addEventListener('click', function () { start(); });
  $('again').addEventListener('click', function () { start(); });
  $('retry-wrong').addEventListener('click', function () {
    var items = wrongItems.slice();
    start(lv, items);
  });
  $('next-level').addEventListener('click', function () {
    if (lv + 1 < LEVELS.length) start(lv + 1);
  });
  $('skip').addEventListener('click', skipItem);

  function skipItem() {
    if (idx >= queue.length) return;
    wrongItems.push(target);
    idx++;
    if (idx >= queue.length) {
      if (!started) { start(); return; }   // 한 글자도 안 친 채 전부 건너뛴 경우
      finish();
    } else loadItem();
    field.focus();
  }

  $('clear-rec').addEventListener('click', function () {
    if (!confirm('저장된 기록과 업적을 모두 지웁니다. 계속할까요?')) return;
    store = { name: store.name, best: {}, records: [], badges: {}, cleared: {} };
    save(); paintLevels(); paintBadges(); paintRecords();
  });

  whoInput.value = store.name;
  whoInput.addEventListener('input', function () {
    store.name = whoInput.value.trim().slice(0, 12);
    save();
  });

  pad.addEventListener('click', function () { field.focus(); });
  field.addEventListener('focus', function () { pad.classList.add('focus'); });
  field.addEventListener('blur', function () { pad.classList.remove('focus'); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); skipItem(); return; }
    if (e.target === field) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key.length === 1 || e.key === 'Backspace') field.focus();
  });

  /* ── 부팅 ─────────────────────────────────────────── */
  paintBadges();
  paintRecords();
  start(0);
})();
