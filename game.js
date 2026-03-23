// Scene setup
function playHitSound() {
  let ctx = new (window.AudioContext || window.webkitAudioContext)();
  let noise = ctx.createBufferSource();
  let buffer = ctx.createBuffer(1, 44100, 44100);
  let data = buffer.getChannelData(0);

  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  noise.buffer = buffer;

  let gain = ctx.createGain();
  gain.gain.setValueAtTime(1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

  noise.connect(gain);
  gain.connect(ctx.destination);

  noise.start();
}function playShootSound() {
  let ctx = new (window.AudioContext || window.webkitAudioContext)();
  let osc = ctx.createOscillator();
  let gain = ctx.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);

  gain.gain.setValueAtTime(1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}
let scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

let camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);

let renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
let controls = new THREE.PointerLockControls(camera, document.body);
document.body.addEventListener("click", () => controls.lock());
scene.add(controls.getObject());

// Lighting
let light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 20, 10);
scene.add(light);

// Floor
let floor = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x228B22 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Buildings (simple map)
for (let i = 0; i < 20; i++) {
  let b = new THREE.Mesh(
    new THREE.BoxGeometry(5, Math.random()*10+5, 5),
    new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  b.position.set(Math.random()*100-50, b.geometry.parameters.height/2, Math.random()*100-50);
  scene.add(b);
}

// Player
camera.position.y = 2;
let health = 100;

// Audio
let shootSound = new Audio("assets/shoot.wav");
let hitSound = new Audio("assets/hit.wav");

// Movement
let keys = {};
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

// Gun recoil
function recoil() {
  camera.rotation.x -= 0.05;
  setTimeout(() => camera.rotation.x += 0.05, 50);
}

// Bullets
let bullets = [];
let enemyBullets = [];
let particles = [];

// Shoot
document.addEventListener("click", () => {
  shootSound.currentTime = 0;
  shootSound.play();

  recoil();

  let bullet = new THREE.Mesh(
    new THREE.SphereGeometry(0.1),
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
  );
  bullet.position.copy(camera.position);

  bullet.velocity = new THREE.Vector3();
  camera.getWorldDirection(bullet.velocity);
  bullet.velocity.multiplyScalar(1);

  bullets.push(bullet);
  scene.add(bullet);
});

// Enemies
let enemies = [];

function spawnEnemy() {
  let enemy = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 1),
    new THREE.MeshStandardMaterial({ color: 0xff0000 })
  );
  enemy.position.set(Math.random()*50-25, 1, Math.random()*-50);
  enemy.health = 3;
  enemy.cooldown = 0;
  enemies.push(enemy);
  scene.add(enemy);
}

setInterval(spawnEnemy, 2000);

// Explosion particles
function createExplosion(pos) {
  for (let i = 0; i < 10; i++) {
    let p = new THREE.Mesh(
      new THREE.SphereGeometry(0.05),
      new THREE.MeshBasicMaterial({ color: 0xffaa00 })
    );
    p.position.copy(pos);
    p.velocity = new THREE.Vector3(
      Math.random()-0.5,
      Math.random(),
      Math.random()-0.5
    );
    particles.push(p);
    scene.add(p);
  }
}

// Loop
function animate() {
  requestAnimationFrame(animate);

  // Movement
  if (keys["w"]) controls.moveForward(0.2);
  if (keys["s"]) controls.moveForward(-0.2);
  if (keys["a"]) controls.moveRight(-0.2);
  if (keys["d"]) controls.moveRight(0.2);

  // Player bullets
  bullets.forEach((b, i) => {
    b.position.add(b.velocity);

    enemies.forEach((e) => {
      if (b.position.distanceTo(e.position) < 1) {
        e.health--;
        createExplosion(e.position);

        if (e.health <= 0) {
          scene.remove(e);
          enemies.splice(enemies.indexOf(e), 1);
        }

        scene.remove(b);
        bullets.splice(i, 1);
      }
    });
  });

  // Enemy AI (strafe + chase)
  enemies.forEach(e => {
    let dir = new THREE.Vector3().subVectors(camera.position, e.position).normalize();
    let strafe = new THREE.Vector3(-dir.z, 0, dir.x);

    e.position.add(dir.multiplyScalar(0.02));
    e.position.add(strafe.multiplyScalar(Math.sin(Date.now()*0.002)*0.02));

    e.cooldown--;
    if (e.cooldown <= 0) {
      let bullet = new THREE.Mesh(
        new THREE.SphereGeometry(0.1),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
      );
      bullet.position.copy(e.position);
      bullet.velocity = new THREE.Vector3().subVectors(camera.position, e.position).normalize().multiplyScalar(0.5);
      enemyBullets.push(bullet);
      scene.add(bullet);
      e.cooldown = 100;
    }
  });

  // Enemy bullets
  enemyBullets.forEach((b, i) => {
    b.position.add(b.velocity);

    if (b.position.distanceTo(camera.position) < 1) {
      hitSound.play();
      health -= 5;

      document.getElementById("healthFill").style.width = health + "%";

      scene.remove(b);
      enemyBullets.splice(i, 1);

      if (health <= 0) {
        alert("Game Over");
        location.reload();
      }
    }
  });

  // Particles
  particles.forEach((p, i) => {
    p.position.add(p.velocity);
    p.velocity.y -= 0.02;

    if (p.position.y < 0) {
      scene.remove(p);
      particles.splice(i, 1);
    }
  });

  renderer.render(scene, camera);
}

animate();
