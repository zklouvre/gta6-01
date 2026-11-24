// NEON TIDE — input: keyboard + mouse state, edge-triggered keys.

export class Input {
  constructor(canvas) {
    this.keys = {};
    this.pressed = {}; // edge: true only on the frame the key went down
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.wheelDelta = 0;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keys[e.code]) this.pressed[e.code] = true;
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.wheelDelta += Math.sign(e.deltaY); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(code) { return !!this.keys[code]; }
  hit(code) { return !!this.pressed[code]; }
  endFrame() {
    this.pressed = {};
    this.mouse.clicked = false;
    this.wheelDelta = 0;
  }
  // movement vector from WASD / arrows
  move() {
    return {
      up: this.down('KeyW') || this.down('ArrowUp'),
      down: this.down('KeyS') || this.down('ArrowDown'),
      left: this.down('KeyA') || this.down('ArrowLeft'),
      right: this.down('KeyD') || this.down('ArrowRight'),
      run: this.down('ShiftLeft') || this.down('ShiftRight'),
    };
  }
}
