/* ============================================================
   VPython Typing Lab — 문제 세트
   ------------------------------------------------------------
   ★ 선생님이 고치는 파일은 여기 하나입니다.
     아래 목록에 문자열을 넣고 빼면 그대로 문제가 됩니다.
     따옴표와 쉼표만 지키면 됩니다.

     예)  'sphere',        ← 한 줄이 문제 하나
   ------------------------------------------------------------
   주의: 작은따옴표(')가 들어간 문자열은 큰따옴표로 감싸세요.
         예)  "scene.title = 'hello'",
   ============================================================ */

var TYPING_DATA = {

  /* 레벨 정의 --------------------------------------------------
     name   : 화면에 보이는 이름
     hint   : 부제 (예시 몇 개)
     count  : 한 판에 출제할 문항 수
     par    : 등급 기준 타수 [S, A, B, C]
  ------------------------------------------------------------ */
  levels: [
    {
      id: 'words',
      name: '낱말',
      hint: 'sphere · vector · rate',
      count: 12,
      par: [260, 200, 150, 100],
      items: [
        'sphere', 'box', 'cylinder', 'arrow', 'curve', 'ring', 'cone',
        'vector', 'vec', 'color', 'pos', 'size', 'radius', 'axis',
        'length', 'height', 'width', 'opacity', 'shininess',
        'rate', 'scene', 'background', 'range', 'center', 'trail',
        'velocity', 'gravity', 'canvas', 'label', 'graph',
        'while', 'True', 'False', 'import', 'from', 'def', 'return',
        'print', 'input', 'float', 'round',
        'red', 'green', 'blue', 'yellow', 'white', 'black',
        'cyan', 'magenta', 'orange', 'purple', 'gray'
      ]
    },

    {
      id: 'symbols',
      name: '기호 섞기',
      hint: 'color.red · vec(0,0,0)',
      count: 10,
      par: [200, 155, 115, 75],
      items: [
        'color.red', 'color.blue', 'color.white', 'color.yellow',
        'color.gray(0.6)', 'color.cyan',
        'vec(0,0,0)', 'vec(1,0,0)', 'vec(0,-9.8,0)', 'vec(2,2,2)',
        'rate(100)', 'rate(200)', 'rate(60)',
        'scene.range', 'scene.center', 'scene.background',
        'make_trail=True', 'retain=50',
        'pos=vec(0,0,0)', 'axis=vec(5,0,0)', 'size=vec(2,2,2)',
        'radius=0.5', 'radius=1', 'opacity=0.5', 'shininess=0',
        'while True:', 'ball.pos', 'ball.velocity', 'ball.radius',
        'dt = 0.01', 'g = 9.8', 't = 0',
        'from vpython import *'
      ]
    },

    {
      id: 'lines',
      name: '코드 한 줄',
      hint: 'ball = sphere(radius=1)',
      count: 8,
      par: [170, 130, 95, 60],
      items: [
        'ball = sphere(radius=1)',
        'ball = sphere(pos=vec(0,0,0), radius=1)',
        'floor = box(size=vec(10,0.2,4))',
        'floor = box(color=color.gray(0.7))',
        'scene.background = color.white',
        'scene.range = 15',
        'g = vector(0, -9.8, 0)',
        'ball.pos = ball.pos + v*dt',
        'v = v + g*dt',
        'ball = sphere(color=color.red, make_trail=True)',
        'arrow(axis=vec(5,0,0), color=color.blue)',
        'wall = box(pos=vec(6,0,0), size=vec(0.4,8,4))',
        'while True:',
        '    rate(200)',
        '    ball.pos = ball.pos + v*dt',
        'if ball.pos.y < 0:',
        '    v.y = -v.y * 0.8'
      ]
    }
  ],

  /* 업적 -------------------------------------------------------
     test(r) 가 true 를 돌려주면 획득.
     r = { kpm, acc, errors, seconds, bestCombo, levelId, chars }
  ------------------------------------------------------------ */
  badges: [
    { id: 'first',   icon: '🎯', name: '첫 타',       desc: '한 판 끝까지 완주',
      test: function (r) { return true; } },
    { id: 'perfect', icon: '💎', name: '무결점',      desc: '오타 없이 완주',
      test: function (r) { return r.errors === 0; } },
    { id: 'combo50', icon: '🔥', name: '콤보 50',     desc: '연속 정타 50',
      test: function (r) { return r.bestCombo >= 50; } },
    { id: 'combo100',icon: '⚡', name: '콤보 100',    desc: '연속 정타 100',
      test: function (r) { return r.bestCombo >= 100; } },
    { id: 'fast',    icon: '🚀', name: '속사',        desc: '타수 200 돌파',
      test: function (r) { return r.kpm >= 200; } },
    { id: 'sniper',  icon: '🎖️', name: '정밀',        desc: '정확도 98% 이상',
      test: function (r) { return r.acc >= 98; } },
    { id: 'symbol',  icon: '🧩', name: '기호 사냥꾼', desc: '기호·코드 단계를 오타 3회 이하로',
      test: function (r) { return r.levelId !== 'words' && r.errors <= 3; } },
    { id: 'allthree',icon: '👑', name: '삼단 완주',   desc: '세 단계를 모두 완주',
      test: function (r, store) {
        var done = store.cleared || {};
        return done.words && done.symbols && done.lines;
      } }
  ]
};
