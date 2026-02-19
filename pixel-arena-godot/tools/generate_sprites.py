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
    python generate_sprites.py --category gear           # Generate gear item icons
    python generate_sprites.py --category npcs           # Generate NPC sprites (Dio)
    python generate_sprites.py --category skills         # Generate skill/ultimate icons
    python generate_sprites.py --category logo           # Generate game logo
    python generate_sprites.py --category backgrounds    # Generate battle backgrounds
    python generate_sprites.py --category vfx            # Generate combat VFX sprites
    python generate_sprites.py --category ui_textures    # Generate UI panel/button textures
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
import threading
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


def _try_img2img(prompt: str, name: str, seed: int = -1,
                 width: int = None, height: int = None) -> "Image.Image | None":
    """If --reference-dir is set and a matching file exists, use img2img; else txt2img."""
    ref_dir = CONFIG.get("reference_dir")
    if ref_dir:
        ref_dir = Path(ref_dir)
        # Try common extensions
        for ext in (".png", ".jpg", ".jpeg", ".webp"):
            ref_path = ref_dir / f"{name}{ext}"
            if ref_path.exists():
                print(f"(img2img ref={ref_path.name}, strength={CONFIG['strength']}) ", end="", flush=True)
                return generate_image_img2img(
                    prompt, str(ref_path),
                    strength=CONFIG["strength"],
                    seed=seed, width=width, height=height
                )
    return generate_image(prompt, seed=seed, width=width, height=height)


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

STYLE_SKILL = (
    "pixel art RPG ability icon, single bold symbol centered, "
    "simple minimalist design, high contrast, bright vivid colors on solid dark background, "
    "clean pixel edges, 16-bit style, no text, no character, "
    "flat graphic game icon, thick outlines, easily recognizable at small size"
)

STYLE_LOGO = (
    "pixel art game logo title text, dark fantasy RPG style, "
    "golden yellow metallic text with dark red blood dripping, "
    "dramatic medieval fantasy font, transparent background, "
    "16-bit retro style, crisp clean pixel art, no character"
)

STYLE_VFX = (
    "pixel art RPG combat effect, single bold effect centered, "
    "simple minimalist design, high contrast, bright vivid colors on transparent background, "
    "clean pixel edges, 16-bit style, no text, no character, "
    "flat graphic game VFX, thick outlines, easily recognizable at small size"
)

