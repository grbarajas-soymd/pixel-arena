#!/usr/bin/env python3
"""
Pixel Arena — FLUX.1 Dev Sprite Generator

Generates pixel art sprites for heroes, monsters, followers, and battle
backgrounds using FLUX.1 Dev via the SD WebUI Forge API + rembg for
neural background removal.

Supports two output modes:
  Single-frame: Original 128x128 / 64x64 / 32x32 sprites (heroes, monsters, etc.)
  Sprite sheets: FFT-inspired animated sheets (hero-sheets, monster-sheets, follower-sheets)
    - Heroes/Monsters: 384x384 PNG (6 cols x 6 rows of 64x64 cells)
    - Followers: 192x64 PNG (6 cols x 2 rows of 32x32 cells)
    - Each sheet paired with a .json animation definition file

Usage:
    python generate_sprites.py --help
    python generate_sprites.py --test                    # Test Forge API connection
    python generate_sprites.py --status                  # Show sprite inventory
    python generate_sprites.py --category heroes         # Generate hero bases (single frame)
    python generate_sprites.py --category hero-sheets    # Generate hero animated sheets
    python generate_sprites.py --category monster-sheets # Generate monster animated sheets
    python generate_sprites.py --category follower-sheets# Generate follower animated sheets
    python generate_sprites.py --category monsters       # Generate monster sprites (single)
    python generate_sprites.py --category followers      # Generate follower sprites (single)
    python generate_sprites.py --category backgrounds    # Generate battle backgrounds
    python generate_sprites.py --category all            # Generate everything (single frame)
    python generate_sprites.py --category all-sheets     # Generate all animated sheets
    python generate_sprites.py --single barbarian_base   # Generate one specific sprite
    python generate_sprites.py --prototype               # Barbarian + 2 monsters test
    python generate_sprites.py --prototype-sheet         # Barbarian sheet + skeleton sheet test
    python generate_sprites.py --placeholder hero-sheets # Placeholder sheets (no Forge needed)
    python generate_sprites.py --download-models         # Download FLUX model files

Requires:
    pip install requests Pillow rembg[gpu]

SD WebUI Forge must be running with --api flag and FLUX.1 Dev model loaded.
"""

import argparse
import base64
import hashlib
import io
import json
import os
import sys
import time
from pathlib import Path

# Add NVIDIA pip-installed CUDA libs to DLL search path (Windows)
# Must happen before any onnxruntime import (via rembg)
if sys.platform == "win32":
    try:
        import importlib, nvidia
        for _pkg_name in ("cublas", "cuda_runtime", "cudnn", "cufft",
                          "curand", "cusolver", "cusparse", "nvjitlink"):
            try:
                _mod = importlib.import_module(f"nvidia.{_pkg_name}")
                for _sub in ("bin", "lib"):
                    _dll_dir = str(Path(_mod.__path__[0]) / _sub)
                    if os.path.isdir(_dll_dir):
                        os.add_dll_directory(_dll_dir)
                        os.environ["PATH"] = _dll_dir + os.pathsep + os.environ.get("PATH", "")
            except ImportError:
                pass
    except ImportError:
        pass  # CUDA pip packages not installed, will fall back to CPU

try:
    import requests
    from PIL import Image, ImageDraw
except ImportError:
    print("Missing dependencies. Install with:")
    print("  python -m pip install requests Pillow rembg[gpu]")
    sys.exit(1)

# ── Configuration ───────────────────────────────────────────────────────────

OUTPUT_DIR = Path(__file__).parent.parent / "assets" / "sprites" / "generated"
FORGE_MODELS_DIR = Path("D:/stable-diffusion-webui-forge/models")

# Target sprite sizes after downscale (single-frame mode)
HERO_SIZE = 128       # Heroes: 128x128
MONSTER_SIZE = 128    # Monsters: 128x128
FOLLOWER_SIZE = 64    # Followers: 64x64
BG_WIDTH = 640        # Battle backgrounds: 640x360 (viewport size)
BG_HEIGHT = 360
GEAR_ICON_SIZE = 32   # 32x32 inventory icons

# Sheet format constants
SHEET_COLS = 6        # 6 frames per animation row
SHEET_ROWS = 6        # 6 animation rows (idle, attack, hurt, cast, death, walk)
HERO_CELL = 64        # Hero/monster cell size in sheets
FOLLOWER_CELL = 32    # Follower cell size in sheets
FOLLOWER_SHEET_ROWS = 2  # Followers only get idle + attack

# Mutable config — overridden by CLI args
CONFIG = {
    "sd_url": os.environ.get("SD_URL", "http://127.0.0.1:7860"),
    "gen_size": 1024,       # FLUX generates at 1024x1024
    "sd_steps": 25,         # 25 steps for FLUX.1 Dev
    "sd_cfg": 1.0,          # FLUX uses CFG=1 (guidance is separate)
    "guidance": 3.5,        # FLUX-specific guidance scale
    "sd_sampler": "Euler",  # FLUX uses Euler sampler
}

def _name_seed(name: str) -> int:
    """Deterministic seed from name for consistency."""
    return int(hashlib.md5(name.encode()).hexdigest()[:8], 16) % (2**31)


# ── Style Prompts ─────────────────────────────────────────────────────────

STYLE_SPRITE = (
    "pixel art game sprite, single character, centered, full body, side view facing right, "
    "transparent background, clean pixel edges, dark fantasy RPG style, "
    "16-bit retro SNES style, crisp pixel art, no anti-aliasing"
)

STYLE_BG = (
    "pixel art game background, dark fantasy RPG, atmospheric, "
    "16-bit retro style, clean pixel art, detailed environment, "
    "no characters, no text, no UI elements"
)

STYLE_ICON = (
    "pixel art RPG item icon, single item centered, "
    "clean pixel edges, dark background, 16-bit style, "
    "no text, no character, item only, crisp sharp pixels"
)

# ── Pose Prompts (for sprite sheet generation) ────────────────────────────

POSE_SUFFIXES = {
    "idle_1":         "standing neutral pose, weapon at side, relaxed stance",
    "idle_2":         "slight breathing lean, subtle weight shift, relaxed pose",
    "attack_windup":  "weapon raised overhead, ready to strike, powerful stance",
    "attack_strike":  "weapon extended forward, striking action pose, dynamic motion",
    "hurt_flinch":    "recoiling from hit, flinching in pain, knocked back slightly",
    "cast_channel":   "hands raised channeling magic, glowing energy, mystical pose",
    "death_collapse": "fallen defeated pose, collapsed on ground, limp body",
}

# ── Animation Definitions (written as companion JSON) ─────────────────────

HERO_ANIM_DEF = {
    "frame_size": [64, 64],
    "animations": {
        "idle":   {"row": 0, "count": 6, "fps": 6, "loop": True},
        "attack": {"row": 1, "count": 6, "fps": 12, "loop": False, "next": "idle"},
        "hurt":   {"row": 2, "count": 4, "fps": 10, "loop": False, "next": "idle"},
        "cast":   {"row": 3, "count": 6, "fps": 8, "loop": False, "next": "idle"},
        "death":  {"row": 4, "count": 6, "fps": 6, "loop": False, "next": ""},
        "walk":   {"row": 5, "count": 6, "fps": 8, "loop": True},
    }
}

FOLLOWER_ANIM_DEF = {
    "frame_size": [32, 32],
    "animations": {
        "idle":   {"row": 0, "count": 6, "fps": 6, "loop": True},
        "attack": {"row": 1, "count": 6, "fps": 12, "loop": False, "next": "idle"},
    }
}

# Weapon overlay anim definition (single row: attack frames only)
WEAPON_ANIM_DEF = {
    "frame_size": [64, 64],
    "animations": {
        "attack": {"row": 0, "count": 6, "fps": 12, "loop": False, "next": ""},
    }
}

# Weapon overlay types — mapped from equipment base_key prefixes
WEAPON_OVERLAYS = {
    "sword": (
        "pixel art sword weapon overlay, steel longsword blade, "
        "side view facing right, transparent background, weapon only, "
        "no character, clean pixel edges, 16-bit RPG style"
    ),
    "axe": (
        "pixel art battle axe weapon overlay, heavy double-headed axe, "
        "side view facing right, transparent background, weapon only, "
        "no character, clean pixel edges, 16-bit RPG style"
    ),
    "bow": (
        "pixel art longbow weapon overlay, curved wooden bow with string, "
        "side view facing right, transparent background, weapon only, "
        "no character, clean pixel edges, 16-bit RPG style"
    ),
    "staff": (
        "pixel art magic staff weapon overlay, wooden staff with glowing crystal tip, "
        "side view facing right, transparent background, weapon only, "
        "no character, clean pixel edges, 16-bit RPG style"
    ),
    "daggers": (
        "pixel art twin daggers weapon overlay, pair of curved daggers, "
        "side view facing right, transparent background, weapon only, "
        "no character, clean pixel edges, 16-bit RPG style"
    ),
    "scythe": (
        "pixel art war scythe weapon overlay, dark curved scythe blade, "
        "side view facing right, transparent background, weapon only, "
        "no character, clean pixel edges, 16-bit RPG style"
    ),
}

