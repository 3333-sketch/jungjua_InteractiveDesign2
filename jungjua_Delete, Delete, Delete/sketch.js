// 레벨 1: 탭        → 말미잘 사이의 니모를 누르면 뿅 사라짐
// 레벨 2: 스와이프   → 스와이프 방향에서 파도가 3번 쳐서 화면 밖으로 날아감
// 레벨 3: 길게 누르기 → 말미잘을 꾹 누르는 동안 가족이 모이고, 전부 모이면 다 같이 떠남 (다 모이기 전에 손 떼면 안 사라짐)

const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Composite = Matter.Composite;
const Body = Matter.Body;

let engine;
let level = 1;
let nemo = null; // 니모 (Fish 객체)
let anemones = []; // 말미잘
let curtain = []; // 레벨 1: 말미잘 커튼
let pops = []; // 뿅 효과

// 레벨 2
let waves = [];
let startX = 0;
let startY = 0;
let swiping = false; // 레벨 2에서 화면을 누르기 시작했는지

// 레벨 3
let family = []; // 가족 물고기들
let holding = false; // 말미잘을 누르고 있는지
let leaving = false; // 다 같이 떠나는 중인지
let spawnTimer = 0;
let gatherX, gatherY; // 가족이 모이는 곳
const GOAL = 10; // 모여야 하는 가족 수

function setup() {
  createCanvas(windowWidth, windowHeight);
  engine = Engine.create();
  engine.gravity.y = 0; // 물속이라 중력 없음
  startLevel(1);
}

function draw() {
  background(10, 35, 70);
  Engine.update(engine);

  if (level === 1) drawLevel1();
  if (level === 2) drawLevel2();
  if (level === 3) drawLevel3();

  drawPops();
  drawLevelNumbers();
}

// 레벨 시작 (초기화)
function startLevel(n) {
  level = n;
  Composite.clear(engine.world, false);
  nemo = null;
  anemones = [];
  curtain = [];
  pops = [];
  waves = [];
  family = [];
  holding = false;
  leaving = false;
  swiping = false;

  if (level === 1) {
    // 말미잘 커튼 1줄: 굵은 곡선 12개, 사이 간격 랜덤
    // 순서: 뒤, 뒤, 앞 반복 (앞 곡선은 니모를 가림)
    let n = 12;
    let thick = (width / 13) * 1.15; // 곡선 굵기
    // 간격을 랜덤하게 정한 뒤, 전체가 화면 너비에 맞도록 맞춤
    let gaps = [];
    let total = 0;
    for (let i = 0; i < n; i++) {
      let g = random(0.5, 1.5);
      gaps.push(g);
      total += g;
    }
    let x = 0;
    for (let i = 0; i < n; i++) {
      let g = (gaps[i] / total) * width;
      curtain.push({
        x: x + g / 2, // 뿌리 위치 (화면 아래)
        top: -random(0.15, 0.3) * height, // 끝은 화면 위 바깥 (안 보이게)
        w: thick,
        front: i % 3 === 2, // 니모보다 앞에 있는 곡선인지
        seed: random(TWO_PI),
      });
      x += g;
    }
    nemo = new Fish(width / 2, height / 2, 22, color(255, 120, 0));
  }

  if (level === 2) {
    anemones.push(makeAnemone(width * 0.2, height + 20, 120));
    let big = makeAnemone(width * 0.75, height + 30, 140);
    big.h *= 1.4; // 높이·너비
    big.weight *= 1.4; // 촉수 굵기
    big.tip *= 1.4; // 촉수 끝 동그라미
    big.swayAmp *= 1.4; // 흔들리는 폭
    big.c = lerpColor(big.c, color(255), 0.45); // 더 밝게
    anemones.push(big);
    nemo = new Fish(width / 2, height / 2, 40, color(255, 120, 0));
    nemo.autoFace = false;
    nemo.home = { x: width / 2, y: height / 2 };
    nemo.hits = 0; // 파도를 맞은 횟수
    nemo.swipes = 0; // 스와이프한 횟수
  }

  if (level === 3) {
    anemones.push(makeAnemone(width / 2, height + 20, 220));
    gatherX = width / 2;
    gatherY = height - 330;
    nemo = new Fish(gatherX, gatherY, 26, color(255, 120, 0));
    nemo.body.collisionFilter.group = -1;
  }
}

///////////////////////////// 레벨 1: 탭 → 즉시 삭제
function drawLevel1() {
  if (nemo) nemo.wander(60, 100, width - 60, height - 60, 2);
  drawCurtain(false); // 니모 뒤의 곡선들
  if (nemo) nemo.display();
  drawCurtain(true); // 니모 앞의 곡선들
}

