/* ============================================================
   기록 전송 — 익명 INSERT 전용

   서버가 죽어 있든, 인터넷이 없든, 설정이 꺼져 있든
   **연습 자체는 절대 방해받지 않는다.** 전송은 부수 효과일 뿐이다.
   ============================================================ */
var TLSync = (function () {
  'use strict';

  var cfg = (typeof TL_CONFIG !== 'undefined') ? TL_CONFIG : null;
  var QUEUE_KEY = 'vtl.pending';

  function enabled() {
    return !!(cfg && cfg.sync && cfg.supabaseUrl && cfg.supabaseKey);
  }

  /* 전송 실패한 기록을 모아 뒀다가 다음 기회에 다시 보낸다.
     실습실 와이파이가 끊겼다 붙는 상황을 위한 것. */
  function queue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function setQueue(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-50))); }
    catch (e) { /* localStorage 가 막힌 환경 */ }
  }

  function post(rows) {
    return fetch(cfg.supabaseUrl + '/rest/v1/runs', {
      method: 'POST',
      headers: {
        'apikey': cfg.supabaseKey,
        'Authorization': 'Bearer ' + cfg.supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(rows)
    }).then(function (res) {
      if (res.ok) return true;
      return res.text().then(function (t) {
        var e = new Error(res.status + ' ' + t);
        // 4xx 는 이 데이터가 잘못된 것이므로 다시 보내봐야 소용없다.
        // 5xx·네트워크 오류만 재시도 대상으로 본다.
        e.permanent = res.status >= 400 && res.status < 500;
        throw e;
      });
    });
  }

  /* 밀린 기록을 먼저 털어낸다. 실패해도 조용히 넘어간다. */
  function flush() {
    if (!enabled()) return Promise.resolve(false);
    var q = queue();
    if (!q.length) return Promise.resolve(false);
    return post(q)
      .then(function () { setQueue([]); return true; })
      .catch(function (e) {
        // 서버가 거부한 데이터를 계속 붙들고 있으면 큐가 영영 안 비워진다.
        if (e && e.permanent) setQueue([]);
        return false;
      });
  }

  /**
   * 기록 1건 전송.
   * @returns Promise<'sent'|'queued'|'rejected'|'off'|'skipped'>
   */
  function send(row) {
    if (!enabled()) return Promise.resolve('off');
    if (!row.class_code || !row.student_name) return Promise.resolve('skipped');

    return post([row])
      .then(function () { flush(); return 'sent'; })
      .catch(function (e) {
        if (e && e.permanent) return 'rejected';   // 재시도해도 소용없음
        var q = queue(); q.push(row); setQueue(q);
        return 'queued';
      });
  }

  return {
    enabled: enabled,
    send: send,
    flush: flush,
    pending: function () { return queue().length; }
  };
})();
