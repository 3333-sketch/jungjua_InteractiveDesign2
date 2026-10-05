// 물고기 클래스 (니모 + 가족)

class Fish {
  constructor(x, y, size, c) {
    this.size = size; // 몸 반지름
    this.c = c; // 몸 색
    this.dir = 1; // 바라보는 방향 (1: 오른쪽, -1: 왼쪽)
    this.autoFace = true; // 움직이는 방향으로 자동으로 몸을 돌릴지
    this.wiggle = random(TWO_PI); // 꼬리 흔들림 시작값 (물고기마다 다르게)
    this.target = null; // 헤엄쳐 갈 목표 지점
    this.state = "swim"; // 상태: swim, come, stay, scatter, leave
    this.body = Bodies.circle(x, y, size, {
      frictionAir: 0.05, // 물의 저항
      restitution: 0.5,
      inertia: Infinity, // 부딪혀도 저절로 돌지 않게
    });
    Composite.add(engine.world, this.body);
  }

  get pos() {
    return this.body.position;
  }

  // 목표 지점을 향해 헤엄치기 (속도를 조금씩 바꿔서 부드럽게)
  swimTo(tx, ty, speed) {
    let vx = tx - this.pos.x;
    let vy = ty - this.pos.y;
    let d = sqrt(vx * vx + vy * vy);
    if (d < 1) return;
    let s = min(speed, max(d * 0.1, 1)); // 가까워지면 천천히
    let v = this.body.velocity;
    Body.setVelocity(this.body, {
      x: lerp(v.x, (vx / d) * s, 0.1),
      y: lerp(v.y, (vy / d) * s, 0.1),
    });
  }

  // 정해진 영역 안에서 이리저리 돌아다니기
  wander(x1, y1, x2, y2, speed) {
    if (
      this.target === null ||
      dist(this.pos.x, this.pos.y, this.target.x, this.target.y) < 20
    ) {
      this.target = createVector(random(x1, x2), random(y1, y2));
    }
    this.swimTo(this.target.x, this.target.y, speed);
  }

  // 터치한 점이 물고기 위인지
  contains(x, y) {
    return dist(x, y, this.pos.x, this.pos.y) < this.size * 1.6;
  }

  // 화면 밖으로 나갔는지
  isOffscreen() {
    let m = this.size * 3;
    return (
      this.pos.x < -m ||
      this.pos.x > width + m ||
      this.pos.y < -m ||
      this.pos.y > height + m
    );
  }

  // 물리 세계에서 지우기
  remove() {
    Composite.remove(engine.world, this.body);
  }

  display() {
    let s = this.size;
    let vx = this.body.velocity.x;
    if (this.autoFace) {
      if (vx > 0.3) this.dir = 1;
      if (vx < -0.3) this.dir = -1;
    }
    let tail = sin(frameCount * 0.3 + this.wiggle) * s * 0.25;

    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.body.angle);
    scale(this.dir, 1);

    // 블루탱 따로
    if (this.kind === "tang") {
      this.drawTang(s, tail);
      pop();
      return;
    }

    stroke(20);
    strokeWeight(1.5);
    // 꼬리
    fill(this.c);
    triangle(-s * 0.8, 0, -s * 1.7, -s * 0.6 + tail, -s * 1.7, s * 0.6 + tail);
    // 몸
    ellipse(0, 0, s * 2.2, s * 1.4);
    // 흰 줄무늬 마스크
    push();
    clip(() => ellipse(0, 0, s * 2.2, s * 1.4));
    noFill();
    // 검은 테두리
    stroke(20);
    strokeWeight(s * 0.22 + max(3, s * 0.1));
    line(s * 0.35, -s, s * 0.35, s);
    line(-s * 0.35, -s, -s * 0.35, s);
    // 흰 줄
    stroke(255);
    strokeWeight(s * 0.22);
    line(s * 0.35, -s, s * 0.35, s);
    line(-s * 0.35, -s, -s * 0.35, s);
    pop();
    // 몸 테두리를 덧그리기
    noFill();
    stroke(20);
    strokeWeight(1.5);
    ellipse(0, 0, s * 2.2, s * 1.4);
    // 눈
    noStroke();
    fill(20);
    circle(s * 0.7, -s * 0.15, s * 0.22);
    pop();
  }

  // 파란 몸 + 등의 검은 무늬 + 노란 꼬리
  drawTang(s, tail) {
    stroke(20);
    strokeWeight(1.5);
    // 노란 꼬리
    fill(255, 205, 0);
    triangle(-s * 0.8, 0, -s * 1.6, -s * 0.65 + tail, -s * 1.6, s * 0.65 + tail);
    // 파란 몸
    fill(this.c);
    ellipse(0, 0, s * 2.2, s * 1.5);
    // 검은 무늬
    push();
    clip(() => ellipse(0, 0, s * 2.2, s * 1.5));
    noStroke();
    fill(20, 25, 60);
    ellipse(-s * 0.2, -s * 0.2, s * 1.9, s * 0.75); // 검은 고리 바깥
    fill(this.c);
    ellipse(-s * 0.1, -s * 0.18, s * 1.1, s * 0.3); // 고리 안쪽 파랑색
    pop();
    // 몸 테두리
    noFill();
    stroke(20);
    strokeWeight(1.5);
    ellipse(0, 0, s * 2.2, s * 1.5);
    // 눈
    noStroke();
    fill(200, 100, 255); // 밝은 자주색
    circle(s * 0.68, -s * 0.12, s * 0.22);
  }
}