# Map gear base_key to weapon overlay type
WEAPON_TYPE_MAP = {
    "rusty_blade": "sword", "iron_sword": "sword", "great_sword": "sword",
    "soulreaver": "sword",
    "war_axe": "axe",
    "wooden_bow": "bow", "shortbow": "bow", "longbow": "bow",
    "astral_longbow": "bow",
    "worn_wand": "staff", "arcane_staff": "staff", "crystal_staff": "staff",
    "rusty_daggers": "daggers", "hunting_knives": "daggers",
    "frost_daggers": "daggers",
    "cursed_scythe": "scythe",
}

# ── Sprite Definitions ─────────────────────────────────────────────────────

HERO_BASES = {
    "barbarian": (
        "massive muscular barbarian warrior, heavy battle-scarred build, "
        "dark war paint on face, spiked iron helmet, torn fur loincloth, "
        "giant double-headed battle axe, bare scarred chest, fierce red eyes, "
        "dark fantasy berserker, menacing powerful stance"
    ),
    "wizard": (
        "dark robed wizard sorcerer, deep blue-black flowing robes, "
        "tall pointed hat with teal gem, gnarled wooden staff with glowing orb, "
        "mysterious arcane aura, pale gaunt face, piercing teal eyes, "
        "ancient spellcaster, long dark beard"
    ),
    "ranger": (
        "hooded forest ranger archer, dark green leather armor, "
        "long hooded cloak, oak longbow with nocked arrow, "
        "quiver of arrows on back, keen amber eyes, "
        "weathered face, feathered cap, scout tracker"
    ),
    "assassin": (
        "stealthy dark assassin rogue, jet black leather armor, "
        "face-covering shadow mask, twin curved daggers, "
        "slim agile build, icy blue eyes glowing, "
        "dark hooded cloak, crouched ready stance, shadowy figure"
    ),
}

MONSTERS = {
    # Tier 1 — small/simple enemies
    "goblin_scout": (
        "small green goblin scout, pointy ears, crude rusty dagger, "
        "ragged leather scraps, sneaky crouched pose, yellow beady eyes"
    ),
    "cave_bat": (
        "large monstrous cave bat, dark brown leathery wings spread wide, "
        "fanged mouth, glowing red eyes, swooping attack pose"
    ),
    "slime": (
        "green gelatinous slime blob monster, translucent gooey body, "
        "bubbling surface, dripping acidic ooze, simple white eyes"
    ),
    "skeleton": (
        "undead skeleton warrior, yellowed bones, tattered rusted armor, "
        "ancient notched sword, empty eye sockets with yellow glow"
    ),
    # Tier 2 — mid enemies
    "orc_warrior": (
        "massive orc warrior, dark green skin, protruding tusks, "
        "heavy iron plate armor, spiked mace, battle-scarred, fierce orange eyes"
    ),
    "dark_mage": (
        "sinister dark mage, tattered purple robes, floating dark energy orbs, "
        "skeletal hands, glowing purple eyes, dark magic aura"
    ),
    "troll": (
        "hulking cave troll, grey-green warty skin, massive wooden club, "
        "regenerating wounds visible, small angry green eyes, hunched"
    ),
    "ghost": (
        "ethereal ghost spirit, translucent pale blue-white form, "
        "floating wispy body, hollow empty eyes, eerie ghostly glow, spectral"
    ),
    "mimic": (
        "treasure chest mimic monster, wooden chest body with rows of teeth, "
        "long sticky tongue, chain legs, gold coins visible inside, ambush predator"
    ),
    # Tier 3 — strong enemies
    "minotaur": (
        "massive minotaur beast, brown fur, bull horned head, "
        "muscular humanoid body, enormous battle axe, hooved feet, "
        "steam from nostrils, red furious eyes"
    ),
    "lich": (
        "ancient undead lich sorcerer, skeletal body in dark ornate robes, "
        "jeweled phylactery crown, green necromantic energy, "
        "floating ancient tome, teal glowing eye sockets"
    ),
    "stone_golem": (
        "massive stone golem construct, rough boulder body, "
        "glowing orange rune carvings, heavy granite fists, "
        "cracked weathered surface, burning amber eyes"
    ),
    "wyvern": (
        "flying wyvern dragon, brown-green scales, bat-like wings, "
        "venomous barbed tail, sharp talons, reptilian orange eyes, fierce"
    ),
    "fungal_horror": (
        "grotesque fungal horror monster, massive mushroom cap head, "
        "twisted root tendrils for limbs, toxic spore clouds, "
        "bioluminescent green spots, decaying plant body"
    ),
    "yeti": (
        "enormous white yeti beast, thick shaggy ice-crusted fur, "
        "massive clawed hands, snarling fanged mouth, "
        "frost breath visible, pale blue eyes, mountain creature"
    ),
    # Tier 4 — bosses
    "dragon": (
        "fearsome elder dragon, crimson and gold scales, massive wings, "
        "fire breath glow in throat, armored chest plates, "
        "enormous horned head, burning orange eyes, legendary beast"
    ),
    "demon_lord": (
        "towering demon lord, dark crimson skin, curved ram horns, "
        "massive bat wings, burning hellfire aura, heavy dark armor, "
        "flaming greatsword, glowing red eyes, lord of the abyss"
    ),
    "ancient_wyrm": (
        "colossal ancient wyrm serpent, iridescent crystalline scales, "
        "cosmic energy flowing through body, multiple eyes, "
        "ancient beyond time, reality-warping aura, green magical glow"
    ),
    "abyssal_kraken": (
        "abyssal kraken horror, enormous dark tentacles, "
        "deep sea bioluminescent markings, massive central eye, "
        "writhing appendages, eldritch ocean horror, dark blue-purple"
    ),
}

FOLLOWERS = {
    # Common
    "fire_imp": "tiny fire imp, small red demon with flame tail, orange fire aura, mischievous",
    "stone_golem": "small stone golem companion, rocky round body, cute sturdy legs, rune eyes",
    "shadow_rat": "dark shadow rat, wispy black body, glowing purple eyes, sneaky small rodent",
    "ember_sprite": "tiny ember sprite, small floating flame creature, warm orange glow, wispy",
    "mud_crawler": "small mud crawler, brown earthy slug-like blob, beady eyes, slow crawling",
    # Uncommon
    "frost_wolf": "small frost wolf pup, white-blue fur, ice crystals on coat, pale blue eyes",
    "thunder_hawk": "small thunder hawk, electric blue-yellow feathers, crackling sparks, sharp talons",
    "iron_beetle": "armored iron beetle, shiny metallic dark shell, six sturdy legs, small horns",
    "venom_spider": "small venomous spider, dark purple body, glowing green fangs, eight legs",
    "bone_wraith": "small bone wraith spirit, tiny floating skeleton ghost, pale blue glow",
    # Rare
    "flame_drake": "small flame drake, tiny fire-breathing dragon, red-orange scales, small wings",
    "crystal_elemental": "crystal elemental, small prismatic floating gemstone body, rainbow shards",
    "shadow_panther": "shadow panther cub, dark smoky fur, glowing amber eyes, sleek stealthy",
    "storm_serpent": "small storm serpent, electric blue-white snake, lightning crackling along body",
    # Epic
    "phoenix": "small phoenix bird, brilliant fire wings, golden-red plumage, radiant warm glow",
    "void_stalker": "small void stalker, dark energy creature, purple-black ethereal form, menacing",
    "ancient_treant": "small ancient treant, tiny wooden tree creature, leafy crown, mossy bark",
    # Legendary
    "chaos_dragon": "small chaos dragon, tiny dragon with multicolored shifting scales, reality-warping",
    "death_knight": "small death knight, tiny undead warrior, dark glowing armor, spectral sword",
}

BATTLE_BACKGROUNDS = {
    "dark_forest": (
        "dark enchanted forest clearing, twisted gnarled trees, "
        "moonlight filtering through canopy, mist on ground, "
        "glowing mushrooms, eerie atmosphere, dark navy and teal palette"
    ),
    "dungeon_depths": (
        "deep stone dungeon corridor, crumbling walls, "
        "torch sconces with flickering flames, puddles on floor, "
        "chains hanging, dark and oppressive, navy and amber palette"
    ),
    "castle_throne": (
        "dark castle throne room, ornate pillars, "
        "cracked stained glass windows, dusty cobblestone floor, "
        "ominous empty throne, candlelight, navy and gold palette"
    ),
    "lava_cavern": (
        "volcanic lava cavern, flowing magma rivers, "
        "obsidian rock formations, orange-red glow from lava, "
        "stalactites, extreme heat haze, dark red and black palette"
    ),
    "frozen_wastes": (
        "frozen arctic wasteland, ice formations and glaciers, "
        "blowing snow particles, aurora borealis in dark sky, "
        "frozen dead trees, pale blue and white palette"
    ),
    "graveyard": (
        "haunted moonlit graveyard, crumbling tombstones, "
        "dead twisted trees, fog rolling between graves, "
        "ghostly wisps floating, dark purple and grey palette"
    ),
    "crystal_cave": (
        "underground crystal cave, massive glowing crystals, "
        "prismatic light reflections, still underground lake, "
        "stalactites and stalagmites, teal and purple palette"
    ),
    "demon_realm": (
        "hellish demon realm, floating rock islands, "
        "rivers of fire below, dark crimson sky, "
        "jagged obsidian spires, demonic runes glowing, red and black"
    ),
    "ancient_ruins": (
        "overgrown ancient ruins, crumbling stone columns, "
        "vines and moss covering everything, mysterious runes still glowing, "
        "shaft of light from above, green and stone grey palette"
    ),
    "ocean_abyss": (
        "deep ocean abyss, bioluminescent creatures floating, "
        "sunken ship wreckage, dark water, coral formations, "
        "jellyfish light sources, deep blue and teal palette"
    ),
    "sky_citadel": (
        "floating sky citadel battleground, clouds below, "
        "marble pillars and platforms, golden light breaking through storm clouds, "
        "wind-swept, epic height, gold and dark blue palette"
    ),
    "swamp_bog": (
        "murky dark swamp, twisted mangrove roots, "
        "bubbling toxic pools, fireflies and will-o-wisps, "
        "thick fog, decaying vegetation, dark green and brown palette"
    ),
}

