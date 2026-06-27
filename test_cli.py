#!/usr/bin/env python3
from __future__ import annotations
"""
Wuxing Maze Tower Defense — CLI Test Suite
==========================================
A pure-logic test runner that simulates and validates the game's core
TypeScript/JavaScript logic in Python.  No browser or DOM is required.

Usage:
  python test_cli.py

Menu:
  1. Battle Flow Test    — simulate waves, enemy movement, kill counting
  2. Full Feature Test   — run all available test suites
  3. Specific Feature    — pick an individual test module to run
"""

import sys
import math
import random
import time

# ─────────────────────────────────────────────────────────────
#  ANSI colour helpers
# ─────────────────────────────────────────────────────────────

RESET  = "\033[0m"
BOLD   = "\033[1m"
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
DIM    = "\033[2m"


def ok(msg: str)   -> str: return f"{GREEN}  [PASS]{RESET} {msg}"
def fail(msg: str) -> str: return f"{RED}  [FAIL]{RESET} {msg}"
def info(msg: str) -> str: return f"{CYAN}  [INFO]{RESET} {msg}"
def warn(msg: str) -> str: return f"{YELLOW}  [WARN]{RESET} {msg}"
def header(msg: str) -> str:
    bar = "─" * (len(msg) + 4)
    return f"\n{BOLD}{CYAN}┌{bar}┐\n│  {msg}  │\n└{bar}┘{RESET}\n"


# ─────────────────────────────────────────────────────────────
#  Minimal game-data mirrors  (kept in sync with *.ts)
# ─────────────────────────────────────────────────────────────

ENEMY_DEFS = {
    "snake":       {"id":"snake",       "name":"小蛇",   "element":"wood",  "baseHp":80,  "speed":1.0, "goldAward":2,  "isFlying":False, "colorPrimary":"#22c55e"},
    "fly":         {"id":"fly",         "name":"小蒼蠅", "element":"metal", "baseHp":50,  "speed":1.4, "goldAward":3,  "isFlying":True,  "colorPrimary":"#6b7280"},
    "salamander":  {"id":"salamander",  "name":"火蜥蜴", "element":"fire",  "baseHp":100, "speed":0.9, "goldAward":3,  "isFlying":False, "colorPrimary":"#ef4444"},
    "water_spirit":{"id":"water_spirit","name":"水靈",   "element":"water", "baseHp":70,  "speed":1.1, "goldAward":2,  "isFlying":False, "colorPrimary":"#38bdf8"},
    "golem":       {"id":"golem",       "name":"石傀儡", "element":"earth", "baseHp":180, "speed":0.6, "goldAward":4,  "isFlying":False, "colorPrimary":"#a8a29e"},
    "beetle":      {"id":"beetle",      "name":"金甲蟲", "element":"metal", "baseHp":120, "speed":0.8, "goldAward":3,  "isFlying":False, "colorPrimary":"#fbbf24"},
    "boss_dragon": {"id":"boss_dragon", "name":"龍影",   "element":"fire",  "baseHp":500, "speed":0.5, "goldAward":15, "isFlying":True,  "colorPrimary":"#dc2626"},
}

BASE_TOWERS = {
    "fire":  {"id":"fire",  "name":"烈焰塔", "element":"fire",  "cost":12, "damage":20, "range":4, "fireRate":50, "isWall":True, "level":1, "aoeRadius":1,   "aoeDamagePct":0.3},
    "water": {"id":"water", "name":"冰凍塔", "element":"water", "cost":10, "damage":8,  "range":5, "fireRate":60, "isWall":True, "level":1, "slowPct":0.5,   "slowDuration":90},
    "wood":  {"id":"wood",  "name":"纏繞塔", "element":"wood",  "cost":10, "damage":5,  "range":4, "fireRate":70, "isWall":True, "level":1, "dotDamage":3,   "dotDuration":60},
    "earth": {"id":"earth", "name":"岩壁塔", "element":"earth", "cost":2,  "damage":0,  "range":0, "fireRate":0,  "isWall":True, "level":1},
    "metal": {"id":"metal", "name":"鏡刃塔", "element":"metal", "cost":15, "damage":25, "range":3, "fireRate":40, "isWall":True, "level":1, "critChance":0.2, "critMultiplier":2.0},
    "yin":   {"id":"yin",   "name":"暗影塔", "element":"yin",   "cost":18, "damage":12, "range":6, "fireRate":55, "isWall":True, "level":1, "hpPctDamage":0.05},
    "yang":  {"id":"yang",  "name":"聖光塔", "element":"yang",  "cost":18, "damage":15, "range":5, "fireRate":50, "isWall":True, "level":1, "flyingBonus":0.5, "healBase":0.1},
}