// 말미잘 커튼 일렁임
// front가 true면 앞 곡선만, false면 뒤 곡선만 그림
const CURTAIN_COLOR = [165, 212, 232]; // 레벨 1 커튼 색
function drawCurtain(front) {
  let segs = 40; // 곡선 이루는 점 개수
  let c = color(CURTAIN_COLOR);
  let [c1, c2] = twoTone(c); // 아래 색, 위 색
  noFill();
  for (let i = 0; i < curtain.length; i++) {
    let s = curtain[i];
    if (s.front !== front) continue;
    let pts = [];
    for (let j = 0; j <= segs; j++) {
      let t = j / segs; // 0: 뿌리, 1: 끝
      // 물결이 아래에서 위로 타고 올라가고, 끝으로 갈수록 크게 흔들림
      let wave = sin(frameCount * 0.025 + s.seed * 0.3 + i * 0.35 - t * 5.4);
      let x = s.x + wave * s.w * 0.6 * pow(t, 1.3);
      let y = lerp(height + s.w, s.top, t);
      pts.push({ x: x, y: y });
    }
    // 테두리
    stroke(lerpColor(c, color(10, 35, 70), 0.45));
    strokeWeight(s.w + 6);
    beginShape();
    for (let pt of pts) vertex(pt.x, pt.y);
    endShape();
    // 몸: 아래서 위로 그라데이션
    gradientLine(pts, c1, c2, s.w, 1);
  }
}

// 투톤 그라데이션 색: 아래는 조금 깊은 푸른색, 위는 밝게
function twoTone(c) {
  let bottom = lerpColor(c, color(60, 110, 170), 0.3);
  let top = lerpColor(c, color(255), 0.25);
  return [bottom, top];
}

// 점들을 이으면서 색을 c1(아래) → c2(위)로 조금씩 바꿔 그리기
// sub: 한 구간을 몇 조각으로 나눠 색을 바꿀지 
function gradientLine(pts, c1, c2, w, sub) {
  strokeWeight(w);
  let total = (pts.length - 1) * sub;
  let k = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    let p = pts[i];
    let q = pts[i + 1];
    for (let m = 0; m < sub; m++) {
      let t1 = m / sub;
      let t2 = (m + 1) / sub;
      stroke(lerpColor(c1, c2, k / total));
      line(lerp(p.x, q.x, t1), lerp(p.y, q.y, t1), lerp(p.x, q.x, t2), lerp(p.y, q.y, t2));
      k++;
    }
  }
}

///////////////////////////// 레벨 2: 스와이프 한 번 → 파도 3번
function drawLevel2() {
  for (let a of anemones) drawAnemone(a, false);

  // 파도
  for (let w of waves) {
    w.update();
    w.display();
  }
  for (let i = waves.length - 1; i >= 0; i--) {
    if (waves[i].done) waves.splice(i, 1);
  }

  if (nemo) {
    let b = nemo.body;
    if (nemo.swipes === 0) {
      // 스와이프 전: 약한 물살에 좌우로 쓸렸다 돌아오기 (옆으로 밀어보라는 힌트)
      let t = frameCount * 0.03;
      nemo.swimTo(nemo.home.x + sin(t) * 70, nemo.home.y, 3);
      let tilt = cos(t) * 0.15; // 쓸리는 방향으로 몸이 살짝 기울어짐
      Body.setAngularVelocity(b, b.angularVelocity * 0.8 + (tilt - b.angle) * 0.05);
    } else if (nemo.hits < 3) {
      // 아직 버티는 상태
      Body.applyForce(b, b.position, {
        x: (nemo.home.x - b.position.x) * 0.00001 * b.mass,
        y: (nemo.home.y - b.position.y) * 0.00001 * b.mass,
      });
      Body.setAngularVelocity(b, b.angularVelocity * 0.9 - b.angle * 0.02);
    }
    nemo.display();

    if (nemo.isOffscreen()) {
      nemo.remove();
      nemo = null;
    }
  }
}

// 파도 클래스
class Wave {
  constructor(dx, dy, power, delay) {
    this.dx = dx; // 파도 방향
    this.dy = dy;
    this.power = power; // 니모를 미는 힘
    this.delay = delay; // 몇 프레임 뒤에 시작할지
    // 파도가 시작되는 곳: 니모 뒤쪽, 화면 밖
    let far = max(width, height);
    this.ox = nemo.pos.x - dx * far;
    this.oy = nemo.pos.y - dy * far;
    this.r = 0;
    this.hit = false;
    this.done = false;
  }