GEAR_ICONS = {
    # Weapons
    "rusty_blade": "old rusty iron short sword, chipped blade, brown leather grip",
    "wooden_bow": "simple curved wooden longbow, bowstring visible",
    "worn_wand": "worn wooden magic wand, faint glow at tip",
    "rusty_daggers": "pair of rusty crossed daggers, short blades",
    "iron_sword": "polished iron longsword, silver blade, leather wrapped hilt",
    "hunting_knives": "pair of sharp hunting knives, curved blades",
    "arcane_staff": "ornate arcane staff, glowing purple crystal on top",
    "crystal_staff": "crystal-topped magic staff, blue glowing crystal",
    "shortbow": "compact shortbow, dark wood, taut string",
    "frost_daggers": "pair of ice-blue frost daggers, cold mist emanating",
    "cursed_scythe": "dark cursed war scythe, purple glow, curved blade",
    "longbow": "tall elegant longbow, elven design, golden string",
    "war_axe": "heavy double-headed war axe, steel blades, red leather grip",
    "great_sword": "massive two-handed greatsword, gleaming steel, ornate crossguard",
    "soulreaver": "legendary dark sword, souls swirling around blade, purple-black aura",
    "astral_longbow": "celestial longbow, glowing starlight string, ethereal blue",
    # Helmets
    "cloth_cap": "simple cloth cap, tan fabric, basic headwear",
    "steel_helm": "steel knight helmet, visor, polished metal",
    "shadow_hood": "dark shadow hood, mysterious black cloth, glowing eyes underneath",
    "mage_crown": "golden mage crown, embedded blue gem, ornate design",
    "berserker_helm": "horned berserker helmet, spiked iron, battle-worn",
    "dragon_helm": "dragon-shaped helm, red scales, fierce dragon motif",
    "crown_of_abyss": "dark abyssal crown, purple gems, void energy swirling",
    "crown_of_eternity": "radiant eternal crown, multiple gems, divine golden glow",
    # Chest
    "cloth_tunic": "simple cloth tunic, tan fabric, basic clothing",
    "chain_mail": "chain mail armor, interlocking steel rings, grey metal",
    "leather_vest": "brown leather vest armor, stitched, ranger style",
    "mage_robe": "blue mage robe, arcane symbols, flowing fabric",
    "plate_armor": "heavy plate armor, polished steel breastplate",
    "blood_plate": "crimson blood-stained plate armor, red glow, dark steel",
    "dragonscale": "dragon scale armor, green-gold scales, legendary",
    "voidplate": "void plate armor, dark purple, reality-warping edges",
    # Boots
    "worn_sandals": "worn leather sandals, simple straps, basic footwear",
    "steel_boots": "steel armored boots, polished metal, heavy duty",
    "swift_boots": "light swift boots, winged design, brown leather",
    "war_treads": "heavy war treads, spiked soles, reinforced steel",
    "windwalkers": "ethereal wind boots, faint breeze effect, light blue",
    "stormstriders": "storm boots, lightning crackling, electric blue glow",
    "godstriders": "divine golden boots, celestial glow, legendary footwear",
    # Accessories
    "copper_ring": "simple copper ring, plain band, slight green patina",
    "power_ring": "red power ring, glowing ruby gem, golden band",
    "speed_charm": "speed charm necklace, feather pendant, silver chain",
    "shadow_cloak": "dark shadow cloak, wispy black edges, mysterious",
    "mana_crystal": "blue mana crystal, glowing sapphire, magical energy",
    "life_amulet": "green life amulet, heart-shaped emerald, golden chain",
    "berserker_totem": "berserker totem pendant, bone and teeth, tribal",
    "heart_of_chaos": "chaos heart amulet, multicolored shifting gem, unstable energy",
    "heart_of_abyss": "abyss heart amulet, dark void gem, purple-black tendrils",
}


# ── SD API Functions ────────────────────────────────────────────────────────

def test_connection() -> bool:
    """Test if SD WebUI Forge API is reachable and check loaded model."""
    try:
        r = requests.get(f"{CONFIG['sd_url']}/sdapi/v1/options", timeout=5)
        if r.status_code == 200:
            data = r.json()
            model = data.get("sd_model_checkpoint", "unknown")
            print(f"Connected to SD WebUI Forge at {CONFIG['sd_url']}")
            print(f"  Model: {model}")
            if "flux" not in model.lower():
                print(f"  WARNING: Model doesn't appear to be FLUX. Expected a FLUX model.")
                print(f"  Switch model in the Forge UI or use --download-models first.")
            return True
        else:
            print(f"Forge returned status {r.status_code}")
            return False
    except requests.ConnectionError:
        print(f"Cannot connect to Forge at {CONFIG['sd_url']}")
        print("Make sure SD WebUI Forge is running with --api flag")
        return False


def generate_image(prompt: str, seed: int = -1,
                   width: int = None, height: int = None) -> "Image.Image | None":
    """Generate a single image via Forge txt2img API (FLUX.1 Dev settings)."""
    width = width or CONFIG["gen_size"]
    height = height or CONFIG["gen_size"]

    payload = {
        "prompt": prompt,
        "negative_prompt": "",  # FLUX doesn't use negative prompts
        "steps": CONFIG["sd_steps"],
        "cfg_scale": CONFIG["sd_cfg"],
        "sampler_name": CONFIG["sd_sampler"],
        "scheduler": "Simple",                          # Required for FLUX
        "distilled_cfg_scale": CONFIG["guidance"],      # FLUX guidance scale
        "width": width,
        "height": height,
        "seed": seed,
        "batch_size": 1,
        "n_iter": 1,
    }

    try:
        r = requests.post(
            f"{CONFIG['sd_url']}/sdapi/v1/txt2img",
            json=payload, timeout=300
        )
        if r.status_code != 200:
            print(f"  ERROR: Forge API returned {r.status_code}: {r.text[:200]}")
            return None

        data = r.json()
        images = data.get("images", [])
        if not images:
            print("  ERROR: No images returned")
            return None

        img_data = base64.b64decode(images[0])
        img = Image.open(io.BytesIO(img_data))
        return img

    except requests.ConnectionError:
        print("  ERROR: Lost connection to Forge")
        return None
    except Exception as e:
        print(f"  ERROR: {e}")
        return None


def generate_image_img2img(prompt: str, init_image: "Image.Image",
                           denoising: float = 0.55, seed: int = -1,
                           width: int = None, height: int = None) -> "Image.Image | None":
    """Generate via img2img for style-consistent pose variations.

    Uses the init_image (typically idle pose) as reference so that all poses
    from the same character share consistent color palette and proportions.
    """
    width = width or CONFIG["gen_size"]
    height = height or CONFIG["gen_size"]

    # Encode init image to base64 PNG
    buf = io.BytesIO()
    init_image.save(buf, format="PNG")
    init_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    payload = {
        "prompt": prompt,
        "negative_prompt": "",
        "init_images": [init_b64],
        "denoising_strength": denoising,
        "steps": CONFIG["sd_steps"],
        "cfg_scale": CONFIG["sd_cfg"],
        "sampler_name": CONFIG["sd_sampler"],
        "scheduler": "Simple",
        "distilled_cfg_scale": CONFIG["guidance"],
        "width": width,
        "height": height,
        "seed": seed,
        "batch_size": 1,
        "n_iter": 1,
    }

    try:
        r = requests.post(
            f"{CONFIG['sd_url']}/sdapi/v1/img2img",
            json=payload, timeout=300
        )
        if r.status_code != 200:
            print(f"  ERROR: img2img returned {r.status_code}: {r.text[:200]}")
            return None

        data = r.json()
        images = data.get("images", [])
        if not images:
            print("  ERROR: No images returned from img2img")
            return None

        img_data = base64.b64decode(images[0])
        return Image.open(io.BytesIO(img_data))

    except requests.ConnectionError:
        print("  ERROR: Lost connection to Forge")
        return None
    except Exception as e:
        print(f"  ERROR: {e}")
        return None


