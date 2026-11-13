// GridSystem: generates the 6x3 battlefield and controls tile ownership,
// damage states (cracked / broken), territory capture, and danger warnings.
const COLORS = {
  player: { face: 0x2f6fd6, hi: 0x7fb4ff, edge: 0x163a7a, lip: 0x10295a },
  enemy: { face: 0xc9463a, hi: 0xff9a88, edge: 0x6e1d16, lip: 0x4d120e },
};

export class GridSystem {
  constructor(scene, cfg) {
    this.scene = scene;
    this.cfg = cfg;
    this.cols = cfg.cols;
    this.rows = cfg.rows;
    this.fighters = [];
    this.warnings = [];
    this.tiles = [];
    for (let c = 0; c < this.cols; c++) {
      this.tiles[c] = [];
      for (let r = 0; r < this.rows; r++) {
        const owner = c < this.cols / 2 ? 'player' : 'enemy';
        const tile = {
          col: c, row: r, owner, baseOwner: owner,
          state: 'normal', repairAt: 0, captureUntil: 0,
          gfx: scene.add.graphics().setDepth(1),
        };
        this.tiles[c][r] = tile;
        this.drawTile(tile);
      }
    }
  }

  tileX(c) { return this.cfg.originX + c * this.cfg.tileW; }
  tileY(r) { return this.cfg.originY + r * this.cfg.tileH; }

  /** Where a fighter's feet rest on a tile. */
  center(c, r) {
    return { x: this.tileX(c) + this.cfg.tileW / 2, y: this.tileY(r) + Math.round(this.cfg.tileH * 0.62) };
  }

  inBounds(c, r) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }
  tile(c, r) { return this.inBounds(c, r) ? this.tiles[c][r] : null; }
  occupant(c, r) { return this.fighters.find((f) => f.alive && f.col === c && f.row === r) || null; }

  canEnter(fighter, c, r) {
    const t = this.tile(c, r);
    if (!t || t.state === 'broken') return false;
    // Shadow Step lets a fighter walk onto the other side's tiles for a while.
    if (t.owner !== fighter.side && !(fighter.scene.clock < (fighter.shadowUntil || 0))) return false;
    const o = this.occupant(c, r);
    return !o || o === fighter;
  }

  /** Every tile a side may currently stand on. */
  openTiles(fighter) {
    const out = [];
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) if (this.canEnter(fighter, c, r)) out.push(this.tiles[c][r]);
    }
    return out;
  }

  drawTile(t) {
    const { tileW: w, tileH: h, lip } = this.cfg;
    const x = this.tileX(t.col);
    const y = this.tileY(t.row);
    const col = COLORS[t.owner];
    const g = t.gfx;
    g.clear();
    if (t.row === this.rows - 1) g.fillStyle(col.lip, 1).fillRect(x + 2, y + h - 2, w - 4, lip);
    g.fillStyle(col.edge, 1).fillRect(x + 2, y + 2, w - 4, h - 4);
    if (t.state === 'broken') {
      g.fillStyle(0x07070d, 0.92).fillRect(x + 6, y + 6, w - 12, h - 12);
      g.fillStyle(col.face, 0.35).fillRect(x + 6, y + 6, w - 12, 3);
      return;
    }
    g.fillStyle(col.face, 1).fillRect(x + 5, y + 5, w - 10, h - 10);
    g.fillStyle(col.hi, 0.6).fillRect(x + 5, y + 5, w - 10, 4);
    g.fillStyle(0xffffff, 0.08).fillRect(x + 14, y + 15, w - 28, h - 30);
    if (t.owner !== t.baseOwner) {
      g.lineStyle(2, 0xffffff, 0.55).strokeRect(x + 9, y + 12, w - 18, h - 22);
    }
    if (t.state === 'cracked') {
      g.lineStyle(3, 0x07070d, 0.9);
      g.beginPath();
      g.moveTo(x + 18, y + 14);
      g.lineTo(x + 44, y + 30);
      g.lineTo(x + 58, y + 20);
      g.lineTo(x + 78, y + 40);
      g.lineTo(x + 100, y + 32);
      g.moveTo(x + 58, y + 20);
      g.lineTo(x + 66, y + 48);
      g.moveTo(x + 44, y + 30);
      g.lineTo(x + 30, y + 46);
      g.strokePath();
    }
  }

  /** Damage the ground: normal -> cracked -> broken (only if nobody stands there). */
  crack(c, r) {
    const t = this.tile(c, r);
    if (!t || t.state === 'broken') return;
    if (t.state === 'normal') t.state = 'cracked';
    else if (!this.occupant(c, r)) this.breakTile(t);
    this.drawTile(t);
  }

  breakTile(t) {
    t.state = 'broken';
    t.repairAt = this.scene.clock + this.cfg.brokenRepairMs;
    this.drawTile(t);
  }

  /** A cracked tile collapses once the fighter standing on it steps off. */
  onLeave(c, r) {
    const t = this.tile(c, r);
    if (t && t.state === 'cracked') this.breakTile(t);
  }

  /** The column of `side`'s opponent that is closest to the dividing line. */
  frontierColumn(side) {
    const other = side === 'player' ? 'enemy' : 'player';
    const order = [...Array(this.cols).keys()];
    if (side === 'enemy') order.reverse();
    const owned = order.filter((c) => this.tiles[c].some((t) => t.owner === other));
    return owned.length > 1 ? owned[0] : null; // always leave the opponent one column
  }

  capture(side, col, durationMs) {
    let taken = 0;
    for (const t of this.tiles[col]) {
      const o = this.occupant(t.col, t.row);
      if (t.owner === side || (o && o.side !== side)) continue;
      t.owner = side;
      t.captureUntil = this.scene.clock + durationMs;
      this.drawTile(t);
      taken++;
    }
    return taken;
  }

  /** Flash tiles to telegraph an incoming attack. Returns a handle with cancel(). */
  warn(tiles, ms, color = 0xffe14a) {
    const { tileW: w, tileH: h } = this.cfg;
    const rects = tiles
      .filter((t) => this.inBounds(t.col, t.row))
      .map((t) =>
        this.scene.add
          .rectangle(this.tileX(t.col) + w / 2, this.tileY(t.row) + h / 2, w - 10, h - 10, color, 0.5)
          .setDepth(2)
      );
    const entry = {
      rects,
      until: this.scene.clock + ms,
      cancel: () => {
        entry.until = 0;
      },
    };
    this.warnings.push(entry);
    return entry;
  }

  update() {
    const now = this.scene.clock;
    for (let c = 0; c < this.cols; c++) {
      for (const t of this.tiles[c]) {
        if (t.state === 'broken' && now >= t.repairAt) {
          t.state = 'normal';
          this.drawTile(t);
        }
        if (t.owner !== t.baseOwner && now >= t.captureUntil) {
          const o = this.occupant(t.col, t.row);
          if (!o || o.side === t.baseOwner) {
            t.owner = t.baseOwner;
            this.drawTile(t);
          }
        }
      }
    }
    const blink = 0.22 + 0.4 * Math.abs(Math.sin(now / 55));
    this.warnings = this.warnings.filter((wn) => {
      if (now >= wn.until) {
        wn.rects.forEach((r) => r.destroy());
        return false;
      }
      wn.rects.forEach((r) => r.setAlpha(blink));
      return true;
    });
  }
}