STYLE_UI_TEXTURE = (
    "pixel art RPG user interface texture element, seamless tileable surface, "
    "simple minimalist design, high contrast, clean pixel edges, "
    "16-bit style, no text, no character, texture pattern only, "
    "flat graphic game UI, dark medieval fantasy aesthetic"
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
    "merchant_npc": (
        "hooded mysterious merchant figure, dark cloak, "
        "lantern hanging from belt, bags of goods and trinkets, "
        "glowing eyes under hood, shrewd expression, coin purse visible, "
        "fantasy RPG shopkeeper, warm lantern light"
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

SKILL_ICON_SPRITES = {
    # ── Mage Skills ──
    "chain_lightning": (
        "forked lightning bolt chain, branching blue-white electricity arcs, "
        "crackling energy, electric sparks scattering"
    ),
    "lightning_bolt": (
        "single bright lightning bolt, intense blue-white electric strike, "
        "sharp jagged bolt, small spark trail"
    ),
    "static_shield": (
        "glowing electric shield barrier, circular blue energy dome, "
        "crackling static sparks around edges, protective ward"
    ),
    "frost_nova": (
        "ice explosion burst, radiating frost shards, snowflake center, "
        "frozen crystalline shards flying outward, icy blue-white glow"
    ),
    "arcane_drain": (
        "swirling purple life-drain vortex, dark arcane energy spiral, "
        "purple and green soul siphon, magical essence flowing"
    ),
    # ── Ranger Skills ──
    "hunters_mark": (
        "glowing red crosshair target reticle, targeting mark, "
        "circular aim sight, red bullseye with lines"
    ),
    "bloodlust": (
        "crimson blood droplets splash, red frenzy aura, "
        "swirling blood energy, berserker rage red glow"
    ),
    "summon_pet": (
        "ghostly spirit wolf head, spectral blue-white animal spirit, "
        "glowing summoning circle beneath, ethereal beast"
    ),
    "rupture": (
        "exploding blood burst, crimson shards detonating outward, "
        "red gore splash effect, violent rupture explosion"
    ),
    "marked_for_death": (
        "dark skull crosshair mark, death targeting symbol, "
        "red and black death sigil, ominous glowing death mark"
    ),
    # ── Rogue Skills ──
    "shadow_step": (
        "single boot footprint made of purple-black smoke, "
        "ghostly dark speed lines behind it, simple teleport symbol"
    ),
    "envenom": (
        "bright green poison bottle with skull label, "
        "dripping toxic green liquid, simple potion vial icon"
    ),
    "smoke_bomb": (
        "dark grey smoke cloud explosion, round bomb with fuse, "
        "billowing smoke grenade burst, dark cloud spreading"
    ),
    "lacerate": (
        "three bloody slash marks, diagonal red claw cuts, "
        "bleeding wound slashes, sharp blade cuts with blood"
    ),
    "riposte": (
        "sword parry and counter-strike, crossed blades deflection, "
        "sparks from blade clash, defensive counter stance"
    ),
    # ── Warrior Skills ──
    "charge": (
        "rushing impact burst, speed lines with fist, "
        "powerful forward dash shockwave, yellow-orange impact"
    ),
    "war_cry": (
        "sonic shout shockwave rings, expanding sound waves, "
        "powerful battle roar emanating, orange-red voice blast"
    ),
    "battle_trance": (
        "fiery red aura surrounding figure silhouette, "
        "burning rage flames, berserker power-up glow, inner fire"
    ),
    "thorns": (
        "sharp green thorny vines coiled, spiky bramble barrier, "
        "nature thorn shield, barbed plant tendrils"
    ),
}

ULT_ICON_SPRITES = {
    "thunderstorm": (
        "massive storm cloud with multiple lightning bolts, "
        "epic electrical tempest, purple-blue storm fury, torrential power"
    ),
    "rain_of_fire": (
        "three bright orange fireballs falling downward with flame tails, "
        "simple meteor shower icon, bold fire streaks on dark sky"
    ),
    "death_mark": (
        "glowing death skull with timer, ticking death countdown, "
        "dark purple death rune with cracks, ominous final mark"
    ),
    "berserker": (
        "screaming berserker skull wreathed in flame, "
        "rage explosion red aura, berserk fury symbol, burning skull"
    ),
    "arcane_overload": (
        "massive arcane crystal explosion, prismatic purple-blue burst, "
        "overloading magical energy shattering, mana detonation"
    ),
    "primal_fury": (
        "beast claw swipe with primal energy, glowing animal paw print, "
        "feral green-orange nature fury, wild beast power"
    ),
    "shadow_dance": (
        "pair of crossed daggers with purple shadow aura, "
        "glowing violet crescent slash marks around blades, simple rogue icon"
    ),
    "last_stand": (
        "golden unbreakable shield glowing, divine protective barrier, "
        "holy invulnerable aura, radiant golden defense, final stand"
    ),
}

VFX_SPRITES = {
    # Melee slash effects (48x48)
    "vfx_slash_sword": (
        "single diagonal sword slash arc, bright white-yellow energy trail, "
        "clean sweeping cut motion line, golden sparks at tip"
    ),
    "vfx_slash_daggers": (
        "crossed X-pattern dual blade slashes, fast twin silver cuts forming an X, "
        "blue-white speed lines, sharp blade trails"
    ),
    "vfx_chop_axe": (
        "heavy vertical axe chop impact, top-down crushing strike, "
        "red-orange shockwave burst at bottom, powerful overhead cleave arc"
    ),
    "vfx_sweep_scythe": (
        "wide horizontal scythe sweep arc, dark purple energy trail, "
        "death reaper slash motion, ghostly purple-black crescent blade path"
    ),
    "vfx_slash_claw": (
        "three diagonal beast claw scratch marks, red bloody slash trails, "
        "savage triple claw swipe, feral scratch marks with sparks"
    ),
    # Projectile sprites (32x32)
    "vfx_proj_arrow": (
        "single wooden arrow in flight, steel arrowhead gleaming, "
        "feather fletching, horizontal arrow projectile with small speed trail"
    ),
    "vfx_proj_knife": (
        "small throwing dagger spinning in flight, glinting steel blade, "
        "compact spinning knife projectile, silver gleam trail"
    ),
    "vfx_proj_orb": (
        "glowing magical energy orb sphere, bright arcane energy ball, "
        "swirling inner light, soft magical glow aura radiating"
    ),
    # Hit impact effects (32x32)
    "vfx_hit_slash": (
        "blade impact spark burst, diagonal slash marks with white sparks scattering, "
        "sharp metal impact flash, bright steel clash"
    ),
    "vfx_hit_arrow": (
        "arrow impact burst, splintering wood fragments and dust cloud, "
        "thud impact shockwave, small debris flying outward"
    ),
    "vfx_hit_magic": (
        "magical sparkle burst explosion, prismatic energy shards scattering, "
        "colorful arcane impact, bright magic particle scatter"
    ),
    "vfx_hit_crit": (
        "massive critical hit starburst explosion, bright golden-white flash star, "
        "radiating impact lines, epic power burst, screen-filling impact"
    ),
    # Death effect (32x32)
    "vfx_death_soul": (
        "rising ghostly soul wisp, translucent pale blue-white spirit ascending upward, "
        "ethereal smoke trail, fading phantom essence"
    ),
    # Health bar frame (256x32) — will be hollowed out by post-processing
    "vfx_hp_frame": (
        "thick ornate golden metal rectangular frame border, bright shining gold with embedded gemstones, "
        "heavy medieval RPG health bar frame, bold raised golden edges with intricate engravings, "
        "solid bright gold trim with dark iron rivets, wide decorative border, centered horizontal rectangle"
    ),
}

SPELL_VFX_SPRITES = {
    "vfx_arcane_bolt": (
        "bright blue-white arcane energy bolt projectile, crackling lightning magic missile, "
        "glowing electric energy, fast moving spell projectile"
    ),
    "vfx_fireball": (
        "blazing orange fireball projectile, large ball of fire with flame trail, "
        "bright hot fire magic, explosive fire spell"
    ),
    "vfx_firebomb": (
        "fiery explosion burst, orange-red fire detonation, "
        "expanding flame blast, incendiary spell"
    ),
    "vfx_ice_lance": (
        "sharp ice crystal lance projectile, frozen blue-white ice shard, "
        "cold frost magic, crystalline ice spike"
    ),
    "vfx_darkness_bolt": (
        "dark purple shadow bolt projectile, dark energy missile, "
        "black-purple shadow magic, sinister dark spell"
    ),
    "vfx_darkness_orb": (
        "swirling dark void orb, black-purple sphere of shadow energy, "
        "dark magic sphere, menacing void spell"
    ),
    "vfx_magic_orb": (
        "glowing blue magical energy orb, bright arcane sphere, "
        "swirling magical essence, generic spell projectile"
    ),
    "vfx_light_bolt": (
        "bright golden holy light bolt, radiant healing energy, "
        "warm yellow-white divine light, restoration spell"
    ),
    "vfx_shield": (
        "translucent blue-gold protective shield barrier, magical ward, "
        "glowing defensive barrier dome, protection spell"
    ),
    "vfx_water_bolt": (
        "swirling blue water bolt projectile, water magic missile, "
        "liquid splash trail, aqua spell"
    ),
    "vfx_wind_bolt": (
        "swirling white-green wind gust projectile, air magic spiral, "
        "tornado wind slash, fast air spell"
    ),
    "vfx_plant_missile": (
        "green thorny vine projectile, nature magic missile, "
        "leafy plant tendril, organic nature spell"
    ),
    "vfx_magic_sparks": (
        "scattered magical sparkle particles, multi-colored magic sparks, "
        "generic spell particle effect, shimmering magic dust"
    ),
    "vfx_rock_sling": (
        "brown stone boulder projectile, earth magic rock, "
        "hurled rock sling stone, earthen spell"
    ),
    "vfx_holy_bolt": (
        "radiant golden holy light beam, divine purity bolt, "
        "bright yellow-white celestial energy, purifying spell"
    ),
}

UI_TEXTURES = {
    "ui_panel_stone": (
        "dark grey-blue stone brick wall surface texture, medieval dungeon carved stone blocks, "
        "subtle mortar lines between bricks, navy-blue tint cold stone, seamless tileable pattern"
    ),
    "ui_panel_inset": (
        "darker recessed carved stone surface texture, deep indented shadow, "
        "worn ancient stone with scratches, very dark navy-black carved depression, seamless tileable"
    ),
    "ui_button_normal": (
        "polished dark stone button slab surface, subtle golden trim edges, "
        "clean flat carved stone rectangle, dark grey-blue with faint gold border line, beveled stone"
    ),
    "ui_button_hover": (
        "warm glowing stone button slab surface, bright golden highlight edges, "
        "slightly brighter warm stone, amber glow emanating, illuminated carved stone rectangle"
    ),
    "ui_button_pressed": (
        "pressed indented dark stone button surface, deeper inner shadow, "
        "depressed inward carved stone, darker center with compressed edges, inset stone slab"
    ),
}

SLOT_ICONS = {
    "slot_weapon": (
        "simple dark iron sword silhouette icon, single weapon centered, "
        "empty equipment slot placeholder, muted grey metal, minimal detail"
    ),
    "slot_helmet": (
        "simple medieval helmet silhouette icon, single helm centered, "
        "empty equipment slot placeholder, muted grey metal, minimal detail"
    ),
    "slot_chest": (
        "simple chestplate breastplate silhouette icon, single armor centered, "
        "empty equipment slot placeholder, muted grey metal, minimal detail"
    ),
    "slot_boots": (
        "simple medieval boots silhouette icon, single pair of boots centered, "
        "empty equipment slot placeholder, muted grey metal, minimal detail"
    ),
    "slot_accessory": (
        "simple magical ring silhouette icon, single ring centered, "
        "empty equipment slot placeholder, muted grey metal, minimal detail"
    ),
}

EVENT_ICONS = {
    "event_treasure": (
        "golden treasure chest, open wooden chest overflowing with gold coins, "
        "sparkle gleam, classic RPG loot chest"
    ),
    "event_rest": (
        "warm campfire torch, lit wooden torch with orange flame, "
        "rest and healing, warm firelight glow"
    ),
    "event_merchant": (
        "pile of gold coins, shining golden coins stacked, "
        "merchant shop currency, gleaming gold"
    ),
    "event_cage": (
        "iron prison cage bars, metal cage with lock, "
        "trapped prisoner cage, dark iron bars"
    ),
    "event_potion": (
        "red health potion bottle, glass flask with glowing red liquid, "
        "healing elixir, cork stopper, bubbling"
    ),
    "event_shrine": (
        "glowing ancient altar shrine, mystical purple energy, "
        "blood offering pedestal, dark stone shrine with magical runes"
    ),
    "event_trap_spike": (
        "sharp metal floor spikes trap, iron spike pit, "
        "mechanical dungeon hazard, bloody steel points"
    ),
    "event_trap_poison": (
        "green toxic poison gas cloud, bubbling poison flask, "
        "noxious fumes, glowing green gas trap"
    ),
}

# Larger event icons for room overlays (64x64 output)
EVENT_ICON_SIZE_LG = 64

EVENT_ICONS_LG = {
    "event_treasure_lg": (
        "ornate golden treasure chest overflowing with gems and gold coins, "
        "open lid, sparkle gleam, jewels spilling out, detailed RPG loot chest"
    ),
    "event_rest_lg": (
        "warm campfire with bedroll beside it, safe haven resting spot, "
        "orange firelight glow, comfortable camp setup, starry atmosphere"
    ),
    "event_merchant_lg": (
        "merchant's market stall with hanging goods, warm lantern light, "
        "potions and weapons on display, wooden shop counter, fantasy bazaar"
    ),
    "event_shrine_lg": (
        "glowing mystical shrine altar, purple arcane energy swirling, "
        "ancient stone pedestal with magical runes, dark temple setting"
    ),
    "event_cage_lg": (
        "iron prison cage with glowing padlock, trapped creature silhouette, "
        "thick metal bars, dungeon floor, flickering torchlight"
    ),
}

# Misc icons for overlays (48x48 output, skill-style)
MISC_ICONS = {
    "icon_victory": (
        "golden trophy laurel wreath, victory crown symbol, "
        "radiant golden light, triumphant achievement emblem"
    ),
    "icon_defeat": (
        "cracked skull on dark ground, death symbol, "
        "broken bones, dark red glow, defeat and fallen warrior"
    ),
    "icon_potion_lg": (
        "glass health potion bottle, glowing red bubbling liquid, "
        "cork stopper, detailed fantasy healing elixir, magical shimmer"
    ),
}

LOGO_SPRITES = {
    "game_logo": (
        "text saying 'Some of you may die' in dramatic fantasy font, "
        "golden yellow metallic letters with dark red blood dripping down, "
        "medieval dark fantasy RPG title, ominous threatening text"
    ),
    "softbacon_logo": (
        "pixel art game studio logo, crispy bacon strip with a soft warm glow, "
        "text saying 'SoftBacon Software' in playful rounded pixel font, "
        "warm orange and red bacon colors, cozy indie game studio branding, "
        "simple clean design, charming retro pixel art style"
    ),
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


def _poll_progress(stop_event: threading.Event, bar_width: int = 30):
    """Poll Forge progress endpoint and display a live progress bar."""
    while not stop_event.is_set():
        try:
            r = requests.get(f"{CONFIG['sd_url']}/sdapi/v1/progress", timeout=3)
            if r.status_code == 200:
                data = r.json()
                pct = data.get("progress", 0)
                state = data.get("state", {})
                step = state.get("sampling_step", 0)
                total_steps = state.get("sampling_steps", CONFIG["sd_steps"])
                eta = data.get("eta_relative", 0)

                filled = int(bar_width * pct)
                bar = "█" * filled + "░" * (bar_width - filled)
                eta_str = f"~{eta:.0f}s" if eta > 0 else "..."
                print(f"\r    [{bar}] {pct*100:5.1f}% step {step}/{total_steps} ETA {eta_str}  ", end="", flush=True)
        except Exception:
            pass
        stop_event.wait(1.0)  # Poll every 1s


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

    # Start progress polling thread
    stop_event = threading.Event()
    poll_thread = threading.Thread(target=_poll_progress, args=(stop_event,), daemon=True)
    poll_thread.start()

    try:
        t0 = time.time()
        r = requests.post(
            f"{CONFIG['sd_url']}/sdapi/v1/txt2img",
            json=payload, timeout=900
        )
        elapsed = time.time() - t0

        stop_event.set()
        poll_thread.join(timeout=2)
        # Clear progress bar line
        print(f"\r    {'':60}", end="\r", flush=True)

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
        stop_event.set()
        print("  ERROR: Lost connection to Forge")
        return None
    except Exception as e:
        stop_event.set()
        print(f"  ERROR: {e}")
        return None


def generate_image_img2img(prompt: str, reference_path: str, strength: float = 0.5,
                           seed: int = -1, width: int = None, height: int = None) -> "Image.Image | None":
    """Generate an image via Forge img2img API using a reference image.

    Args:
        prompt: Text prompt describing desired output.
        reference_path: Path to the reference image file.
        strength: Denoising strength (0.0=copy reference, 1.0=ignore reference).
        seed: RNG seed (-1 for random).
        width: Output width (default: CONFIG gen_size).
        height: Output height (default: CONFIG gen_size).
    """
    width = width or CONFIG["gen_size"]
    height = height or CONFIG["gen_size"]

    ref_img = Image.open(reference_path).convert("RGB")
    ref_img = ref_img.resize((width, height), Image.LANCZOS)
    buf = io.BytesIO()
    ref_img.save(buf, format="PNG")
    ref_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    payload = {
        "prompt": prompt,
        "negative_prompt": "",
        "init_images": [ref_b64],
        "denoising_strength": strength,
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

    stop_event = threading.Event()
    poll_thread = threading.Thread(target=_poll_progress, args=(stop_event,), daemon=True)
    poll_thread.start()

    try:
        t0 = time.time()
        r = requests.post(
            f"{CONFIG['sd_url']}/sdapi/v1/img2img",
            json=payload, timeout=900
        )
        elapsed = time.time() - t0

        stop_event.set()
        poll_thread.join(timeout=2)
        print(f"\r    {'':60}", end="\r", flush=True)

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
        stop_event.set()
        print("  ERROR: Lost connection to Forge")
        return None
    except Exception as e:
        stop_event.set()
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
SKILL_ICON_SIZE = 48  # 48x48 ability icons (slightly larger for detail)
LOGO_WIDTH = 480      # Game logo: 480x160
LOGO_HEIGHT = 160
VFX_SIZE_LARGE = 48   # Melee slash and crit effects: 48x48
VFX_SIZE_SMALL = 32   # Projectiles, hits, death: 32x32
UI_TEX_PANEL_SIZE = 64  # Panel textures: 64x64
UI_TEX_BTN_WIDTH = 64   # Button textures: 64x24
UI_TEX_BTN_HEIGHT = 24


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
    img = _try_img2img(prompt, f"{class_key}_base", seed=seed)
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
    img = _try_img2img(prompt, monster_key, seed=seed)
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
    img = _try_img2img(prompt, follower_key, seed=seed)
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


def gen_skill_icon(skill_key: str, desc: str, seed: int = -1) -> "Path | None":
    """Generate a skill/ultimate ability icon (single 48x48 icon)."""
    out_path = OUTPUT_DIR / "skills" / f"{skill_key}.png"
    if out_path.exists() and not CONFIG.get("force"):
        print(f"SKIP (exists): {out_path.name}")
        return out_path

    if seed == -1:
        seed = _name_seed(skill_key)

    print(f"{skill_key} (seed={seed})")
    t0 = time.time()
    prompt = f"{STYLE_SKILL}, {desc}"
    img = generate_image(prompt, seed=seed)
    if img is None:
        print(f"    FAILED ({time.time()-t0:.1f}s)")
        return None

    print(f"    Removing background...", end=" ", flush=True)
    img = remove_bg(img)
    img = downscale_nearest(img, SKILL_ICON_SIZE)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    print(f"OK -> {out_path.name} ({time.time()-t0:.1f}s)")
    return out_path


def gen_logo(logo_key: str, desc: str, seed: int = -1) -> "Path | None":
    """Generate the game logo (480x160 wide banner)."""
    out_path = OUTPUT_DIR / "ui" / f"{logo_key}.png"
    if out_path.exists() and not CONFIG.get("force"):
        print(f"  SKIP (exists): {out_path.name}")
        return out_path

    if seed == -1:
        seed = _name_seed(logo_key)

    print(f"  Generating logo: {logo_key} (seed={seed})...", end=" ", flush=True)
    prompt = f"{STYLE_LOGO}, {desc}"
    # Generate at 1024x384 (~2.67:1 aspect ratio close to 3:1 logo)
    img = generate_image(prompt, seed=seed, width=1024, height=384)
    if img is None:
        print("FAILED")
        return None

    img = remove_bg(img)
    img = img.resize((LOGO_WIDTH, LOGO_HEIGHT), Image.NEAREST)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    print(f"OK -> {out_path.name}")
    return out_path


def gen_vfx(vfx_key: str, desc: str, size: int = None, seed: int = -1) -> "Path | None":
    """Generate a VFX combat sprite (48x48 for slashes/crit, 32x32 for others, 128x16 for hp_frame)."""
    out_path = OUTPUT_DIR / "vfx" / f"{vfx_key}.png"
    if out_path.exists() and not CONFIG.get("force"):
        print(f"SKIP (exists): {out_path.name}")
        return out_path

    # HP bar frame is a special wide aspect ratio
    is_hp_frame = vfx_key == "vfx_hp_frame"

    if size is None:
        if is_hp_frame:
            size = 256  # width; height will be 32
        elif vfx_key.startswith("vfx_slash") or vfx_key == "vfx_hit_crit":
            size = VFX_SIZE_LARGE
        else:
            size = VFX_SIZE_SMALL

    if seed == -1:
        seed = _name_seed(vfx_key)

    print(f"{vfx_key} (seed={seed})")
    t0 = time.time()
    prompt = f"{STYLE_VFX}, {desc}"
    if is_hp_frame:
        img = generate_image(prompt, seed=seed, width=1024, height=192)
    else:
        img = generate_image(prompt, seed=seed)
    if img is None:
        print(f"    FAILED ({time.time()-t0:.1f}s)")
        return None

    if is_hp_frame:
        # No rembg for frame — downscale to 256x32, then hollow out center
        img = img.resize((256, 32), Image.NEAREST)
        img = img.convert("RGBA")
        w, h = img.size
        border = 4
        # Make center transparent, keep border
        for y in range(border, h - border):
            for x in range(border, w - border):
                r, g, b, a = img.getpixel((x, y))
                img.putpixel((x, y), (r, g, b, 0))
        print(f"    Hollowed center...", end=" ", flush=True)
    else:
        print(f"    Removing background...", end=" ", flush=True)
        img = remove_bg(img)
        img = downscale_nearest(img, size)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    print(f"OK -> {out_path.name} ({time.time()-t0:.1f}s)")
    return out_path


def gen_slot_icon(slot_key: str, desc: str, seed: int = -1) -> "Path | None":
    """Generate a slot placeholder icon (single 32x32 icon)."""
    out_path = OUTPUT_DIR / "gear" / f"{slot_key}.png"
    if out_path.exists() and not CONFIG.get("force"):
        print(f"  SKIP (exists): {out_path.name}")
        return out_path

    if seed == -1:
        seed = _name_seed(slot_key)

    print(f"  Generating slot icon: {slot_key} (seed={seed})...", end=" ", flush=True)
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


def gen_event_icon_lg(icon_key: str, desc: str, seed: int = -1) -> "Path | None":
    """Generate a large event icon (64x64) for room overlays."""
    out_path = OUTPUT_DIR / "events" / f"{icon_key}.png"
    if out_path.exists() and not CONFIG.get("force"):
        print(f"  SKIP (exists): {out_path.name}")
        return out_path

    if seed == -1:
        seed = _name_seed(icon_key)

    print(f"  Generating event icon: {icon_key} (seed={seed})...", end=" ", flush=True)
    prompt = f"{STYLE_ICON}, {desc}"
    img = generate_image(prompt, seed=seed)
    if img is None:
        print("FAILED")
        return None

    img = remove_bg(img)
    img = downscale_nearest(img, EVENT_ICON_SIZE_LG)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    print(f"OK -> {out_path.name}")
    return out_path


def gen_misc_icon(icon_key: str, desc: str, seed: int = -1) -> "Path | None":
    """Generate a misc overlay icon (48x48, skill-style with bg removal)."""
    out_path = OUTPUT_DIR / "icons" / f"{icon_key}.png"
    if out_path.exists() and not CONFIG.get("force"):
        print(f"  SKIP (exists): {out_path.name}")
        return out_path

    if seed == -1:
        seed = _name_seed(icon_key)

    print(f"  Generating misc icon: {icon_key} (seed={seed})...", end=" ", flush=True)
    prompt = f"{STYLE_SKILL}, {desc}"
    img = generate_image(prompt, seed=seed)
    if img is None:
        print("FAILED")
        return None

    img = remove_bg(img)
    img = downscale_nearest(img, SKILL_ICON_SIZE)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    print(f"OK -> {out_path.name}")
    return out_path


def gen_ui_texture(tex_key: str, desc: str, seed: int = -1) -> "Path | None":
    """Generate a UI texture (64x64 panels, 64x24 buttons). No background removal."""
    out_path = OUTPUT_DIR / "ui" / f"{tex_key}.png"
    if out_path.exists() and not CONFIG.get("force"):
        print(f"SKIP (exists): {out_path.name}")
        return out_path

    if seed == -1:
        seed = _name_seed(tex_key)

    is_button = tex_key.startswith("ui_button_")
    if is_button:
        width = UI_TEX_BTN_WIDTH
        height = UI_TEX_BTN_HEIGHT
    else:
        width = UI_TEX_PANEL_SIZE
        height = UI_TEX_PANEL_SIZE

    print(f"{tex_key} (seed={seed})")
    t0 = time.time()
    prompt = f"{STYLE_UI_TEXTURE}, {desc}"
    # Generate at wider aspect for buttons, square for panels
    if is_button:
        img = generate_image(prompt, seed=seed, width=1024, height=384)
    else:
        img = generate_image(prompt, seed=seed)
    if img is None:
        print(f"    FAILED ({time.time()-t0:.1f}s)")
        return None

    # No rembg — UI textures need opaque backgrounds
    img = img.resize((width, height), Image.NEAREST)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    print(f"    OK -> {out_path.name} ({time.time()-t0:.1f}s)")
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


def generate_skill_icons():
    """Generate all skill and ultimate ability icons."""
    print("\n=== SKILL ICONS (48x48) ===")
    all_skills = {**SKILL_ICON_SPRITES, **ULT_ICON_SPRITES}
    total = len(all_skills)
    done = 0
    batch_start = time.time()
    for i, (skill_key, desc) in enumerate(all_skills.items()):
        print(f"\n  [{i+1}/{total}] ", end="")
        result = gen_skill_icon(skill_key, desc)
        if result:
            done += 1
        elapsed = time.time() - batch_start
        avg = elapsed / (i + 1)
        remaining = avg * (total - i - 1)
        print(f"    Batch: {done}/{total} done, {elapsed:.0f}s elapsed, ~{remaining:.0f}s remaining")
    print(f"\nSkill icons: {done}/{total} completed")
    return done


def generate_logo():
    """Generate the game logo."""
    print("\n=== GAME LOGO (480x160) ===")
    total = len(LOGO_SPRITES)
    done = 0
    for logo_key, desc in LOGO_SPRITES.items():
        result = gen_logo(logo_key, desc)
        if result:
            done += 1
    print(f"\nLogos: {done}/{total} completed")
    return done


def generate_vfx():
    """Generate all VFX combat sprites."""
    print("\n=== VFX SPRITES (48x48 / 32x32) ===")
    total = len(VFX_SPRITES)
    done = 0
    batch_start = time.time()
    for i, (vfx_key, desc) in enumerate(VFX_SPRITES.items()):
        print(f"\n  [{i+1}/{total}] ", end="")
        result = gen_vfx(vfx_key, desc)
        if result:
            done += 1
        elapsed = time.time() - batch_start
        avg = elapsed / (i + 1)
        remaining = avg * (total - i - 1)
        print(f"    Batch: {done}/{total} done, {elapsed:.0f}s elapsed, ~{remaining:.0f}s remaining")
    print(f"\nVFX sprites: {done}/{total} completed")
    return done


def generate_event_icons():
    """Generate all dungeon event icons."""
    print("\n=== EVENT ICONS (32x32) ===")
    total = len(EVENT_ICONS)
    done = 0
    for event_key, desc in EVENT_ICONS.items():
        result = gen_slot_icon(event_key, desc)  # same pipeline as slot icons (32x32 gear)
        if result:
            done += 1
    print(f"\nEvent icons: {done}/{total} completed")
    return done


def generate_large_event_icons():
    """Generate large (64x64) event icons for room overlays."""
    print("\n=== LARGE EVENT ICONS (64x64) ===")
    total = len(EVENT_ICONS_LG)
    done = 0
    for icon_key, desc in EVENT_ICONS_LG.items():
        result = gen_event_icon_lg(icon_key, desc)
        if result:
            done += 1
    print(f"\nLarge event icons: {done}/{total} completed")
    return done


def generate_misc_icons():
    """Generate misc overlay icons (victory, defeat, potion)."""
    print("\n=== MISC ICONS (48x48) ===")
    total = len(MISC_ICONS)
    done = 0
    for icon_key, desc in MISC_ICONS.items():
        result = gen_misc_icon(icon_key, desc)
        if result:
            done += 1
    print(f"\nMisc icons: {done}/{total} completed")
    return done


def generate_slot_icons():
    """Generate all slot placeholder icons."""
    print("\n=== SLOT ICONS (32x32) ===")
    total = len(SLOT_ICONS)
    done = 0
    for slot_key, desc in SLOT_ICONS.items():
        result = gen_slot_icon(slot_key, desc)
        if result:
            done += 1
    print(f"\nSlot icons: {done}/{total} completed")
    return done


def generate_spell_vfx():
    """Generate all spell VFX projectile sprites."""
    print("\n=== SPELL VFX SPRITES (32x32) ===")
    total = len(SPELL_VFX_SPRITES)
    done = 0
    batch_start = time.time()
    for i, (vfx_key, desc) in enumerate(SPELL_VFX_SPRITES.items()):
        print(f"\n  [{i+1}/{total}] ", end="")
        result = gen_vfx(vfx_key, desc, size=VFX_SIZE_SMALL)
        if result:
            done += 1
        elapsed = time.time() - batch_start
        avg = elapsed / (i + 1)
        remaining = avg * (total - i - 1)
        print(f"    Batch: {done}/{total} done, {elapsed:.0f}s elapsed, ~{remaining:.0f}s remaining")
    print(f"\nSpell VFX: {done}/{total} completed")
    return done


def generate_ui_textures():
    """Generate all UI panel and button textures."""
    print("\n=== UI TEXTURES (64x64 / 64x24) ===")
    total = len(UI_TEXTURES)
    done = 0
    batch_start = time.time()
    for i, (tex_key, desc) in enumerate(UI_TEXTURES.items()):
        print(f"\n  [{i+1}/{total}] ", end="")
        result = gen_ui_texture(tex_key, desc)
        if result:
            done += 1
        elapsed = time.time() - batch_start
        avg = elapsed / (i + 1)
        remaining = avg * (total - i - 1)
        print(f"    Batch: {done}/{total} done, {elapsed:.0f}s elapsed, ~{remaining:.0f}s remaining")
    print(f"\nUI textures: {done}/{total} completed")
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
    if name in SKILL_ICON_SPRITES:
        gen_skill_icon(name, SKILL_ICON_SPRITES[name])
        return
    if name in ULT_ICON_SPRITES:
        gen_skill_icon(name, ULT_ICON_SPRITES[name])
        return
    if name in LOGO_SPRITES:
        gen_logo(name, LOGO_SPRITES[name])
        return
    if name in VFX_SPRITES:
        gen_vfx(name, VFX_SPRITES[name])
        return
    if name in SPELL_VFX_SPRITES:
        gen_vfx(name, SPELL_VFX_SPRITES[name], size=VFX_SIZE_SMALL)
        return
    if name in UI_TEXTURES:
        gen_ui_texture(name, UI_TEXTURES[name])
        return
    if name in SLOT_ICONS:
        gen_slot_icon(name, SLOT_ICONS[name])
        return
    if name in EVENT_ICONS:
        gen_slot_icon(name, EVENT_ICONS[name])
        return
    if name in EVENT_ICONS_LG:
        gen_event_icon_lg(name, EVENT_ICONS_LG[name])
        return
    if name in MISC_ICONS:
        gen_misc_icon(name, MISC_ICONS[name])
        return

    print(f"Unknown sprite name: {name}")
    print("Valid names:")
    print(f"  Heroes: {', '.join(HERO_BASES.keys())}")
    print(f"  Monsters: {', '.join(MONSTERS.keys())}")
    print(f"  Followers: {', '.join(FOLLOWERS.keys())}")
    print(f"  Backgrounds: {', '.join(BATTLE_BACKGROUNDS.keys())}")
    print(f"  Gear: {', '.join(GEAR_ICONS.keys())}")
    print(f"  Slot icons: {', '.join(SLOT_ICONS.keys())}")
    print(f"  Event icons: {', '.join(EVENT_ICONS.keys())}")
    print(f"  Large event icons: {', '.join(EVENT_ICONS_LG.keys())}")
    print(f"  Misc icons: {', '.join(MISC_ICONS.keys())}")
    print(f"  NPCs: {', '.join(NPC_SPRITES.keys())}")
    print(f"  Skills: {', '.join(SKILL_ICON_SPRITES.keys())}")
    print(f"  Ultimates: {', '.join(ULT_ICON_SPRITES.keys())}")
    print(f"  Logo: {', '.join(LOGO_SPRITES.keys())}")
    print(f"  VFX: {', '.join(VFX_SPRITES.keys())}")
    print(f"  Spell VFX: {', '.join(SPELL_VFX_SPRITES.keys())}")
    print(f"  UI Textures: {', '.join(UI_TEXTURES.keys())}")


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

    slot_count = sum(1 for k in SLOT_ICONS if (OUTPUT_DIR / "gear" / f"{k}.png").exists())
    slot_total = len(SLOT_ICONS)
    print(f"Slot icons (32x32):  {slot_count}/{slot_total}")

    event_count = sum(1 for k in EVENT_ICONS if (OUTPUT_DIR / "gear" / f"{k}.png").exists())
    event_total = len(EVENT_ICONS)
    print(f"Event icons (32x32): {event_count}/{event_total}")

    event_lg_count = sum(1 for k in EVENT_ICONS_LG if (OUTPUT_DIR / "events" / f"{k}.png").exists())
    event_lg_total = len(EVENT_ICONS_LG)
    print(f"Event icons lg (64x64): {event_lg_count}/{event_lg_total}")

    misc_count = sum(1 for k in MISC_ICONS if (OUTPUT_DIR / "icons" / f"{k}.png").exists())
    misc_total = len(MISC_ICONS)
    print(f"Misc icons (48x48): {misc_count}/{misc_total}")

    npc_count = count_files(OUTPUT_DIR / "npcs")
    npc_total = len(NPC_SPRITES)
    print(f"NPCs (128x128):      {npc_count}/{npc_total}")

    skill_count = count_files(OUTPUT_DIR / "skills")
    skill_total = len(SKILL_ICON_SPRITES) + len(ULT_ICON_SPRITES)
    print(f"Skills (48x48):      {skill_count}/{skill_total}")

    logo_count = count_files(OUTPUT_DIR / "ui")
    logo_total = len(LOGO_SPRITES)
    print(f"Logo (480x160):      {logo_count}/{logo_total}")

    bg_dir = OUTPUT_DIR.parent.parent / "tilesets" / "battle_backgrounds"
    bg_count = count_files(bg_dir)
    bg_total = len(BATTLE_BACKGROUNDS)
    print(f"Backgrounds (640x360): {bg_count}/{bg_total}")

    vfx_count = count_files(OUTPUT_DIR / "vfx")
    vfx_total = len(VFX_SPRITES)
    print(f"VFX (48x48/32x32):   {vfx_count}/{vfx_total}")

    spell_vfx_count = sum(1 for k in SPELL_VFX_SPRITES if (OUTPUT_DIR / "vfx" / f"{k}.png").exists())
    spell_vfx_total = len(SPELL_VFX_SPRITES)
    print(f"Spell VFX (32x32):   {spell_vfx_count}/{spell_vfx_total}")

    # UI textures share the "ui" folder with logos, so count by prefix
    ui_tex_count = count_files(OUTPUT_DIR / "ui", "ui_*.png")
    ui_tex_total = len(UI_TEXTURES)
    print(f"UI textures (64x64/64x24): {ui_tex_count}/{ui_tex_total}")

    total = hero_total + monster_total + follower_total + gear_total + slot_total + event_total + event_lg_total + misc_total + npc_total + skill_total + logo_total + bg_total + vfx_total + spell_vfx_total + ui_tex_total
    done = hero_count + monster_count + follower_count + gear_count + slot_count + event_count + event_lg_count + misc_count + npc_count + skill_count + logo_count + bg_count + vfx_count + spell_vfx_count + ui_tex_count
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
                        choices=["heroes", "monsters", "followers", "gear", "slot_icons", "event_icons", "event_icons_lg", "misc_icons", "npcs", "skills", "logo", "backgrounds", "vfx", "spell_vfx", "ui_textures", "all"],
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
    parser.add_argument("--reference-dir", type=str, default=None,
                        help="Directory of reference images for img2img (matched by filename)")
    parser.add_argument("--strength", type=float, default=0.5,
                        help="Denoising strength for img2img (0.0=copy, 1.0=ignore ref, default: 0.5)")
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

    if args.reference_dir:
        CONFIG["reference_dir"] = args.reference_dir
        CONFIG["strength"] = args.strength
        print(f"img2img mode: reference_dir={args.reference_dir}, strength={args.strength}")
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
        if args.category in ("slot_icons", "all"):
            generate_slot_icons()
        if args.category in ("event_icons", "all"):
            generate_event_icons()
        if args.category in ("event_icons_lg", "all"):
            generate_large_event_icons()
        if args.category in ("misc_icons", "all"):
            generate_misc_icons()
        if args.category in ("npcs", "all"):
            generate_npcs()
        if args.category in ("skills", "all"):
            generate_skill_icons()
        if args.category in ("logo", "all"):
            generate_logo()
        if args.category in ("backgrounds", "all"):
            generate_backgrounds()
        if args.category in ("vfx", "all"):
            generate_vfx()
        if args.category in ("spell_vfx", "all"):
            generate_spell_vfx()
        if args.category in ("ui_textures", "all"):
            generate_ui_textures()
        elapsed = time.time() - start
        print(f"\nTotal time: {elapsed:.1f}s")
        show_status()
    else:
        parser.print_help()
        print()
        show_status()


if __name__ == "__main__":
    main()