# ── Background Removal ──────────────────────────────────────────────────────

_rembg_session = None

def remove_bg(img: Image.Image) -> Image.Image:
    """Remove background using rembg neural network."""
    global _rembg_session
    try:
        from rembg import remove, new_session
        if _rembg_session is None:
            print("  Loading rembg model (first time only)...", flush=True)
            _rembg_session = new_session("u2net")
        result = remove(img, session=_rembg_session, bgcolor=(0, 0, 0, 0))
        return result
    except ImportError:
        print("  WARNING: rembg not installed, falling back to basic removal")
        return _remove_bg_basic(img)


def _remove_bg_basic(img: Image.Image) -> Image.Image:
    """Fallback: simple edge flood-fill background removal."""
    img = img.convert("RGBA")
    pixels = img.load()
    w, h = img.size

    # Get dominant edge color
    edge_colors = []
    for x in range(w):
        edge_colors.append(pixels[x, 0][:3])
        edge_colors.append(pixels[x, h-1][:3])
    for y in range(h):
        edge_colors.append(pixels[0, y][:3])
        edge_colors.append(pixels[w-1, y][:3])

    # Simple flood fill from edges
    visited = set()
    queue = []
    for x in range(w):
        queue.append((x, 0))
        queue.append((x, h - 1))
    for y in range(h):
        queue.append((0, y))
        queue.append((w - 1, y))

    bg_r, bg_g, bg_b = edge_colors[0] if edge_colors else (255, 255, 255)

    while queue:
        x, y = queue.pop()
        if (x, y) in visited or x < 0 or y < 0 or x >= w or y >= h:
            continue
        visited.add((x, y))
        r, g, b, a = pixels[x, y]
        # Check if close to background color
        dist = abs(r - bg_r) + abs(g - bg_g) + abs(b - bg_b)
        if dist < 80:
            pixels[x, y] = (0, 0, 0, 0)
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = x + dx, y + dy
                if (nx, ny) not in visited:
                    queue.append((nx, ny))

    return img


def downscale_nearest(img: Image.Image, size: int) -> Image.Image:
    """Downscale using NEAREST for pixel-crisp result."""
    return img.resize((size, size), Image.NEAREST)


def downscale_bg(img: Image.Image, width: int, height: int) -> Image.Image:
    """Downscale background to exact viewport size."""
    return img.resize((width, height), Image.NEAREST)


# ── Single-Frame Generation (original) ─────────────────────────────────────

def gen_hero(class_key: str, desc: str, seed: int = -1) -> "Path | None":
    """Generate a hero base sprite (single 128x128 frame)."""
    out_path = OUTPUT_DIR / "heroes" / f"{class_key}_base.png"
    if out_path.exists() and not CONFIG.get("force"):
        print(f"  SKIP (exists): {out_path.name}")
        return out_path

    if seed == -1:
        seed = _name_seed(class_key)

    print(f"  Generating hero: {class_key} (seed={seed})...", end=" ", flush=True)
    prompt = f"{STYLE_SPRITE}, {desc}"
    img = generate_image(prompt, seed=seed)
    if img is None:
        print("FAILED")
        return None

    img = remove_bg(img)
    img = downscale_nearest(img, HERO_SIZE)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    print(f"OK -> {out_path.name}")
    return out_path


def gen_monster(monster_key: str, desc: str, seed: int = -1) -> "Path | None":
    """Generate a monster sprite (single 128x128 frame)."""
    out_path = OUTPUT_DIR / "monsters" / f"{monster_key}.png"
    if out_path.exists() and not CONFIG.get("force"):
        print(f"  SKIP (exists): {out_path.name}")
        return out_path

    if seed == -1:
        seed = _name_seed(monster_key)

    print(f"  Generating monster: {monster_key} (seed={seed})...", end=" ", flush=True)
    prompt = (
        f"{STYLE_SPRITE}, {desc}, "
        f"single monster creature, enemy sprite, menacing"
    )
    img = generate_image(prompt, seed=seed)
    if img is None:
        print("FAILED")
        return None

    img = remove_bg(img)
    img = downscale_nearest(img, MONSTER_SIZE)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    print(f"OK -> {out_path.name}")
    return out_path


def gen_follower(follower_key: str, desc: str, seed: int = -1) -> "Path | None":
    """Generate a follower sprite (single 64x64 frame)."""
    out_path = OUTPUT_DIR / "followers" / f"{follower_key}.png"
    if out_path.exists() and not CONFIG.get("force"):
        print(f"  SKIP (exists): {out_path.name}")
        return out_path

    if seed == -1:
        seed = _name_seed(follower_key)

    print(f"  Generating follower: {follower_key} (seed={seed})...", end=" ", flush=True)
    prompt = (
        f"{STYLE_SPRITE}, {desc}, "
        f"tiny companion creature, small cute monster pet"
    )
    img = generate_image(prompt, seed=seed)
    if img is None:
        print("FAILED")
        return None

    img = remove_bg(img)
    img = downscale_nearest(img, FOLLOWER_SIZE)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    print(f"OK -> {out_path.name}")
    return out_path


def gen_background(bg_key: str, desc: str, seed: int = -1) -> "Path | None":
    """Generate a battle background (640x360)."""
    out_dir = OUTPUT_DIR.parent.parent / "tilesets" / "battle_backgrounds"
    out_path = out_dir / f"{bg_key}.png"
    if out_path.exists() and not CONFIG.get("force"):
        print(f"  SKIP (exists): {out_path.name}")
        return out_path

    if seed == -1:
        seed = _name_seed(bg_key)

    print(f"  Generating background: {bg_key} (seed={seed})...", end=" ", flush=True)
    prompt = f"{STYLE_BG}, {desc}"
    # Generate at 1024x576 (16:9 closest to 1024)
    img = generate_image(prompt, seed=seed, width=1024, height=576)
    if img is None:
        print("FAILED")
        return None

    img = downscale_bg(img, BG_WIDTH, BG_HEIGHT)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    print(f"OK -> {out_path.name}")
    return out_path


def gen_gear_icon(item_key: str, desc: str, seed: int = -1) -> "Path | None":
    """Generate a gear item icon (single 32x32 icon)."""
    out_path = OUTPUT_DIR / "gear" / f"{item_key}.png"
    if out_path.exists() and not CONFIG.get("force"):
        print(f"  SKIP (exists): {out_path.name}")
        return out_path

    if seed == -1:
        seed = _name_seed(item_key)

    print(f"  Generating gear icon: {item_key} (seed={seed})...", end=" ", flush=True)
    prompt = f"{STYLE_ICON}, {desc}"
    img = generate_image(prompt, seed=seed)
    if img is None:
        print("FAILED")
        return None

    img = remove_bg(img)
    img = downscale_nearest(img, GEAR_ICON_SIZE)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    print(f"OK -> {out_path.name}")
    return out_path


# ── Sprite Sheet Utilities ─────────────────────────────────────────────────

def _pixel_shift(img: Image.Image, dx: int, dy: int) -> Image.Image:
    """Shift image pixels by (dx, dy) with transparent fill."""
    shifted = Image.new("RGBA", img.size, (0, 0, 0, 0))
    shifted.paste(img, (dx, dy))
    return shifted


def _fill_animation_frames(poses: dict, anim_name: str,
                           cell_size: int, count: int = 6) -> list:
    """Fill `count` frames for an animation row from key poses.

    Takes generated key pose images and duplicates/shifts them to fill
    all frames in a row. This approximates FFT-style multi-frame animation
    from a small number of SD-generated key poses.

    Returns list of PIL Images, each cell_size x cell_size.
    """
    def _blank():
        return Image.new("RGBA", (cell_size, cell_size), (0, 0, 0, 0))

    def resize(img):
        if img is None:
            return _blank()
        return img.resize((cell_size, cell_size), Image.NEAREST)

    idle_1 = resize(poses.get("idle_1"))
    idle_2 = resize(poses.get("idle_2", poses.get("idle_1")))

    if anim_name == "idle":
        # Breathing cycle: subtle Y-shifts between two idle variants
        frames = [
            idle_1,
            _pixel_shift(idle_1, 0, -1),
            idle_2,
            _pixel_shift(idle_2, 0, -1),
            idle_1,
            _pixel_shift(idle_2, 0, 1),
        ]
    elif anim_name == "attack":
        windup = resize(poses.get("attack_windup", poses.get("idle_1")))
        strike = resize(poses.get("attack_strike", poses.get("idle_1")))
        frames = [
            idle_1,                          # ready
            windup,                          # wind up
            _pixel_shift(windup, 1, -1),     # hold windup (slight shift)
            strike,                          # strike
            _pixel_shift(strike, 2, 0),      # hold strike (forward lean)
            idle_1,                          # return
        ]
    elif anim_name == "hurt":
        flinch = resize(poses.get("hurt_flinch", poses.get("idle_1")))
        frames = [
            idle_1,                          # before hit
            flinch,                          # flinch
            _pixel_shift(flinch, -1, 0),     # hold flinch
            _pixel_shift(flinch, -2, 0),     # knockback
            idle_2,                          # recovering
            idle_1,                          # recovered
        ]
    elif anim_name == "cast":
        channel = resize(poses.get("cast_channel", poses.get("idle_1")))
        frames = [
            idle_1,                          # begin
            channel,                         # channel start
            _pixel_shift(channel, 0, -1),    # channel hold
            channel,                         # channel peak
            _pixel_shift(channel, 0, -1),    # release
            idle_1,                          # return
        ]
    elif anim_name == "death":
        flinch = resize(poses.get("hurt_flinch", poses.get("idle_1")))
        collapse = resize(poses.get("death_collapse", poses.get("idle_1")))
        frames = [
            flinch,                          # hit
            _pixel_shift(flinch, -1, 1),     # stagger
            _pixel_shift(flinch, -2, 2),     # falling
            collapse,                        # collapsed
            collapse,                        # hold
            collapse,                        # hold (stays on final frame)
        ]
    elif anim_name == "walk":
        # Derive walk from idle with horizontal + vertical bobbing
        frames = [
            idle_1,
            _pixel_shift(idle_1, 1, -1),
            idle_2,
            _pixel_shift(idle_2, -1, -1),
            idle_1,
            _pixel_shift(idle_1, -1, 1),
        ]
    else:
        frames = [idle_1] * count

    return frames[:count]