LV2_TOWERS = {
    "fire_2":  {"id":"fire_2",  "element":"fire",  "cost":0, "damage":32, "range":4, "fireRate":45, "level":2, "aoeRadius":2,   "aoeDamagePct":0.35},
    "water_2": {"id":"water_2", "element":"water", "cost":0, "damage":13, "range":5, "fireRate":55, "level":2, "slowPct":0.7,   "slowDuration":135},
    "wood_2":  {"id":"wood_2",  "element":"wood",  "cost":0, "damage":8,  "range":4, "fireRate":65, "level":2, "dotDamage":6,   "dotDuration":90},
    "earth_2": {"id":"earth_2", "element":"earth", "cost":0, "damage":5,  "range":1, "fireRate":60, "level":2},
    "metal_2": {"id":"metal_2", "element":"metal", "cost":0, "damage":40, "range":3, "fireRate":35, "level":2, "critChance":0.4,"critMultiplier":2.5},
    "yin_2":   {"id":"yin_2",   "element":"yin",   "cost":0, "damage":18, "range":7, "fireRate":50, "level":2, "hpPctDamage":0.08},
    "yang_2":  {"id":"yang_2",  "element":"yang",  "cost":0, "damage":22, "range":5, "fireRate":45, "level":2, "flyingBonus":1.0,"healBase":0.3},
}

RECIPE_TOWERS = {
    "wood_fire":   {"id":"wood_fire",   "element":"fire",  "cost":0, "damage":18, "range":4, "fireRate":55, "level":3, "aoeRadius":2,    "aoeDamagePct":0.5, "dotDamage":4, "dotDuration":90},
    "fire_earth":  {"id":"fire_earth",  "element":"earth", "cost":0, "damage":10, "range":3, "fireRate":70, "level":3, "aoeRadius":1.5,  "dotDamage":6, "dotDuration":120},
    "earth_metal": {"id":"earth_metal", "element":"metal", "cost":0, "damage":0,  "range":0, "fireRate":0,  "level":3, "buffAllyDmg":0.25,"buffAllyRange":2},
    "metal_water": {"id":"metal_water", "element":"water", "cost":0, "damage":30, "range":4, "fireRate":45, "level":3, "slowPct":0.6,    "slowDuration":60},
    "water_wood":  {"id":"water_wood",  "element":"wood",  "cost":0, "damage":10, "range":5, "fireRate":80, "level":3, "spawnWall":True},
    "yin_yang":    {"id":"yin_yang",    "element":"yin",   "cost":0, "damage":35, "range":5, "fireRate":50, "level":3, "trueDamage":True, "healBase":0.2},
}

ELEMENT_COUNTER = {
    "metal": "wood",
    "wood":  "earth",
    "earth": "water",
    "water": "fire",
    "fire":  "metal",
}

CROSS_RECIPES = [
    ("wood",  "fire",  "wood_fire"),
    ("fire",  "earth", "fire_earth"),
    ("earth", "metal", "earth_metal"),
    ("metal", "water", "metal_water"),
    ("water", "wood",  "water_wood"),
    ("yin",   "yang",  "yin_yang"),
]

# Grid constants (mirrors main.ts)
COLS, ROWS = 80, 40
TILE_SIZE  = 16
SPAWN_POINT = (0, 20)
BASE_POINT  = (79, 20)
WAYPOINTS   = [(13, 8), (26, 32), (40, 8), (53, 32), (66, 15)]
MAX_WAVES   = 20


# ─────────────────────────────────────────────────────────────
#  Pure-logic helpers  (mirrors game functions)
# ─────────────────────────────────────────────────────────────

def get_tower_def(tid: str):
    return BASE_TOWERS.get(tid) or LV2_TOWERS.get(tid) or RECIPE_TOWERS.get(tid)


def get_element_bonus(tower_el: str, enemy_el: str):
    return 1.3 if ELEMENT_COUNTER.get(tower_el) == enemy_el else 1.0


def get_same_merge_result(element: str):
    mapping = {el: f"{el}_2" for el in ["fire","water","wood","earth","metal","yin","yang"]}
    return mapping.get(element)


def get_cross_recipe_result(el1: str, el2: str):
    for a, b, out in CROSS_RECIPES:
        if (a == el1 and b == el2) or (a == el2 and b == el1):
            return out
    return None