  update() {
    if (this.delay > 0) {
      this.delay--;
      return;
    }
    this.r += 20; // 파도 퍼지는 속도

    // 물결이 니모에 닿는 순간 한 번 밀기
    if (nemo && !this.hit) {
      let d = dist(this.ox, this.oy, nemo.pos.x, nemo.pos.y);
      if (this.r >= d) {
        this.hit = true;
        let b = nemo.body;
        Body.applyForce(b, b.position, {
          x: this.dx * this.power * b.mass,
          y: this.dy * this.power * b.mass,
        });
        nemo.hits++;
        Body.setAngularVelocity(b, random([-1, 1]) * nemo.hits * 0.12);
        if (nemo.hits >= 3) b.frictionAir = 0.005; // 마지막 파도: 멀리 날아가도록
      }
    }
    if (this.r > max(width, height) * 3) this.done = true;
  }

  display() {
    if (this.delay > 0) return;
    noFill();
    for (let i = 0; i < 3; i++) {
      stroke(180, 220, 255, 160 - i * 50);
      strokeWeight(6 - i * 2);
      circle(this.ox, this.oy, (this.r - i * 25) * 2);
    }
  }
}

///////////////////////////// 레벨 3: 길게 누르기 → 12(니모+도리+가족10마리)마리가 모이면 함께 떠남
function drawLevel3() {
  let a = anemones[0];

  // 누르는 동안 가족이 한 마리씩 온다
  if (holding && !leaving) {
    spawnTimer++;
    if (spawnTimer % 35 === 1 && countGathering() < GOAL) {
      spawnFamily();
    }
    // 가족이 3마리쯤 모이면 친구(블루탱)도 한 마리 찾아옴
    if (countGathering() >= 3 && !friendComing()) spawnFriend();
  }

  // 다 모였는지 확인
  if (!leaving && countArrived() >= GOAL) {
    leaving = true;
    holding = false;
    for (let f of family) {
      f.state = "leave";
      f.target = createVector(width + 300, f.pos.y - 100 + random(-60, 60));
    }
    if (nemo) nemo.target = createVector(width + 300, nemo.pos.y - 100);
  }

  // 가족 움직이기
  for (let f of family) {
    if (f.state === "come") {
      f.swimTo(f.target.x, f.target.y, 4);
      if (dist(f.pos.x, f.pos.y, f.target.x, f.target.y) < 40) f.state = "stay";
    } else if (f.state === "stay") {
      f.swimTo(
        f.target.x + sin(frameCount * 0.03 + f.wiggle) * 15,
        f.target.y,
        1.5
      );
    } else if (f.state === "scatter") {
      f.swimTo(f.target.x, f.target.y, 7);
    } else if (f.state === "leave") {
      f.swimTo(f.target.x, f.target.y, 5);
    }
  }
  for (let i = family.length - 1; i >= 0; i--) {
    if (family[i].isOffscreen()) {
      family[i].remove();
      family.splice(i, 1);
    }
  }

  // 니모
  if (nemo) {
    if (leaving) {
      nemo.swimTo(nemo.target.x, nemo.target.y, 5);
    } else {
      nemo.swimTo(gatherX + sin(frameCount * 0.02) * 40, gatherY, 1.5);
    }
    if (nemo.isOffscreen()) {
      nemo.remove();
      nemo = null;
    }
  }

  drawAnemone(a, holding);
  for (let f of family) f.display();
  if (nemo) nemo.display();
}

function spawnFamily() {
  // 화면 왼쪽, 오른쪽, 위 중 한 곳에서 등장
  let side = floor(random(3));
  let x, y;
  if (side === 0) {
    x = -50;
    y = random(height * 0.6);
  } else if (side === 1) {
    x = width + 50;
    y = random(height * 0.6);
  } else {
    x = random(width);
    y = -50;
  }
  // 가족 색
  let c = color(255, random(90, 185), random(0, 30));
  let v = random(-1, 1);
  if (v < 0) c = lerpColor(c, color(140, 40, 0), -v * 0.4); // 진하게
  else c = lerpColor(c, color(255, 235, 200), v * 0.4); // 연하게
  let f = new Fish(x, y, random(14, 22), c);
  f.body.collisionFilter.group = -1; // 물고기끼리 부딪히지 않게
  f.state = "come";
  // 니모 주변에 둥글게 자리 잡기
  let i = countGathering();
  let ang = i * 0.63 * PI;
  let rad = 70 + (i % 3) * 30;
  f.target = createVector(
    gatherX + cos(ang) * rad * 1.4,
    gatherY + sin(ang) * rad * 0.7
  );
  family.push(f);
}