def _stitch_sheet(rows: list, cell_size: int, cols: int) -> Image.Image:
    """Stitch a list of frame-row lists into a single sprite sheet PNG.

    rows: list of lists of PIL Images (each row is a list of frame images).
    Returns assembled sheet as RGBA PIL Image.
    """
    num_rows = len(rows)
    sheet = Image.new("RGBA", (cols * cell_size, num_rows * cell_size), (0, 0, 0, 0))

    for r_idx, row_frames in enumerate(rows):
        for c_idx, frame in enumerate(row_frames):
            if frame:
                sheet.paste(frame, (c_idx * cell_size, r_idx * cell_size))

    return sheet


def _write_anim_json(json_path: Path, anim_def: dict) -> None:
    """Write animation definition JSON file alongside a sprite sheet."""
    json_path.parent.mkdir(parents=True, exist_ok=True)
    with open(json_path, "w") as f:
        json.dump(anim_def, f, indent=2)
    print(f"    JSON -> {json_path.name}")


# ── Sprite Sheet Generation (FFT-style animated) ──────────────────────────

def _generate_poses_for_sheet(base_desc: str, base_seed: int,
                              prompt_prefix: str = "",
                              pose_names: list = None) -> dict:
    """Generate key pose images via SD for sprite sheet assembly.

    1. Generates idle_1 via txt2img as the anchor pose
    2. Generates remaining poses via img2img with idle_1 as init for consistency
    3. Applies rembg background removal to all poses

    Returns dict of pose_name -> PIL Image (full resolution before downscale).
    """
    if pose_names is None:
        pose_names = list(POSE_SUFFIXES.keys())

    poses = {}
    idle_raw = None

    for pose_name in pose_names:
        if pose_name not in POSE_SUFFIXES:
            continue
        pose_suffix = POSE_SUFFIXES[pose_name]
        pose_seed = base_seed + hash(pose_name) % 10000

        if prompt_prefix:
            prompt = f"{STYLE_SPRITE}, {prompt_prefix}, {base_desc}, {pose_suffix}"
        else:
            prompt = f"{STYLE_SPRITE}, {base_desc}, {pose_suffix}"

        print(f"    Pose: {pose_name}...", end=" ", flush=True)

        if pose_name == "idle_1" or idle_raw is None:
            # First pose: use txt2img
            img = generate_image(prompt, seed=pose_seed)
            if img is not None:
                idle_raw = img
                poses[pose_name] = remove_bg(img)
                print("OK")
            else:
                print("FAILED")
        else:
            # Subsequent poses: use img2img with idle as init
            img = generate_image_img2img(prompt, idle_raw,
                                         denoising=0.55, seed=pose_seed)
            if img is not None:
                poses[pose_name] = remove_bg(img)
                print("OK")
            else:
                print("FAILED (using idle fallback)")

    return poses


def gen_hero_sheet(class_key: str, desc: str, seed: int = -1) -> "Path | None":
    """Generate a hero animated sprite sheet.

    Output: 384x384 PNG (6 cols x 6 rows of 64x64 cells) + companion .json
    Rows: idle, attack, hurt, cast, death, walk
    """
    out_path = OUTPUT_DIR / "heroes" / f"{class_key}_base.png"
    json_path = OUTPUT_DIR / "heroes" / f"{class_key}_base.json"

    if out_path.exists() and json_path.exists() and not CONFIG.get("force"):
        print(f"  SKIP (exists): {out_path.name}")
        return out_path

    if seed == -1:
        seed = _name_seed(class_key)

    print(f"  Generating hero sheet: {class_key} (seed={seed})")

    # Generate key poses via SD
    poses = _generate_poses_for_sheet(desc, seed)
    if not poses:
        print("    FAILED: No poses generated")
        return None

    # Fill animation frames for each row
    anim_rows = ["idle", "attack", "hurt", "cast", "death", "walk"]
    all_rows = []
    for anim_name in anim_rows:
        frames = _fill_animation_frames(poses, anim_name, HERO_CELL)
        all_rows.append(frames)

    # Stitch into sheet
    sheet = _stitch_sheet(all_rows, HERO_CELL, SHEET_COLS)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)
    print(f"    Sheet -> {out_path.name} ({sheet.size[0]}x{sheet.size[1]})")

    _write_anim_json(json_path, HERO_ANIM_DEF)
    return out_path


def gen_monster_sheet(monster_key: str, desc: str, seed: int = -1) -> "Path | None":
    """Generate a monster animated sprite sheet.

    Output: 384x384 PNG (6 cols x 6 rows of 64x64 cells) + companion .json
    Same format as hero sheets.
    """
    out_path = OUTPUT_DIR / "monsters" / f"{monster_key}.png"
    json_path = OUTPUT_DIR / "monsters" / f"{monster_key}.json"

    if out_path.exists() and json_path.exists() and not CONFIG.get("force"):
        print(f"  SKIP (exists): {out_path.name}")
        return out_path

    if seed == -1:
        seed = _name_seed(monster_key)

    print(f"  Generating monster sheet: {monster_key} (seed={seed})")

    poses = _generate_poses_for_sheet(
        desc, seed,
        prompt_prefix="single monster creature, enemy sprite, menacing"
    )
    if not poses:
        print("    FAILED: No poses generated")
        return None

    anim_rows = ["idle", "attack", "hurt", "cast", "death", "walk"]
    all_rows = []
    for anim_name in anim_rows:
        frames = _fill_animation_frames(poses, anim_name, HERO_CELL)
        all_rows.append(frames)

    sheet = _stitch_sheet(all_rows, HERO_CELL, SHEET_COLS)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)
    print(f"    Sheet -> {out_path.name} ({sheet.size[0]}x{sheet.size[1]})")

    _write_anim_json(json_path, HERO_ANIM_DEF)
    return out_path


def gen_follower_sheet(follower_key: str, desc: str, seed: int = -1) -> "Path | None":
    """Generate a follower animated sprite sheet.

    Output: 192x64 PNG (6 cols x 2 rows of 32x32 cells) + companion .json
    Rows: idle, attack (followers are simpler — only 2 animations)
    """
    out_path = OUTPUT_DIR / "followers" / f"{follower_key}.png"
    json_path = OUTPUT_DIR / "followers" / f"{follower_key}.json"

    if out_path.exists() and json_path.exists() and not CONFIG.get("force"):
        print(f"  SKIP (exists): {out_path.name}")
        return out_path

    if seed == -1:
        seed = _name_seed(follower_key)

    print(f"  Generating follower sheet: {follower_key} (seed={seed})")

    # Followers only need idle + attack poses
    follower_desc = f"{desc}, tiny companion creature, small cute monster pet"
    poses = _generate_poses_for_sheet(
        follower_desc, seed,
        pose_names=["idle_1", "idle_2", "attack_strike"]
    )
    if not poses:
        print("    FAILED: No poses generated")
        return None

    idle_frames = _fill_animation_frames(poses, "idle", FOLLOWER_CELL)
    attack_frames = _fill_animation_frames(poses, "attack", FOLLOWER_CELL)

    sheet = _stitch_sheet([idle_frames, attack_frames], FOLLOWER_CELL, SHEET_COLS)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)
    print(f"    Sheet -> {out_path.name} ({sheet.size[0]}x{sheet.size[1]})")

    _write_anim_json(json_path, FOLLOWER_ANIM_DEF)
    return out_path


# ── Placeholder Sheet Generation (no Forge required) ──────────────────────