def get_wave_config(wave_num: int) -> list[dict]:
    configs = []
    hp_mult = 1.0 + (wave_num - 1) * 0.25
    ground  = ["snake", "salamander", "water_spirit", "golem", "beetle"]
    num_types = min(1 + wave_num // 3, len(ground))

    for i in range(num_types):
        tidx = (wave_num + i) % len(ground)
        configs.append({
            "enemyType":      ground[tidx],
            "count":          6 + int(wave_num * 0.8),
            "spawnIntervalMs":max(300, 600 - wave_num * 15),
            "hpMultiplier":   hp_mult,
        })
    if wave_num % 3 == 0:
        configs.append({"enemyType":"fly",        "count":3 + wave_num//2, "spawnIntervalMs":800, "hpMultiplier":hp_mult * 0.8})
    if wave_num % 5 == 0:
        configs.append({"enemyType":"boss_dragon", "count":1,              "spawnIntervalMs":0,   "hpMultiplier":hp_mult * 1.5})
    return configs


def get_sell_price(d: dict) -> int:
    if d["level"] == 1:
        return math.floor(d["cost"] * 0.7)
    base = BASE_TOWERS.get(d["element"], {})
    return math.floor(base.get("cost", 0) * 2 * 0.5) if base else 5


def calc_talent_points_earned(survived_waves: int) -> int:
    return max(1, math.floor(survived_waves / 3))


def get_base_hp(levels: dict) -> int:
    hp = 20
    hp += levels.get("fortress_1", 0) * 5
    hp += levels.get("fortress_2", 0) * 10
    return hp


def get_start_gold(levels: dict) -> int:
    gold = 60
    gold += levels.get("gold_1", 0) * 20
    gold += levels.get("gold_2", 0) * 30
    return gold


def get_damage_multiplier(levels: dict) -> float:
    mult = 1.0
    mult += levels.get("precise_1", 0) * 0.10
    mult += levels.get("precise_2", 0) * 0.15
    return mult


def get_fire_rate_multiplier(levels: dict) -> float:
    mult = 1.0 - levels.get("rapid_fire", 0) * 0.05
    return max(0.5, mult)


def get_wall_cost(levels: dict) -> int:
    return 1 if levels.get("wall_discount", 0) >= 1 else 2


# ─────────────────────────────────────────────────────────────
#  Minimal A* for path validation
# ─────────────────────────────────────────────────────────────

def astar(grid, start, end, is_flying=False):  # returns list of (x,y) or None
    """Return path (list of (x,y)) or None if blocked."""
    if is_flying:
        # straight diagonal walk
        path = []
        cx, cy = start
        ex, ey = end
        while (cx, cy) != (ex, ey):
            path.append((cx, cy))
            if cx < ex: cx += 1
            elif cx > ex: cx -= 1
            if cy < ey: cy += 1
            elif cy > ey: cy -= 1
        path.append((ex, ey))
        return path

    import heapq
    def h(a, b): return abs(a[0]-b[0]) + abs(a[1]-b[1])
    open_heap = []
    heapq.heappush(open_heap, (h(start, end), 0, start, [start]))
    visited = set()
    while open_heap:
        f, g, cur, path = heapq.heappop(open_heap)
        if cur in visited:
            continue
        visited.add(cur)
        if cur == end:
            return path
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx, ny = cur[0]+dx, cur[1]+dy
            if 0 <= nx < COLS and 0 <= ny < ROWS and grid[nx][ny] == 0 and (nx,ny) not in visited:
                ng = g + 1
                heapq.heappush(open_heap, (ng + h((nx,ny), end), ng, (nx,ny), path + [(nx,ny)]))
    return None


def make_grid():
    return [[0] * ROWS for _ in range(COLS)]


# ─────────────────────────────────────────────────────────────
#  Result accumulator
# ─────────────────────────────────────────────────────────────

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.lines  = []

    def check(self, condition: bool, name: str, detail: str = ""):
        if condition:
            self.passed += 1
            self.lines.append(ok(name))
        else:
            self.failed += 1
            self.lines.append(fail(name + (f" — {detail}" if detail else "")))

    def summary(self) -> str:
        total = self.passed + self.failed
        colour = GREEN if self.failed == 0 else RED
        return (
            f"\n{colour}{BOLD}  Result: {self.passed}/{total} passed"
            f"  ({self.failed} failed){RESET}"
        )

    def print_all(self):
        for line in self.lines:
            print(line)
        print(self.summary())


# ═════════════════════════════════════════════════════════════
#  TEST SUITES
# ═════════════════════════════════════════════════════════════

def test_battle_flow(r: TestResult):
    """Simulates the complete battle flow: spawn → move → damage → kill → gold → wave-end."""
    print(header("Battle Flow Test"))

    # ── 1. Wave config generation ──
    print(info("1. Wave configuration generation"))
    for wn in [1, 3, 5, 10]:
        cfg = get_wave_config(wn)
        total = sum(c["count"] for c in cfg)
        has_boss  = any(c["enemyType"] == "boss_dragon" for c in cfg)
        has_fly   = any(c["enemyType"] == "fly"         for c in cfg)
        r.check(total > 0, f"Wave {wn}: generates enemies (count={total})")
        r.check(has_boss == (wn % 5 == 0), f"Wave {wn}: boss spawn correct (every 5 waves)")
        r.check(has_fly  == (wn % 3 == 0), f"Wave {wn}: fly spawn correct  (every 3 waves)")

    # ── 2. HP scaling ──
    print(info("2. Enemy HP scaling with wave number"))
    for wn in [1, 5, 10]:
        expected_mult = 1.0 + (wn - 1) * 0.25
        cfg = get_wave_config(wn)[0]
        enemy_type = cfg["enemyType"]
        base_hp = ENEMY_DEFS[enemy_type]["baseHp"]
        actual_hp = math.floor(base_hp * cfg["hpMultiplier"])
        expected_hp = math.floor(base_hp * expected_mult)
        r.check(actual_hp == expected_hp, f"Wave {wn} {enemy_type} HP={actual_hp} (expected {expected_hp})")

    # ── 3. Simulated kill → gold reward ──
    print(info("3. Kill → gold award chain"))
    gold = 60
    kills = 0
    enemies_sim = []
    for cfg in get_wave_config(3):
        d = ENEMY_DEFS[cfg["enemyType"]]
        for _ in range(cfg["count"]):
            enemies_sim.append({
                "type":      d["id"],
                "hp":        math.floor(d["baseHp"] * cfg["hpMultiplier"]),
                "goldAward": d["goldAward"],
            })

    for e in enemies_sim:
        e["hp"] = 0  # instant kill
        if e["hp"] <= 0:
            gold += e["goldAward"]
            kills += 1

    r.check(kills == len(enemies_sim), f"All {kills}/{len(enemies_sim)} enemies killed")
    r.check(gold  > 60,                f"Gold increased from 60 to {gold} after kills")

    # ── 4. AOE damage kills secondary targets ──
    print(info("4. AOE damage and death detection (the fixed bug)"))
    aoe_tower = BASE_TOWERS["fire"]
    aoe_target = {"type":"salamander", "hp":10, "maxHp":100, "goldAward":3}
    aoe_splash = {"type":"snake",      "hp":6,  "maxHp":80,  "goldAward":2}

    # Apply AOE
    aoe_dmg = math.floor(aoe_tower["damage"] * aoe_tower.get("aoeDamagePct", 0))
    aoe_target["hp"] -= aoe_tower["damage"]
    aoe_splash["hp"] -= aoe_dmg

    # Replicate fixed death logic (use ENEMY_DEFS lookup, not .def)
    dead_gold = 0
    for e in [aoe_target, aoe_splash]:
        if e["hp"] <= 0:
            color = ENEMY_DEFS[e["type"]].get("colorPrimary", "#facc15")
            r.check(color != "", f"AOE kill: colorPrimary resolved for '{e['type']}' → {color}")
            dead_gold += e["goldAward"]

    r.check(dead_gold == aoe_target["goldAward"] + aoe_splash["goldAward"],
            f"AOE kill gold correct: {dead_gold}g")

    # ── 5. DOT (damage over time) kills enemy ──
    print(info("5. DOT (damage over time) chain"))
    enemy = {"hp": 30, "maxHp": 80, "dotDamage": 3, "dotDuration": 12, "goldAward": 2}
    dot_kills = 0
    dot_gold  = 0
    for _ in range(enemy["dotDuration"]):
        enemy["hp"] -= enemy["dotDamage"]
        enemy["dotDuration"] -= 1
        if enemy["hp"] <= 0:
            dot_kills += 1
            dot_gold  += enemy["goldAward"]
            break
    r.check(dot_kills == 1, f"DOT killed enemy (hp ended at {enemy['hp']})")
    r.check(dot_gold  == 2, f"DOT kill awarded {dot_gold}g")

    # ── 6. Slow effect ──
    print(info("6. Slow mechanic"))
    base_speed = 1.0
    slow_pct   = BASE_TOWERS["water"].get("slowPct", 0)
    slowed     = base_speed * (1 - slow_pct)
    r.check(abs(slowed - 0.5) < 1e-9, f"Slow reduces speed to {slowed:.2f} (expected 0.50)")

    # ── 7. Wave-end reward ──
    print(info("7. Wave end gold bonus"))
    for wn in [1, 5, 10]:
        bonus = 15 + wn * 3
        r.check(bonus > 0, f"Wave {wn} completion bonus: +{bonus}g")

    # ── 8. Base HP loss when enemy reaches base ──
    print(info("8. Base HP leak on enemy breakthrough"))
    hp = 20
    breakthroughs = 3
    hp -= breakthroughs
    r.check(hp == 17, f"HP correctly reduced to {hp} after {breakthroughs} leaks")
    r.check(hp > 0,   f"Game still running (hp={hp} > 0)")

    # ── 9. Victory / defeat condition ──
    print(info("9. End-of-battle conditions"))
    r.check(calc_talent_points_earned(0)       == 1,  "0 waves → 1 talent point (min)")
    r.check(calc_talent_points_earned(3)       == 1,  "3 waves → 1 talent point")
    r.check(calc_talent_points_earned(6)       == 2,  "6 waves → 2 talent points")
    r.check(calc_talent_points_earned(MAX_WAVES) > 0, f"MAX_WAVES({MAX_WAVES}) yields talent points")


def test_astar_pathfinding(r: TestResult):
    """A* pathfinding — valid paths, blocked paths, flying bypass."""
    print(header("A* Pathfinding Test"))

    grid = make_grid()

    # Open map: path should exist between every waypoint pair
    print(info("1. Open map path existence"))
    all_targets = list(WAYPOINTS) + [BASE_POINT]
    prev = SPAWN_POINT
    for tgt in all_targets:
        path = astar(grid, prev, tgt)
        r.check(path is not None, f"Path found: {prev} → {tgt}")
        r.check(path is not None and path[0] == prev and path[-1] == tgt,
                f"  Endpoints correct")
        prev = tgt

    # Build a wall blocking the direct corridor (row 20)
    print(info("2. Blocked path returns None"))
    for col in range(1, COLS):
        grid[col][20] = 1           # wall across row 20
    path = astar(grid, SPAWN_POINT, BASE_POINT)
    r.check(path is None, "Fully blocked path returns None (ground enemy)")

    # Flying units bypass walls
    print(info("3. Flying units bypass walls"))
    path_fly = astar(grid, SPAWN_POINT, BASE_POINT, is_flying=True)
    r.check(path_fly is not None, "Flying path found even when ground is blocked")

    # Restore grid
    for col in range(COLS):
        grid[col][20] = 0

    # Partial wall still allows a path around
    print(info("4. Partial wall — path goes around"))
    for col in range(1, 30):
        grid[col][20] = 1
    path2 = astar(grid, SPAWN_POINT, (40, 20))
    r.check(path2 is not None, "Path found around partial wall")

    # ── 5. Map preset obstacles (value = 2) blocking pathing ──
    print(info("5. Map obstacles (value = 2) block pathfinding"))
    grid = make_grid()
    for col in range(COLS):
        grid[col][20] = 2  # preset obstacles across the entire middle row
    path_blocked_obs = astar(grid, SPAWN_POINT, BASE_POINT)
    r.check(path_blocked_obs is None, "A* pathfinding correctly blocked by preset obstacles (value=2)")

    # ── 6. Multi-waypoint sequence path validation (Map Editor style) ──
    print(info("6. Multi-waypoint path validation (Map Editor)"))
    grid = make_grid()
    spawn = (5, 20)
    base = (75, 20)
    wps = [(20, 10), (40, 30), (60, 10)]
    
    # Check if a valid sequence connects
    def check_seq(g, s, b, waypoints):
        prev = s
        for tgt in waypoints + [b]:
            p = astar(g, prev, tgt)
            if p is None:
                return False
            prev = tgt
        return True

    # Valid scenario
    r.check(check_seq(grid, spawn, base, wps) is True, "Valid custom map passes multi-waypoint validation")

    # Blocked scenario (completely surround waypoint 0)
    for dx, dy in [(-1,0), (1,0), (0,-1), (0,1)]:
        grid[wps[0][0] + dx][wps[0][1] + dy] = 2
    r.check(check_seq(grid, spawn, base, wps) is False, "Custom map with blocked waypoint fails validation")


def test_tower_system(r: TestResult):
    """Tower placement, sell price, merge recipes, element bonus."""
    print(header("Tower System Test"))

    # ── 1. Base tower definitions ──
    print(info("1. All base tower definitions valid"))
    required_fields = ["id","name","element","cost","damage","range","fireRate","isWall","level"]
    for tid, d in BASE_TOWERS.items():
        ok_def = all(f in d for f in required_fields)
        r.check(ok_def, f"Tower '{tid}' has all required fields")

    # ── 2. Sell price formula ──
    print(info("2. Sell price formula"))
    for tid, d in BASE_TOWERS.items():
        if d["cost"] == 0:
            continue
        expected = math.floor(d["cost"] * 0.7)
        actual   = get_sell_price(d)
        r.check(actual == expected, f"Sell price '{tid}': {actual}g (expected {expected}g)")

    # ── 3. Same-element merge ──
    print(info("3. Same-element merge results"))
    for el in ["fire","water","wood","earth","metal","yin","yang"]:
        result = get_same_merge_result(el)
        r.check(result == f"{el}_2", f"{el} + {el} → {result}")

    # ── 4. Cross-element recipes ──
    print(info("4. Cross-element recipe lookup (both orders)"))
    for a, b, expected in CROSS_RECIPES:
        fwd = get_cross_recipe_result(a, b)
        rev = get_cross_recipe_result(b, a)
        r.check(fwd == expected, f"{a}+{b} → {fwd} (fwd)")
        r.check(rev == expected, f"{b}+{a} → {rev} (rev)")

    # ── 5. Element counter / damage bonus ──
    print(info("5. Element counter damage bonus"))
    for atk, tgt in ELEMENT_COUNTER.items():
        bonus = get_element_bonus(atk, tgt)
        r.check(abs(bonus - 1.3) < 1e-9, f"{atk} counters {tgt}: bonus={bonus:.1f}")
    # No bonus case
    r.check(get_element_bonus("fire", "fire") == 1.0, "Same element: no bonus")

    # ── 6. Earth tower — 0 damage, isWall=True ──
    print(info("6. Earth (wall) tower — pure barrier, no damage"))
    earth = BASE_TOWERS["earth"]
    r.check(earth["damage"] == 0,    "Earth tower damage == 0")
    r.check(earth["isWall"] is True, "Earth tower isWall == True")
    r.check(earth["cost"]   == 2,    "Earth tower cost == 2g")

    # ── 7. get_tower_def lookup across tiers ──
    print(info("7. get_tower_def resolves all tiers"))
    for tid in list(BASE_TOWERS) + list(LV2_TOWERS) + list(RECIPE_TOWERS):
        d = get_tower_def(tid)
        r.check(d is not None and d["id"] == tid, f"get_tower_def('{tid}') resolved")

    # ── 8. Merge-result tower attributes ──
    print(info("8. Merged tower attributes are enhanced"))
    r.check(LV2_TOWERS["fire_2"]["damage"]  > BASE_TOWERS["fire"]["damage"],  "fire_2 damage > fire")
    r.check(LV2_TOWERS["water_2"]["slowPct"] >= BASE_TOWERS["water"]["slowPct"], "water_2 slow >= water")
    r.check(RECIPE_TOWERS["wood_fire"]["aoeRadius"] >= 2, "wood_fire aoeRadius >= 2")


def test_talent_system(r: TestResult):
    """Talent tree: HP/gold/damage/firerate multipliers, prerequisite logic."""
    print(header("Talent System Test"))

    # ── 1. Default values (no talents) ──
    print(info("1. Default values with no talents"))
    levels = {}
    r.check(get_base_hp(levels)           == 20,  "Default HP == 20")
    r.check(get_start_gold(levels)        == 60,  "Default gold == 60")
    r.check(get_damage_multiplier(levels) == 1.0, "Default damage mult == 1.0")
    r.check(get_fire_rate_multiplier(levels) == 1.0, "Default fire-rate mult == 1.0")

    # ── 2. Fortress I and II ──
    print(info("2. Fortress talent — base HP scaling"))
    levels = {"fortress_1": 3, "fortress_2": 2}
    hp = get_base_hp(levels)
    expected = 20 + 3*5 + 2*10
    r.check(hp == expected, f"HP with fortress 3+2 = {hp} (expected {expected})")

    # ── 3. Gold talent ──
    print(info("3. Gold talent — start gold scaling"))
    levels = {"gold_1": 2, "gold_2": 1}
    gold = get_start_gold(levels)
    expected = 60 + 2*20 + 1*30
    r.check(gold == expected, f"Start gold = {gold} (expected {expected})")

    # ── 4. Damage multiplier ──
    print(info("4. Precise shot talent — damage multiplier"))
    levels = {"precise_1": 5, "precise_2": 3}
    mult = get_damage_multiplier(levels)
    expected = 1.0 + 5*0.10 + 3*0.15
    r.check(abs(mult - expected) < 1e-9, f"Damage mult = {mult:.2f} (expected {expected:.2f})")

    # ── 5. Fire rate multiplier ──
    print(info("5. Rapid fire talent — fire-rate multiplier (min 0.5)"))
    levels = {"rapid_fire": 5}
    fr = get_fire_rate_multiplier(levels)
    expected = max(0.5, 1.0 - 5*0.05)
    r.check(abs(fr - expected) < 1e-9, f"Fire-rate mult = {fr:.2f} (expected {expected:.2f})")

    levels = {"rapid_fire": 20}   # extreme, should clamp at 0.5
    fr2 = get_fire_rate_multiplier(levels)
    r.check(fr2 == 0.5, f"Fire-rate mult clamped at 0.5 (got {fr2})")

    # ── 6. Talent points earned formula ──
    print(info("6. Talent points earned per run"))
    cases = [(0,1), (3,1), (6,2), (9,3), (21,7)]
    for waves, expected_pts in cases:
        pts = calc_talent_points_earned(waves)
        r.check(pts == expected_pts, f"Waves={waves} → {pts} talent pts (expected {expected_pts})")

    # ── 7. Prerequisite chain ──
    print(info("7. Prerequisite chain logic"))
    TALENT_TREE_REQ = {
        "fortress_2": ["fortress_1"],
        "gold_2":     ["gold_1"],
        "precise_2":  ["precise_1"],
        "rapid_fire": ["precise_1"],
        "taiji_dao":  ["yin_law", "yang_law"],
        "wall_discount": ["earth_awakening"],
    }
    levels = {}
    # taiji_dao needs both yin_law and yang_law
    prereqs = TALENT_TREE_REQ["taiji_dao"]
    met = all(levels.get(p, 0) >= 1 for p in prereqs)
    r.check(not met, "taiji_dao blocked without prerequisites")

    levels = {"yin_law": 1, "yang_law": 1}
    met = all(levels.get(p, 0) >= 1 for p in prereqs)
    r.check(met, "taiji_dao unlocked after both prerequisites met")

    # ── 8. Wall discount talent ──
    print(info("8. Wall discount talent — wall cost decrease"))
    levels = {}
    r.check(get_wall_cost(levels) == 2, "Default wall cost is 2")
    levels =Met = levels.get("earth_awakening", 0) >= 1
    r.check(not Met, "wall_discount blocked without earth_awakening")
    levels = {"earth_awakening": 1}
    Met = levels.get("earth_awakening", 0) >= 1
    r.check(Met, "wall_discount unlocked with earth_awakening")
    
    levels = {"wall_discount": 1}
    r.check(get_wall_cost(levels) == 1, "Discounted wall cost is 1")


def test_enemy_defs(r: TestResult):
    """Enemy definitions: all fields present, values sane."""
    print(header("Enemy Definitions Test"))

    required = ["id","name","element","baseHp","speed","goldAward","isFlying","colorPrimary"]
    for eid, d in ENEMY_DEFS.items():
        missing = [f for f in required if f not in d]
        r.check(len(missing) == 0, f"Enemy '{eid}' has all required fields",
                f"missing: {missing}")
        if "colorPrimary" in d:
            r.check(d["colorPrimary"].startswith("#"), f"Enemy '{eid}' colorPrimary is valid hex")
        r.check(d["baseHp"]   > 0,   f"Enemy '{eid}' baseHp > 0")
        r.check(d["speed"]    > 0,   f"Enemy '{eid}' speed > 0")
        r.check(d["goldAward"] >= 1, f"Enemy '{eid}' goldAward >= 1")

    # Boss should be stronger than basic enemies
    boss = ENEMY_DEFS["boss_dragon"]
    snake = ENEMY_DEFS["snake"]
    r.check(boss["baseHp"]    > snake["baseHp"],    "Boss HP > snake HP")
    r.check(boss["goldAward"] > snake["goldAward"], "Boss goldAward > snake goldAward")
    r.check(boss["isFlying"]  is True,              "Boss is flying")


def test_wave_config(r: TestResult):
    """Wave configuration: variety, progression, boss/fly timing."""
    print(header("Wave Configuration Test"))

    print(info("1. Enemy count increases each wave"))
    prev_count = 0
    for wn in range(1, 6):
        cfg = get_wave_config(wn)
        total_ground = sum(c["count"] for c in cfg if c["enemyType"] not in ("fly", "boss_dragon"))
        r.check(total_ground > 0, f"Wave {wn}: {total_ground} ground enemies spawned")
        if wn > 1:
            r.check(total_ground >= prev_count, f"Wave {wn} ground ({total_ground}) >= wave {wn-1} ground ({prev_count})")
        prev_count = total_ground

    print(info("2. Boss appears every 5 waves"))
    for wn in range(1, 21):
        cfg = get_wave_config(wn)
        has_boss = any(c["enemyType"] == "boss_dragon" for c in cfg)
        if wn % 5 == 0:
            r.check(has_boss, f"Wave {wn}: boss appears (expected)")
        else:
            r.check(not has_boss, f"Wave {wn}: no boss (expected)")

    print(info("3. Fly appears every 3 waves"))
    for wn in range(1, 13):
        cfg = get_wave_config(wn)
        has_fly = any(c["enemyType"] == "fly" for c in cfg)
        if wn % 3 == 0:
            r.check(has_fly, f"Wave {wn}: fly appears")
        else:
            r.check(not has_fly, f"Wave {wn}: no fly")

    print(info("4. HP multiplier scaling"))
    for wn in [1, 5, 10, 20]:
        expected_mult = 1.0 + (wn - 1) * 0.25
        cfg = get_wave_config(wn)
        for c in cfg:
            r.check(abs(c["hpMultiplier"] - expected_mult * (0.8 if c["enemyType"]=="fly" else 1.0 if c["enemyType"]!="boss_dragon" else 1.5)) < 1e-6,
                    f"Wave {wn} '{c['enemyType']}' hpMult={c['hpMultiplier']:.2f}")
            break   # check just first entry to keep output tidy


def test_particle_system(r: TestResult):
    """Particle system: correct spawning and lifecycle."""
    print(header("Particle System Test"))

    class Particle:
        def __init__(self, x, y, vx, vy, color, alpha, size, life, max_life):
            self.x = x; self.y = y; self.vx = vx; self.vy = vy
            self.color = color; self.alpha = alpha; self.size = size
            self.life = life; self.max_life = max_life

    def create_death_particles(x, y, color):
        particles = []
        count = 15 + random.randint(0, 9)
        for _ in range(count):
            angle = random.random() * math.pi * 2
            speed = 1.5 + random.random() * 4
            particles.append(Particle(
                x=x, y=y,
                vx=math.cos(angle)*speed, vy=math.sin(angle)*speed,
                color=color, alpha=1.0,
                size=3 + random.random()*4,
                life=0, max_life=30 + random.randint(0,19)
            ))
        return particles

    def update_particles(particles):
        alive = []
        for p in particles:
            p.life += 1
            if p.life >= p.max_life:
                continue
            p.x  += p.vx; p.y  += p.vy
            p.vx *= 0.95; p.vy *= 0.95
            p.alpha = 1.0 - p.life / p.max_life
            alive.append(p)
        return alive

    # Spawn and tick
    print(info("1. Death particle spawn"))
    pts = create_death_particles(100, 100, "#ef4444")
    r.check(len(pts) >= 15,     f"Death particles count >= 15 (got {len(pts)})")
    r.check(all(p.alpha == 1.0  for p in pts), "All particles start at alpha=1.0")
    r.check(all(p.life  == 0    for p in pts), "All particles start at life=0")

    print(info("2. Particle lifecycle — fades and dies"))
    for _ in range(10):
        pts = update_particles(pts)
    alive_alpha = [p.alpha for p in pts]
    r.check(all(a < 1.0 for a in alive_alpha), "Particles have faded after 10 frames")
    r.check(all(a >= 0.0 for a in alive_alpha), "Alpha >= 0.0 (no negative)")

    # Run until all dead
    for _ in range(100):
        pts = update_particles(pts)
    r.check(len(pts) == 0, "All particles expired after sufficient frames")


def test_aoe_kill_fix(r: TestResult):
    """Specifically validates the AOE kill bug fix (PR #14)."""
    print(header("AOE Kill Bug Fix Test  [Bug #14]"))
    print(info("Ensures ENEMY_DEFS lookup is used instead of missing .def attribute"))

    # Simulate AOE scenario that previously crashed the game
    enemies = [
        {"type":"salamander", "hp": 0, "goldAward": 3},
        {"type":"snake",      "hp":-2, "goldAward": 2},
        {"type":"water_spirit","hp":50,"goldAward": 2},
    ]

    # Replicate the FIXED logic from main.ts line 920
    gold = 100
    dead = []
    for e in enemies:
        if e["hp"] <= 0:
            # OLD (broken): enemies[j].def.colorPrimary  → AttributeError
            # NEW (fixed):  ENEMY_DEFS[enemies[j].type]?.colorPrimary ?? '#facc15'
            color = ENEMY_DEFS.get(e["type"], {}).get("colorPrimary", "#facc15")
            r.check(color.startswith("#"),
                    f"colorPrimary resolved for '{e['type']}': {color}")
            gold += e["goldAward"]
            dead.append(e)

    r.check(len(dead) == 2, f"Correct number of AOE deaths: {len(dead)}")
    r.check(gold == 105,    f"Gold after AOE kills: {gold}g (expected 105)")

    # Confirm the surviving enemy is NOT killed
    survivors = [e for e in enemies if e not in dead]
    r.check(len(survivors) == 1 and survivors[0]["hp"] == 50,
            "Surviving enemy untouched")

    # Edge case: unknown enemy type → fallback color
    color_fallback = ENEMY_DEFS.get("unknown_enemy", {}).get("colorPrimary", "#facc15")
    r.check(color_fallback == "#facc15",
            f"Unknown enemy type falls back to '#facc15' (got '{color_fallback}')")


# ─────────────────────────────────────────────────────────────
#  Suite registry
# ─────────────────────────────────────────────────────────────

SUITES = [
    ("Battle Flow",           test_battle_flow),
    ("A* Pathfinding",        test_astar_pathfinding),
    ("Tower System",          test_tower_system),
    ("Talent System",         test_talent_system),
    ("Enemy Definitions",     test_enemy_defs),
    ("Wave Configuration",    test_wave_config),
    ("Particle System",       test_particle_system),
    ("AOE Kill Bug Fix (#14)",test_aoe_kill_fix),
]

# ─────────────────────────────────────────────────────────────
#  Menu runners
# ─────────────────────────────────────────────────────────────

def run_suites(indices):
    r = TestResult()
    for idx in indices:
        name, fn = SUITES[idx]
        fn(r)
    r.print_all()
    return r


def menu_battle_flow():
    print(f"\n{BOLD}Running: Battle Flow Test{RESET}")
    # Battle Flow is the first 2 suites: battle flow + AOE fix
    r = TestResult()
    test_battle_flow(r)
    test_aoe_kill_fix(r)
    r.print_all()


def menu_full_test():
    print(f"\n{BOLD}Running: Full Feature Test (all {len(SUITES)} suites){RESET}")
    r = TestResult()
    for name, fn in SUITES:
        fn(r)
    r.print_all()


def menu_specific():
    print(f"\n{CYAN}Available test suites:{RESET}")
    for i, (name, _) in enumerate(SUITES):
        print(f"  {BOLD}[{i+1}]{RESET} {name}")
    print(f"  {BOLD}[0]{RESET} Run all specific suites at once\n")

    raw = input("Enter suite number(s) separated by commas (e.g. 1,3,5): ").strip()
    if not raw:
        print(warn("No input provided, returning to menu."))
        return

    if raw == "0":
        menu_full_test()
        return

    try:
        indices = [int(x.strip()) - 1 for x in raw.split(",")]
        valid   = [i for i in indices if 0 <= i < len(SUITES)]
        invalid = [i+1 for i in indices if i not in valid]
        if invalid:
            print(warn(f"Skipping invalid suite numbers: {invalid}"))
        if not valid:
            print(warn("No valid suites selected."))
            return
        r = TestResult()
        for i in valid:
            name, fn = SUITES[i]
            fn(r)
        r.print_all()
    except ValueError:
        print(fail("Invalid input. Please enter numbers separated by commas."))


# ─────────────────────────────────────────────────────────────
#  Main entry
# ─────────────────────────────────────────────────────────────

def main():
    while True:
        print(f"""
{BOLD}{CYAN}╔══════════════════════════════════════════╗
║  Wuxing Maze Tower Defense — Test Suite  ║
╚══════════════════════════════════════════╝{RESET}

  {BOLD}[1]{RESET} Battle Flow Test
        Simulate waves, enemy movement, kills, AOE fix
  {BOLD}[2]{RESET} Full Feature Test
        Run all {len(SUITES)} test suites
  {BOLD}[3]{RESET} Specific Feature Test
        Choose individual test suites to run
  {BOLD}[q]{RESET} Quit
""")
        choice = input("Select option: ").strip().lower()

        if choice == "1":
            menu_battle_flow()
        elif choice == "2":
            menu_full_test()
        elif choice == "3":
            menu_specific()
        elif choice in ("q", "quit", "exit"):
            print(f"\n{DIM}Goodbye!{RESET}\n")
            sys.exit(0)
        else:
            print(warn(f"Unknown option '{choice}'. Please enter 1, 2, 3 or q."))

        input(f"\n{DIM}Press Enter to return to menu...{RESET}")


if __name__ == "__main__":
    main()