// 오고 있거나 도착한 가족 수
function countGathering() {
  let n = 0;
  for (let f of family) {
    if (f.isFriend) continue; // 도리
    if (f.state === "come" || f.state === "stay") n++;
  }
  return n;
}

// 도리가 오는 중이거나 와 있는지
function friendComing() {
  for (let f of family) {
    if (f.isFriend && (f.state === "come" || f.state === "stay")) return true;
  }
  return false;
}

// 도리
function spawnFriend() {
  let x = random([-60, width + 60]);
  let y = random(height * 0.5);
  let f = new Fish(x, y, 24, color(40, 100, 230));
  f.kind = "tang";
  f.isFriend = true;
  f.body.collisionFilter.group = -1;
  f.state = "come";
  f.target = createVector(gatherX - 120, gatherY - 70); // 니모 곁
  family.push(f);
}

// 도착한 가족 수
function countArrived() {
  let n = 0;
  for (let f of family) if (!f.isFriend && f.state === "stay") n++;
  return n;
}

// 전부 모이기 전에 손을 떼면 흩어진다
function scatterFamily() {
  for (let f of family) {
    if (f.state === "come" || f.state === "stay") {
      f.state = "scatter";
      let ang = atan2(f.pos.y - gatherY, f.pos.x - gatherX) + random(-0.4, 0.4);
      f.target = createVector(
        f.pos.x + cos(ang) * width * 1.5,
        f.pos.y + sin(ang) * width * 1.5
      );
    }
  }
}

///////////////////////////// 말미잘
function makeAnemone(x, y, h) {
  // #E8F1FF 계열
  let mintC = color(165, 230, 215);
  let blueC = color(165, 195, 250);
  let c = lerpColor(mintC, blueC, random());
  let k = random(0.9, 1.05); // 밝기 조금씩 다르게
  return {
    x: x,
    y: y,
    h: h, // 촉수 길이
    n: floor(h / 12), // 촉수 개수
    c: color(red(c) * k, green(c) * k, blue(c) * k),
    seed: random(100),
    lean: 0.6, // 바깥쪽 촉수가 옆으로 기우는 정도
    weight: min(h * 0.11, 15), // 촉수 굵기
    tip: min(h * 0.17, 22), // 촉수 끝 동그라미 크기
    swayAmp: 2.5, // 일렁이는 폭
    phase: 0.5, // 촉수마다 흔들림이 어긋나는 정도
    speed: 0.03, // 일렁이는 빠르기
  };
}

function drawAnemone(a, glow) {
  let w = a.h * 0.9;
  for (let i = 0; i < a.n; i++) {
    let bx = a.x + map(i, 0, a.n - 1, -w / 2, w / 2);
    let lean = map(i, 0, a.n - 1, -a.lean, a.lean); // 바깥쪽 촉수는 옆으로 기울게
    // 촉수 마디 위치 계산
    let pts = [{ x: bx, y: a.y }];
    for (let j = 1; j <= 6; j++) {
      let sway = sin(frameCount * a.speed + a.seed + i * a.phase + j * 0.4) * j * a.swayAmp;
      pts.push({ x: bx + lean * j * (a.h / 8) + sway, y: a.y - j * (a.h / 6) });
    }
    let tip = pts[pts.length - 1];
    let c = glow ? color(255) : a.c; // 누르고 있으면 새하얗게

    noFill();
    strokeJoin(ROUND);
    // 테두리 (레벨 1 커튼용)
    if (a.outline) {
      let oc = lerpColor(c, color(10, 35, 70), 0.45);
      stroke(oc);
      strokeWeight(a.weight + 5);
      beginShape();
      for (let pt of pts) vertex(pt.x, pt.y);
      endShape();
      noStroke();
      fill(oc);
      circle(tip.x, tip.y, a.tip + 5);
      noFill();
    }
    // 촉수 아래에서 위로 그라데이션 (누르고 있을 때는 새하얗게)
    let [c1, c2] = glow ? [c, c] : twoTone(c);
    gradientLine(pts, c1, c2, a.weight, 5); // 촉수 굵기
    noStroke();
    fill(c2);
    circle(tip.x, tip.y, a.tip);
  }
}

// 말미잘을 눌렀는지 (레벨 3)
function onAnemone(x, y) {
  let a = anemones[0];
  return abs(x - a.x) < a.h * 0.8 && y > a.y - a.h * 1.1;
}