def _gen_placeholder_cell(size: int, color: tuple, frame_idx: int = 0) -> Image.Image:
    """Generate a colored rectangle placeholder cell with frame marker."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    margin = size // 8
    draw.rectangle([margin, margin, size - margin - 1, size - margin - 1], fill=color)
    # Small dot pattern to distinguish frames within a row
    cx = size // 2 + (frame_idx - 2) * (size // 8)
    cy = size // 2
    dot_r = max(1, size // 16)
    draw.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r],
                 fill=(255, 255, 255, 200))
    return img


def _gen_placeholder_sheet(out_path: Path, json_path: Path, anim_def: dict,
                           cell_size: int, num_rows: int,
                           base_color: tuple) -> Path:
    """Generate a colored-rectangle placeholder sheet for testing."""
    row_tints = [0, 30, -30, 20, -50, 10]
    rows = []

    for r_idx in range(num_rows):
        tint = row_tints[r_idx % len(row_tints)]
        row_frames = []
        for c_idx in range(SHEET_COLS):
            r = max(0, min(255, base_color[0] + tint + c_idx * 8))
            g = max(0, min(255, base_color[1] + tint + c_idx * 8))
            b = max(0, min(255, base_color[2] + tint + c_idx * 8))
            cell = _gen_placeholder_cell(cell_size, (r, g, b, base_color[3]), c_idx)
            row_frames.append(cell)
        rows.append(row_frames)

    sheet = _stitch_sheet(rows, cell_size, SHEET_COLS)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)
    _write_anim_json(json_path, anim_def)

    print(f"  Placeholder -> {out_path.name} ({sheet.size[0]}x{sheet.size[1]})")
    return out_path


# Class-specific placeholder colors
_HERO_COLORS = {
    "barbarian": (180, 60, 60, 220),
    "wizard":    (60, 60, 180, 220),
    "ranger":    (60, 140, 60, 220),
    "assassin":  (100, 60, 140, 220),
}


def gen_placeholder_hero_sheet(class_key: str) -> Path:
    """Generate a placeholder hero sheet (no Forge needed)."""
    out_path = OUTPUT_DIR / "heroes" / f"{class_key}_base.png"
    json_path = OUTPUT_DIR / "heroes" / f"{class_key}_base.json"
    color = _HERO_COLORS.get(class_key, (120, 120, 120, 220))
    return _gen_placeholder_sheet(out_path, json_path, HERO_ANIM_DEF,
                                  HERO_CELL, SHEET_ROWS, color)


def gen_placeholder_monster_sheet(monster_key: str) -> Path:
    """Generate a placeholder monster sheet (no Forge needed)."""
    out_path = OUTPUT_DIR / "monsters" / f"{monster_key}.png"
    json_path = OUTPUT_DIR / "monsters" / f"{monster_key}.json"
    return _gen_placeholder_sheet(out_path, json_path, HERO_ANIM_DEF,
                                  HERO_CELL, SHEET_ROWS, (140, 80, 80, 220))


def gen_placeholder_follower_sheet(follower_key: str) -> Path:
    """Generate a placeholder follower sheet (no Forge needed)."""
    out_path = OUTPUT_DIR / "followers" / f"{follower_key}.png"
    json_path = OUTPUT_DIR / "followers" / f"{follower_key}.json"
    return _gen_placeholder_sheet(out_path, json_path, FOLLOWER_ANIM_DEF,
                                  FOLLOWER_CELL, FOLLOWER_SHEET_ROWS,
                                  (80, 140, 120, 220))


# ── Weapon Overlay Generation ──────────────────────────────────────────────

def gen_weapon_sheet(weapon_type: str, desc: str, seed: int = -1) -> "Path | None":
    """Generate a weapon overlay sprite sheet.

    Output: 384x64 PNG (6 cols x 1 row of 64x64 cells) + companion .json
    Shows the weapon in 6 attack animation frames.
    """
    out_path = OUTPUT_DIR / "weapons" / f"{weapon_type}.png"
    json_path = OUTPUT_DIR / "weapons" / f"{weapon_type}.json"

    if out_path.exists() and json_path.exists() and not CONFIG.get("force"):
        print(f"  SKIP (exists): {out_path.name}")
        return out_path

    if seed == -1:
        seed = _name_seed(weapon_type)

    print(f"  Generating weapon sheet: {weapon_type} (seed={seed})")

    # Generate 3 key frames: resting, raised, extended
    weapon_poses = {
        "rest": f"{desc}, weapon held at side, resting position",
        "raised": f"{desc}, weapon raised high overhead, ready to strike",
        "strike": f"{desc}, weapon extended forward in strike, dynamic angle",
    }

    frames = []
    prev_img = None
    for pose_name, pose_prompt in weapon_poses.items():
        pose_seed = seed + hash(pose_name) % 10000
        prompt = f"pixel art weapon sprite, {pose_prompt}, transparent background, clean pixel edges, 16-bit style"

        print(f"    Pose: {pose_name}...", end=" ", flush=True)
        if prev_img is not None:
            img = generate_image_img2img(prompt, prev_img, denoising=0.5, seed=pose_seed)
        else:
            img = generate_image(prompt, seed=pose_seed)

        if img is not None:
            img = remove_bg(img)
            img = img.resize((HERO_CELL, HERO_CELL), Image.NEAREST)
            frames.append(img)
            if prev_img is None:
                prev_img = img
            print("OK")
        else:
            print("FAILED")
            frames.append(Image.new("RGBA", (HERO_CELL, HERO_CELL), (0, 0, 0, 0)))

    # Pad key frames to 6: rest, raised, raised, strike, strike, rest
    while len(frames) < 3:
        frames.append(Image.new("RGBA", (HERO_CELL, HERO_CELL), (0, 0, 0, 0)))
    attack_row = [
        frames[0],                           # rest
        frames[1],                           # raised
        _pixel_shift(frames[1], 1, -1),      # raised hold
        frames[2],                           # strike
        _pixel_shift(frames[2], 2, 0),       # strike hold
        frames[0],                           # return to rest
    ]

    sheet = _stitch_sheet([attack_row], HERO_CELL, SHEET_COLS)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)
    print(f"    Sheet -> {out_path.name} ({sheet.size[0]}x{sheet.size[1]})")

    _write_anim_json(json_path, WEAPON_ANIM_DEF)
    return out_path


def gen_placeholder_weapon_sheet(weapon_type: str) -> Path:
    """Generate a placeholder weapon overlay sheet (no Forge needed)."""
    out_path = OUTPUT_DIR / "weapons" / f"{weapon_type}.png"
    json_path = OUTPUT_DIR / "weapons" / f"{weapon_type}.json"

    # Different hue per weapon type
    type_colors = {
        "sword": (180, 180, 200, 200),
        "axe": (160, 140, 120, 200),
        "bow": (120, 160, 100, 200),
        "staff": (120, 120, 200, 200),
        "daggers": (140, 140, 160, 200),
        "scythe": (160, 100, 160, 200),
    }
    base_color = type_colors.get(weapon_type, (150, 150, 150, 200))

    rows = []
    row_frames = []
    for c_idx in range(SHEET_COLS):
        r = max(0, min(255, base_color[0] + c_idx * 10))
        g = max(0, min(255, base_color[1] + c_idx * 10))
        b = max(0, min(255, base_color[2] + c_idx * 10))
        # Draw a thin weapon-like shape
        img = Image.new("RGBA", (HERO_CELL, HERO_CELL), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        # Diagonal line to represent a weapon
        draw.line([(20, 44), (44, 20)], fill=(r, g, b, base_color[3]), width=3)
        draw.ellipse([40, 16, 48, 24], fill=(r + 20, g + 20, b + 20, base_color[3]))
        row_frames.append(img)
    rows.append(row_frames)

    sheet = _stitch_sheet(rows, HERO_CELL, SHEET_COLS)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)
    _write_anim_json(json_path, WEAPON_ANIM_DEF)

    print(f"  Placeholder weapon -> {out_path.name}")
    return out_path


# ── Batch Generation ────────────────────────────────────────────────────────

def generate_heroes():
    """Generate all hero base sprites (single-frame)."""
    print("\n=== HERO SPRITES (128x128) ===")
    total = len(HERO_BASES)
    done = 0
    for class_key, desc in HERO_BASES.items():
        result = gen_hero(class_key, desc)
        if result:
            done += 1
    print(f"\nHeroes: {done}/{total} completed")
    return done


def generate_monsters():
    """Generate all monster sprites (single-frame)."""
    print("\n=== MONSTER SPRITES (128x128) ===")
    total = len(MONSTERS)
    done = 0
    for monster_key, desc in MONSTERS.items():
        result = gen_monster(monster_key, desc)
        if result:
            done += 1
    print(f"\nMonsters: {done}/{total} completed")
    return done


def generate_followers():
    """Generate all follower sprites (single-frame)."""
    print("\n=== FOLLOWER SPRITES (64x64) ===")
    total = len(FOLLOWERS)
    done = 0
    for follower_key, desc in FOLLOWERS.items():
        result = gen_follower(follower_key, desc)
        if result:
            done += 1
    print(f"\nFollowers: {done}/{total} completed")
    return done


def generate_backgrounds():
    """Generate all battle backgrounds."""
    print("\n=== BATTLE BACKGROUNDS (640x360) ===")
    total = len(BATTLE_BACKGROUNDS)
    done = 0
    for bg_key, desc in BATTLE_BACKGROUNDS.items():
        result = gen_background(bg_key, desc)
        if result:
            done += 1
    print(f"\nBackgrounds: {done}/{total} completed")
    return done


def generate_gear_icons():
    """Generate all gear item icons."""
    print("\n=== GEAR ICONS (32x32) ===")
    total = len(GEAR_ICONS)
    done = 0
    for item_key, desc in GEAR_ICONS.items():
        result = gen_gear_icon(item_key, desc)
        if result:
            done += 1
    print(f"\nGear icons: {done}/{total} completed")
    return done


def generate_hero_sheets():
    """Generate animated sprite sheets for all heroes."""
    print("\n=== HERO SPRITE SHEETS (384x384) ===")
    total = len(HERO_BASES)
    done = 0
    for class_key, desc in HERO_BASES.items():
        result = gen_hero_sheet(class_key, desc)
        if result:
            done += 1
    print(f"\nHero sheets: {done}/{total} completed")
    return done


def generate_monster_sheets():
    """Generate animated sprite sheets for all monsters."""
    print("\n=== MONSTER SPRITE SHEETS (384x384) ===")
    total = len(MONSTERS)
    done = 0
    for monster_key, desc in MONSTERS.items():
        result = gen_monster_sheet(monster_key, desc)
        if result:
            done += 1
    print(f"\nMonster sheets: {done}/{total} completed")
    return done


def generate_follower_sheets():
    """Generate animated sprite sheets for all followers."""
    print("\n=== FOLLOWER SPRITE SHEETS (192x64) ===")
    total = len(FOLLOWERS)
    done = 0
    for follower_key, desc in FOLLOWERS.items():
        result = gen_follower_sheet(follower_key, desc)
        if result:
            done += 1
    print(f"\nFollower sheets: {done}/{total} completed")
    return done


def generate_weapon_sheets():
    """Generate weapon overlay sprite sheets for all weapon types."""
    print("\n=== WEAPON OVERLAY SHEETS (384x64) ===")
    total = len(WEAPON_OVERLAYS)
    done = 0
    for weapon_type, desc in WEAPON_OVERLAYS.items():
        result = gen_weapon_sheet(weapon_type, desc)
        if result:
            done += 1
    print(f"\nWeapon sheets: {done}/{total} completed")
    return done


def generate_placeholder_sheets(category: str = "all"):
    """Generate placeholder sheets for testing without Forge."""
    print("\n=== PLACEHOLDER SHEETS (no Forge required) ===\n")

    if category in ("hero-sheets", "all", "all-sheets"):
        print("  Hero placeholders:")
        for class_key in HERO_BASES:
            gen_placeholder_hero_sheet(class_key)

    if category in ("monster-sheets", "all", "all-sheets"):
        print("\n  Monster placeholders:")
        for monster_key in MONSTERS:
            gen_placeholder_monster_sheet(monster_key)

    if category in ("follower-sheets", "all", "all-sheets"):
        print("\n  Follower placeholders:")
        for follower_key in FOLLOWERS:
            gen_placeholder_follower_sheet(follower_key)

    if category in ("weapon-sheets", "all", "all-sheets"):
        print("\n  Weapon placeholders:")
        for weapon_type in WEAPON_OVERLAYS:
            gen_placeholder_weapon_sheet(weapon_type)

    print("\nPlaceholder sheets generated! Animation system can be tested.")


def generate_prototype():
    """Generate a small test set to validate quality (single-frame)."""
    print("\n=== PROTOTYPE: Barbarian + 2 monsters + 1 follower + 1 background ===")
    print("Validates quality before full batch generation.\n")
    CONFIG["force"] = True

    gen_hero("barbarian", HERO_BASES["barbarian"])
    gen_monster("skeleton", MONSTERS["skeleton"])
    gen_monster("dragon", MONSTERS["dragon"])
    gen_follower("frost_wolf", FOLLOWERS["frost_wolf"])
    gen_background("dark_forest", BATTLE_BACKGROUNDS["dark_forest"])

    print("\nPrototype complete! Check files in:")
    print(f"  Heroes:      {OUTPUT_DIR / 'heroes'}")
    print(f"  Monsters:    {OUTPUT_DIR / 'monsters'}")
    print(f"  Followers:   {OUTPUT_DIR / 'followers'}")
    print(f"  Backgrounds: {OUTPUT_DIR.parent.parent / 'tilesets' / 'battle_backgrounds'}")
    print("\nIf quality looks good, run: --category all")


def generate_prototype_sheet():
    """Generate a small test set of animated sprite sheets."""
    print("\n=== PROTOTYPE SHEETS: Barbarian + Skeleton animated sheets ===")
    print("Validates sheet quality before full batch generation.\n")
    CONFIG["force"] = True

    gen_hero_sheet("barbarian", HERO_BASES["barbarian"])
    gen_monster_sheet("skeleton", MONSTERS["skeleton"])
    gen_follower_sheet("frost_wolf", FOLLOWERS["frost_wolf"])

    print("\nPrototype sheets complete! Check files in:")
    print(f"  Heroes:    {OUTPUT_DIR / 'heroes'}")
    print(f"  Monsters:  {OUTPUT_DIR / 'monsters'}")
    print(f"  Followers: {OUTPUT_DIR / 'followers'}")
    print("\nIf quality looks good, run: --category all-sheets")


def generate_single(name: str):
    """Generate a single sprite by name."""
    CONFIG["force"] = True

    if name.endswith("_base") and name[:-5] in HERO_BASES:
        class_key = name[:-5]
        gen_hero(class_key, HERO_BASES[class_key])
        return
    if name in HERO_BASES:
        gen_hero(name, HERO_BASES[name])
        return
    if name in MONSTERS:
        gen_monster(name, MONSTERS[name])
        return
    if name in FOLLOWERS:
        gen_follower(name, FOLLOWERS[name])
        return
    if name in BATTLE_BACKGROUNDS:
        gen_background(name, BATTLE_BACKGROUNDS[name])
        return
    if name in GEAR_ICONS:
        gen_gear_icon(name, GEAR_ICONS[name])
        return

    print(f"Unknown sprite name: {name}")
    print("Valid names:")
    print(f"  Heroes: {', '.join(HERO_BASES.keys())}")
    print(f"  Monsters: {', '.join(MONSTERS.keys())}")
    print(f"  Followers: {', '.join(FOLLOWERS.keys())}")
    print(f"  Backgrounds: {', '.join(BATTLE_BACKGROUNDS.keys())}")
    print(f"  Gear: {', '.join(GEAR_ICONS.keys())}")


def generate_single_sheet(name: str):
    """Generate a single animated sprite sheet by name."""
    CONFIG["force"] = True

    if name.endswith("_base") and name[:-5] in HERO_BASES:
        class_key = name[:-5]
        gen_hero_sheet(class_key, HERO_BASES[class_key])
        return
    if name in HERO_BASES:
        gen_hero_sheet(name, HERO_BASES[name])
        return
    if name in MONSTERS:
        gen_monster_sheet(name, MONSTERS[name])
        return
    if name in FOLLOWERS:
        gen_follower_sheet(name, FOLLOWERS[name])
        return

    print(f"Unknown sheet name: {name}")
    print("Valid names (same as sprites):")
    print(f"  Heroes: {', '.join(HERO_BASES.keys())}")
    print(f"  Monsters: {', '.join(MONSTERS.keys())}")
    print(f"  Followers: {', '.join(FOLLOWERS.keys())}")


# ── Model Download ──────────────────────────────────────────────────────────

FLUX_MODELS = {
    "checkpoint": {
        "url": "https://huggingface.co/city96/FLUX.1-dev-gguf/resolve/main/flux1-dev-Q8_0.gguf",
        "dest": "Stable-diffusion/flux1-dev-Q8_0.gguf",
        "size_gb": 12.2,
    },
    "vae": {
        "url": "https://huggingface.co/SicariusSicariiStuff/FLUX.1-dev/resolve/main/ae.safetensors",
        "dest": "VAE/ae.safetensors",
        "size_gb": 0.3,
    },
    "clip_l": {
        "url": "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors",
        "dest": "text_encoder/clip_l.safetensors",
        "size_gb": 0.25,
    },
    "t5xxl": {
        "url": "https://huggingface.co/city96/t5-v1_1-xxl-encoder-gguf/resolve/main/t5-v1_1-xxl-encoder-Q8_0.gguf",
        "dest": "text_encoder/t5-v1_1-xxl-encoder-Q8_0.gguf",
        "size_gb": 4.9,
    },
}


def download_models():
    """Download FLUX.1 Dev model files to Forge model directories."""
    print("\n=== FLUX.1 Dev Model Downloads ===\n")

    total_gb = sum(m["size_gb"] for m in FLUX_MODELS.values())
    print(f"Total download size: ~{total_gb:.1f} GB")
    print(f"Destination: {FORGE_MODELS_DIR}\n")

    for name, info in FLUX_MODELS.items():
        dest = FORGE_MODELS_DIR / info["dest"]
        if dest.exists():
            size_mb = dest.stat().st_size / (1024 * 1024)
            print(f"  [{name}] SKIP (exists, {size_mb:.0f} MB): {dest.name}")
            continue

        print(f"  [{name}] Downloading {info['size_gb']:.1f} GB: {dest.name}")
        print(f"    From: {info['url']}")
        print(f"    To:   {dest}")

        dest.parent.mkdir(parents=True, exist_ok=True)

        try:
            r = requests.get(info["url"], stream=True, timeout=30)
            r.raise_for_status()
            total = int(r.headers.get("content-length", 0))
            downloaded = 0
            chunk_size = 8 * 1024 * 1024  # 8MB chunks

            with open(dest, "wb") as f:
                for chunk in r.iter_content(chunk_size=chunk_size):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0:
                        pct = downloaded / total * 100
                        mb = downloaded / (1024 * 1024)
                        print(f"\r    Progress: {mb:.0f} MB / {total/(1024*1024):.0f} MB ({pct:.1f}%)", end="", flush=True)
            print(f"\n    Done: {dest.name}")

        except KeyboardInterrupt:
            print(f"\n    Cancelled! Removing partial file...")
            if dest.exists():
                dest.unlink()
            sys.exit(1)
        except Exception as e:
            print(f"\n    FAILED: {e}")
            if dest.exists():
                dest.unlink()
            continue

    print("\nModel downloads complete!")
    print("\nNext steps:")
    print("  1. Start Forge: webui-user.bat")
    print("  2. Select flux1-dev-Q8_0.gguf as the checkpoint in the UI")
    print("  3. Set VAE to ae.safetensors")
    print("  4. Run: python generate_sprites.py --prototype")


# ── Status / Inventory ──────────────────────────────────────────────────────

def show_status():
    """Show what sprites exist and what's missing."""
    print("\n=== SPRITE GENERATION STATUS ===\n")

    def count_files(path: Path, pattern: str = "*.png") -> int:
        if not path.exists():
            return 0
        return len(list(path.glob(pattern)))

    def count_json(path: Path) -> int:
        if not path.exists():
            return 0
        return len(list(path.glob("*.json")))

    hero_dir = OUTPUT_DIR / "heroes"
    hero_png = count_files(hero_dir)
    hero_json = count_json(hero_dir)
    hero_total = len(HERO_BASES)
    if hero_json > 0:
        print(f"Hero sheets (384x384):   {hero_png} PNG + {hero_json} JSON / {hero_total} classes")
    else:
        print(f"Heroes (128x128):        {hero_png}/{hero_total}")

    monster_dir = OUTPUT_DIR / "monsters"
    monster_png = count_files(monster_dir)
    monster_json = count_json(monster_dir)
    monster_total = len(MONSTERS)
    if monster_json > 0:
        print(f"Monster sheets (384x384): {monster_png} PNG + {monster_json} JSON / {monster_total} types")
    else:
        print(f"Monsters (128x128):      {monster_png}/{monster_total}")

    follower_dir = OUTPUT_DIR / "followers"
    follower_png = count_files(follower_dir)
    follower_json = count_json(follower_dir)
    follower_total = len(FOLLOWERS)
    if follower_json > 0:
        print(f"Follower sheets (192x64): {follower_png} PNG + {follower_json} JSON / {follower_total} types")
    else:
        print(f"Followers (64x64):       {follower_png}/{follower_total}")

    gear_count = count_files(OUTPUT_DIR / "gear")
    gear_total = len(GEAR_ICONS)
    print(f"Gear icons (32x32):      {gear_count}/{gear_total}")

    bg_dir = OUTPUT_DIR.parent.parent / "tilesets" / "battle_backgrounds"
    bg_count = count_files(bg_dir)
    bg_total = len(BATTLE_BACKGROUNDS)
    print(f"Backgrounds (640x360):   {bg_count}/{bg_total}")

    total = hero_total + monster_total + follower_total + gear_total + bg_total
    done = hero_png + monster_png + follower_png + gear_count + bg_count
    print(f"\nTotal PNG assets:        {done}/{total}")

    # Check model files
    print("\n=== MODEL STATUS ===\n")
    for name, info in FLUX_MODELS.items():
        dest = FORGE_MODELS_DIR / info["dest"]
        if dest.exists():
            size_mb = dest.stat().st_size / (1024 * 1024)
            print(f"  [{name}] OK ({size_mb:.0f} MB)")
        else:
            print(f"  [{name}] MISSING — run --download-models")

    if done < total:
        print(f"\nMissing {total - done} assets.")
        print("  Single-frame: --category all")
        print("  Sprite sheets: --category all-sheets")
        print("  Placeholders:  --placeholder all-sheets")


