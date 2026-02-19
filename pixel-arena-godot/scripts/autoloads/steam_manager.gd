extends Node
## Steam SDK integration via GodotSteam GDExtension.
## Handles initialization, callbacks, achievements, and cloud saves.

# Set to your real App ID once you have one. 480 = Spacewar (Valve test app).
const APP_ID := 480

var is_online := false
var steam_id := 0
var steam_name := ""

# ---- Lifecycle ----

func _ready() -> void:
	if not Engine.has_singleton("Steam") and not ClassDB.class_exists("Steam"):
		push_warning("[Steam] GodotSteam not available — running in offline mode")
		return

	var result = Steam.steamInitEx(false, APP_ID)
	print("[Steam] Init result: ", result)

	if result.status == 1:
		push_warning("[Steam] Steam not running — offline mode")
		return

	if result.status != 0:
		push_warning("[Steam] Init failed (status ", result.status, ") — offline mode")
		return

	is_online = true
	steam_id = Steam.getSteamID()
	steam_name = Steam.getPersonaName()
	print("[Steam] Logged in as: ", steam_name, " (", steam_id, ")")

	# Request current stats/achievements from Steam servers
	Steam.requestCurrentStats()

func _process(_delta: float) -> void:
	if is_online:
		Steam.run_callbacks()

# ---- Achievements ----

## Achievement IDs — must match Steamworks admin configuration.
## Defined here as constants so they can be referenced throughout the codebase.
const ACH := {
	# Tutorial & Getting Started
	"TUTORIAL_COMPLETE": "ACH_TUTORIAL_COMPLETE",
	"FIRST_CHARACTER": "ACH_FIRST_CHARACTER",

	# Dungeon
	"FIRST_DESCENT": "ACH_FIRST_DESCENT",           # dungeon_clears >= 1
	"DUNGEON_MASTER": "ACH_DUNGEON_MASTER",          # dungeon_clears >= 10
	"ABYSS_WALKER": "ACH_ABYSS_WALKER",              # dungeon_clears >= 50

	# Ladder
	"PROVING_GROUNDS": "ACH_PROVING_GROUNDS",        # ladder_wins >= 1
	"UNDEFEATED": "ACH_UNDEFEATED",                  # ladder_best >= 3
	"CHAMPION": "ACH_CHAMPION",                      # ladder_wins >= 25
	"LEGEND": "ACH_LEGEND",                          # ladder_wins >= 100
	"GODLY_STREAK": "ACH_GODLY_STREAK",              # ladder_best >= 10

	# Arena
	"ARENA_DEBUT": "ACH_ARENA_DEBUT",                # arena tutorial done
	"RISING_STAR": "ACH_RISING_STAR",                 # arena_rating >= 1200
	"CHAMPION_TIER": "ACH_CHAMPION_TIER",             # arena_rating >= 1500

	# Gear & Loot
	"LEGENDARY_LOOT": "ACH_LEGENDARY_LOOT",           # obtain legendary gear
	"MYTHIC_DROP": "ACH_MYTHIC_DROP",                 # obtain mythic gear
	"PERFECT_CRAFT": "ACH_PERFECT_CRAFT",             # gear quality >= 95
	"FULLY_EQUIPPED": "ACH_FULLY_EQUIPPED",           # all 5 slots legendary+

	# Followers
	"FIRST_FOLLOWER": "ACH_FIRST_FOLLOWER",           # obtain any follower
	"LEGENDARY_COMPANION": "ACH_LEGENDARY_COMPANION", # legendary rarity follower

	# Currency
	"DUST_HOARDER": "ACH_DUST_HOARDER",              # dust >= 5000

	# Combat (hidden)
	"CLUTCH_SAVE": "ACH_CLUTCH_SAVE",                 # win with < 20% HP
	"NO_DAMAGE": "ACH_NO_DAMAGE",                     # clear floor without taking damage
}

func unlock(ach_key: String) -> void:
	if not is_online:
		return
	var ach_id = ACH.get(ach_key, "")
	if ach_id == "":
		push_warning("[Steam] Unknown achievement key: ", ach_key)
		return
	# Only set if not already achieved
	var status = Steam.getAchievement(ach_id)
	if status.achieved:
		return
	Steam.setAchievement(ach_id)
	Steam.storeStats()
	print("[Steam] Unlocked: ", ach_key)

func is_achieved(ach_key: String) -> bool:
	if not is_online:
		return false
	var ach_id = ACH.get(ach_key, "")
	if ach_id == "":
		return false
	return Steam.getAchievement(ach_id).achieved

# ---- Rich Presence ----

func set_presence(status_key: String, details: Dictionary = {}) -> void:
	if not is_online:
		return
	Steam.setRichPresence("steam_display", status_key)
	for key in details:
		Steam.setRichPresence(key, str(details[key]))

func clear_presence() -> void:
	if is_online:
		Steam.clearRichPresence()