///////////////////////////// 뿅 효과
function drawPops() {
  for (let p of pops) {
    if (p.delay > 0) {
      p.delay--; // 하나씩 차례로 뾰로롱
      continue;
    }
    p.age++;
    let grow = min(p.age / 6, 1); // 처음엔 작게 톡 생겨나서 커짐
    let fade = 1 - p.age / p.life; // 점점 투명하게
    p.y -= p.vy; // 위로 떠오름
    let x = p.x + sin(p.age * 0.2 + p.seed) * 4; // 살랑살랑
    let d = p.r * 2 * grow;
    noFill(); // 동그란 테두리만
    stroke(red(p.c), green(p.c), blue(p.c), 255 * fade);
    strokeWeight(2.5);
    circle(x, p.y, d);
  }
  for (let i = pops.length - 1; i >= 0; i--) {
    if (pops[i].age >= pops[i].life) pops.splice(i, 1);
  }
}

// 니모 자리에서 물방울 5개가 생겨나 위로 떠오름
function makeBubbles(x, y) {
  for (let k = 0; k < 5; k++) {
    pops.push({
      x: x + random(-18, 18),
      y: y + random(-10, 10),
      r: random(5, 11), // 물방울 반지름
      vy: random(0.8, 1.6), // 떠오르는 속도
      delay: k * 3, // 차례로 생김
      age: 0,
      life: 240, // 약 4초 뒤 사라짐
      c: lerpColor(color(255), color(255, 130, 0), random()), // 하얀색 ~ 주황색
      seed: random(TWO_PI),
    });
  }
}

///////////////////////////// 레벨 숫자 (왼쪽 위)
function drawLevelNumbers() {
  noStroke();
  textSize(20);
  textAlign(CENTER, CENTER);
  for (let i = 1; i <= 3; i++) {
    fill(i === level ? 255 : 120);
    text(i, 10 + i * 30, 30);
  }
}

function levelNumberAt(x, y) {
  if (y > 55) return 0;
  for (let i = 1; i <= 3; i++) {
    if (abs(x - (10 + i * 30)) < 15) return i;
  }
  return 0;
}

///////////////////////////// 입력
function mousePressed() {
  let n = levelNumberAt(mouseX, mouseY);
  if (n > 0) {
    startLevel(n);
    return false;
  }

  if (level === 1) {
    // 니모를 누르면 즉시 삭제
    if (nemo && nemo.contains(mouseX, mouseY)) {
      makeBubbles(nemo.pos.x, nemo.pos.y);
      nemo.remove();
      nemo = null;
    }
  }

  if (level === 2) {
    startX = mouseX;
    startY = mouseY;
    swiping = true;
  }

  if (level === 3) {
    if (!leaving && onAnemone(mouseX, mouseY)) {
      holding = true;
      spawnTimer = 0;
    }
  }
  return false;
}

function mouseReleased() {
  // 레벨 2 화면 안에서 누르기 시작한 경우만 스와이프로 인정 (레벨 숫자를 눌러 넘어온 순간에 파도가 치지 않도록)
  if (level === 2 && swiping) {
    swiping = false;
    let dx = mouseX - startX;
    let dy = mouseY - startY;
    let d = sqrt(dx * dx + dy * dy);
    // 스와이프 한 번 → 파도 3번
    if (d > 40 && nemo && nemo.swipes === 0) {
      dx /= d;
      dy /= d;
      waves.push(new Wave(dx, dy, 0.015, 0)); // 1번: 흔들림
      waves.push(new Wave(dx, dy, 0.035, 80)); // 2번: 살짝 밀려남
      waves.push(new Wave(dx, dy, 0.12, 160)); // 3번: 슝 날아감
      nemo.swipes = 1;
    } else if (d <= 40 && nemo && nemo.swipes === 0 && nemo.contains(mouseX, mouseY)) {
      // 그냥 톡 치면 움찔하기만 함
      let b = nemo.body;
      Body.applyForce(b, b.position, {
        x: random(-1, 1) * 0.006 * b.mass,
        y: random(-1, 1) * 0.006 * b.mass,
      });
      Body.setAngularVelocity(b, random([-1, 1]) * 0.25);
    }
  }

  if (level === 3) {
    if (holding && !leaving) scatterFamily();
    holding = false;
  }
  return false;
}

function keyPressed() {
  if (key === "1") startLevel(1);
  if (key === "2") startLevel(2);
  if (key === "3") startLevel(3);
  if (key === "r" || key === "R") startLevel(level);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  startLevel(level);
}
