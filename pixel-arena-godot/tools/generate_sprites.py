#!/usr/bin/env python3
"""
Pixel Arena — FLUX.1 Dev Sprite Generator

Generates pixel art sprites for heroes, monsters, followers, and battle
backgrounds using FLUX.1 Dev via the SD WebUI Forge API + rembg for
neural background removal.

Usage:
    python generate_sprites.py --help
    python generate_sprites.py --test                    # Test Forge API connection
    python generate_sprites.py --status                  # Show sprite inventory
    python generate_sprites.py --category heroes         # Generate hero bases
    python generate_sprites.py --category monsters       # Generate monster sprites
    python generate_sprites.py --category followers      # Generate follower sprites
    python generate_sprites.py --category backgrounds    # Generate battle backgrounds
    python generate_sprites.py --category all            # Generate everything
    python generate_sprites.py --single barbarian_base   # Generate one specific sprite
    python generate_sprites.py --prototype               # Barbarian + 2 monsters test
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
    from PIL import Image
except ImportError:
    print("Missing dependencies. Install with:")
    print("  python -m pip install requests Pillow rembg[gpu]")
    sys.exit(1)

# ── Configuration ───────────────────────────────────────────────────────────

OUTPUT_DIR = Path(__file__).parent.parent / "assets" / "sprites" / "generated"
FORGE_MODELS_DIR = Path("D:/stable-diffusion-webui-forge/models")

# Target sprite sizes after downscale
HERO_SIZE = 128       # Heroes: 128x128
MONSTER_SIZE = 128    # Monsters: 128x128
FOLLOWER_SIZE = 64    # Followers: 64x64
BG_WIDTH = 640        # Battle backgrounds: 640x360 (viewport size)
BG_HEIGHT = 360

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

STYLE_NPC = (
    "pixel art game character portrait, single figure, centered, "
    "transparent background, clean pixel edges, dark fantasy style, "
    "16-bit retro SNES style, crisp pixel art, no anti-aliasing"
)

DIO_BASE = (
    "ethereal male egregore god figure, molten orange-gold glowing skin, "
    "burning ember eyes, flowing dark robes with fire licking edges, "
    "otherworldly divine presence, smirking expression, "
    "dark horns wreathed in orange flame, muscular otherworldly physique"
)

NPC_SPRITES = {
    "dio_idle": (
        f"{DIO_BASE}, standing neutral pose, arms crossed, "
        "confident smirk, looking directly at viewer"
    ),
    "dio_pointing": (
        f"{DIO_BASE}, pointing finger directly at viewer, "
        "accusatory stance, raised eyebrow, challenging expression"
    ),
    "dio_laughing": (
        f"{DIO_BASE}, head thrown back laughing, open mouth, "
        "hand on chest, genuinely amused, shaking with laughter"
    ),
    "dio_disappointed": (
        f"{DIO_BASE}, palm on face facepalm, exasperated expression, "
        "slumped shoulders, visibly unimpressed, shaking head"
    ),
    "dio_impressed": (
        f"{DIO_BASE}, eyebrows raised in surprise, clapping hands, "
        "genuinely impressed expression, nodding approval, wide eyes"
    ),
    "dio_peeking": (
        f"{DIO_BASE}, peeking around corner, half body visible, "
        "one eye showing, sly grin, sneaky voyeuristic pose"
    ),
    "dio_lounging": (
        f"{DIO_BASE}, reclining on floating throne of fire, "
        "relaxed pose, one leg crossed, chin resting on hand, bored expression"
    ),
    "dio_dramatic": (
        f"{DIO_BASE}, dramatic cape flourish, arms wide open, "
        "presenting something grand, theatrical pose, intense gaze"
    ),
    "dio_suggestive_lean": (
        f"{DIO_BASE}, leaning against invisible wall, "
        "bedroom eyes half-lidded, hand on hip, confident flirtatious smirk, "
        "one arm raised against wall, sultry pose"
    ),
    "dio_blowing_kiss": (
        f"{DIO_BASE}, blowing a kiss with one hand, winking one eye, "
        "playful teasing expression, lips puckered, "
        "small flame heart floating from hand"
    ),
    "dio_facepalm": (
        f"{DIO_BASE}, both hands covering face, "
        "embarrassed for someone else, deep sigh, hunched forward"
    ),
    "dio_slow_clap": (
        f"{DIO_BASE}, slow sarcastic clapping, deadpan expression, "
        "unimpressed stare, golf clap pose, minimal effort"
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
            json=payload, timeout=900
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


GEAR_ICON_SIZE = 32  # 32x32 inventory icons


# ── Generation Functions ────────────────────────────────────────────────────

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


def gen_npc(npc_key: str, desc: str, seed: int = -1) -> "Path | None":
    """Generate an NPC sprite (single 128x128 frame)."""
    out_path = OUTPUT_DIR / "npcs" / f"{npc_key}.png"
    if out_path.exists() and not CONFIG.get("force"):
        print(f"  SKIP (exists): {out_path.name}")
        return out_path

    if seed == -1:
        seed = _name_seed(npc_key)

    print(f"  Generating NPC: {npc_key} (seed={seed})...", end=" ", flush=True)
    prompt = f"{STYLE_NPC}, {desc}"
    img = generate_image(prompt, seed=seed)
    if img is None:
        print("FAILED")
        return None

    img = remove_bg(img)
    img = downscale_nearest(img, HERO_SIZE)  # 128x128

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    print(f"OK -> {out_path.name}")
    return out_path


# ── Batch Generation ────────────────────────────────────────────────────────

def generate_heroes():
    """Generate all hero base sprites."""
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
    """Generate all monster sprites."""
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
    """Generate all follower sprites."""
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


def generate_npcs():
    """Generate all NPC sprites (Dio variants)."""
    print("\n=== NPC SPRITES (128x128) ===")
    total = len(NPC_SPRITES)
    done = 0
    for npc_key, desc in NPC_SPRITES.items():
        result = gen_npc(npc_key, desc)
        if result:
            done += 1
    print(f"\nNPCs: {done}/{total} completed")
    return done


def generate_prototype():
    """Generate a small test set to validate quality."""
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
    if name in NPC_SPRITES:
        gen_npc(name, NPC_SPRITES[name])
        return

    print(f"Unknown sprite name: {name}")
    print("Valid names:")
    print(f"  Heroes: {', '.join(HERO_BASES.keys())}")
    print(f"  Monsters: {', '.join(MONSTERS.keys())}")
    print(f"  Followers: {', '.join(FOLLOWERS.keys())}")
    print(f"  Backgrounds: {', '.join(BATTLE_BACKGROUNDS.keys())}")
    print(f"  Gear: {', '.join(GEAR_ICONS.keys())}")
    print(f"  NPCs: {', '.join(NPC_SPRITES.keys())}")


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

    hero_count = count_files(OUTPUT_DIR / "heroes")
    hero_total = len(HERO_BASES)
    print(f"Heroes (128x128):    {hero_count}/{hero_total}")

    monster_count = count_files(OUTPUT_DIR / "monsters")
    monster_total = len(MONSTERS)
    print(f"Monsters (128x128):  {monster_count}/{monster_total}")

    follower_count = count_files(OUTPUT_DIR / "followers")
    follower_total = len(FOLLOWERS)
    print(f"Followers (64x64):   {follower_count}/{follower_total}")

    gear_count = count_files(OUTPUT_DIR / "gear")
    gear_total = len(GEAR_ICONS)
    print(f"Gear icons (32x32):  {gear_count}/{gear_total}")

    npc_count = count_files(OUTPUT_DIR / "npcs")
    npc_total = len(NPC_SPRITES)
    print(f"NPCs (128x128):      {npc_count}/{npc_total}")

    bg_dir = OUTPUT_DIR.parent.parent / "tilesets" / "battle_backgrounds"
    bg_count = count_files(bg_dir)
    bg_total = len(BATTLE_BACKGROUNDS)
    print(f"Backgrounds (640x360): {bg_count}/{bg_total}")

    total = hero_total + monster_total + follower_total + gear_total + npc_total + bg_total
    done = hero_count + monster_count + follower_count + gear_count + npc_count + bg_count
    print(f"\nTotal:               {done}/{total} assets")

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
        print(f"\nMissing {total - done} assets. Run: --category all")


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
                        choices=["heroes", "monsters", "followers", "gear", "npcs", "backgrounds", "all"],
                        help="Generate assets by category")
    parser.add_argument("--single", type=str,
                        help="Generate a single sprite by name")
    parser.add_argument("--prototype", action="store_true",
                        help="Generate test set (barbarian + skeleton + dragon + wolf + bg)")
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

    if args.category or args.single or args.prototype:
        if not test_connection():
            print("\nCannot generate — Forge not reachable.")
            print(f"Expected at: {CONFIG['sd_url']}")
            sys.exit(1)

    if args.force:
        print("--force: Will overwrite existing sprites\n")
        CONFIG["force"] = True

    if args.prototype:
        generate_prototype()
    elif args.single:
        generate_single(args.single)
    elif args.category:
        start = time.time()
        if args.category in ("heroes", "all"):
            generate_heroes()
        if args.category in ("monsters", "all"):
            generate_monsters()
        if args.category in ("followers", "all"):
            generate_followers()
        if args.category in ("gear", "all"):
            generate_gear_icons()
        if args.category in ("npcs", "all"):
            generate_npcs()
        if args.category in ("backgrounds", "all"):
            generate_backgrounds()
        elapsed = time.time() - start
        print(f"\nTotal time: {elapsed:.1f}s")
        show_status()
    else:
        parser.print_help()
        print()
        show_status()


if __name__ == "__main__":
    main()