# ── CLI ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Generate pixel art sprites via FLUX.1 Dev on SD WebUI Forge",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--test", action="store_true",
                        help="Test Forge API connection")
    parser.add_argument("--status", action="store_true",
                        help="Show sprite + model status")
    parser.add_argument("--category",
                        choices=["heroes", "monsters", "followers", "gear",
                                 "backgrounds", "all",
                                 "hero-sheets", "monster-sheets",
                                 "follower-sheets", "weapon-sheets",
                                 "all-sheets"],
                        help="Generate assets by category")
    parser.add_argument("--single", type=str,
                        help="Generate a single sprite by name")
    parser.add_argument("--single-sheet", type=str,
                        help="Generate a single animated sprite sheet by name")
    parser.add_argument("--prototype", action="store_true",
                        help="Generate test set (barbarian + skeleton + dragon + wolf + bg)")
    parser.add_argument("--prototype-sheet", action="store_true",
                        help="Generate test sprite sheets (barbarian + skeleton + wolf)")
    parser.add_argument("--placeholder", type=str, metavar="CATEGORY",
                        help="Generate placeholder sheets without Forge "
                             "(hero-sheets, monster-sheets, follower-sheets, weapon-sheets, all-sheets)")
    parser.add_argument("--download-models", action="store_true",
                        help="Download FLUX.1 Dev model files (~18GB)")
    parser.add_argument("--url", type=str, default=None,
                        help=f"Forge URL (default: {CONFIG['sd_url']})")
    parser.add_argument("--steps", type=int, default=None,
                        help=f"Sampling steps (default: {CONFIG['sd_steps']})")
    parser.add_argument("--guidance", type=float, default=None,
                        help=f"FLUX guidance scale (default: {CONFIG['guidance']})")
    parser.add_argument("--force", action="store_true",
                        help="Regenerate even if file exists")

    args = parser.parse_args()

    if args.url:
        CONFIG["sd_url"] = args.url
    if args.steps:
        CONFIG["sd_steps"] = args.steps
    if args.guidance:
        CONFIG["guidance"] = args.guidance

    if args.download_models:
        download_models()
        return

    if args.status:
        show_status()
        return

    if args.test:
        if test_connection():
            print("\nConnection OK! Ready to generate sprites.")
        else:
            print("\nConnection FAILED. Check that Forge is running with --api flag.")
            sys.exit(1)
        return

    # Placeholder sheets don't need Forge
    if args.placeholder:
        valid = ("hero-sheets", "monster-sheets", "follower-sheets", "weapon-sheets", "all-sheets")
        if args.placeholder not in valid:
            print(f"Invalid placeholder category: {args.placeholder}")
            print(f"Valid: {', '.join(valid)}")
            sys.exit(1)
        CONFIG["force"] = True
        generate_placeholder_sheets(args.placeholder)
        return

    # Everything below requires Forge connection
    needs_forge = args.category or args.single or args.single_sheet \
                  or args.prototype or args.prototype_sheet
    if needs_forge:
        if not test_connection():
            print("\nCannot generate — Forge not reachable.")
            print(f"Expected at: {CONFIG['sd_url']}")
            if args.category and args.category.endswith("-sheets"):
                print(f"\nTip: Use --placeholder {args.category} to generate test sheets without Forge")
            sys.exit(1)

    if args.force:
        print("--force: Will overwrite existing sprites\n")
        CONFIG["force"] = True

    if args.prototype:
        generate_prototype()
    elif args.prototype_sheet:
        generate_prototype_sheet()
    elif args.single:
        generate_single(args.single)
    elif args.single_sheet:
        generate_single_sheet(args.single_sheet)
    elif args.category:
        start = time.time()
        # Single-frame categories
        if args.category in ("heroes", "all"):
            generate_heroes()
        if args.category in ("monsters", "all"):
            generate_monsters()
        if args.category in ("followers", "all"):
            generate_followers()
        if args.category in ("gear", "all"):
            generate_gear_icons()
        if args.category in ("backgrounds", "all"):
            generate_backgrounds()
        # Sprite sheet categories
        if args.category in ("hero-sheets", "all-sheets"):
            generate_hero_sheets()
        if args.category in ("monster-sheets", "all-sheets"):
            generate_monster_sheets()
        if args.category in ("follower-sheets", "all-sheets"):
            generate_follower_sheets()
        if args.category in ("weapon-sheets", "all-sheets"):
            generate_weapon_sheets()
        elapsed = time.time() - start
        print(f"\nTotal time: {elapsed:.1f}s")
        show_status()
    else:
        parser.print_help()
        print()
        show_status()


if __name__ == "__main__":
    main()
