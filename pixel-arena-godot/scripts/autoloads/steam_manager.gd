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

	# Connect to GameState signals for automatic achievement checks
	var gs := get_node_or_null("/root/GameState")
	if gs and gs.has_signal("dust_changed"):
		gs.dust_changed.connect(_on_dust_changed)

func _on_dust_changed(amount: int) -> void:
	check_dust(amount)

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

# ---- Achievement Helpers ----

## Call after obtaining gear to check rarity/quality achievements.
func check_gear(gear: Dictionary) -> void:
	var rarity: String = gear.get("rarity", "")
	var quality: int = int(gear.get("quality", 0))
	if rarity == "legendary" or rarity == "mythic":
		unlock("LEGENDARY_LOOT")
	if rarity == "mythic":
		unlock("MYTHIC_DROP")
	if quality >= 95:
		unlock("PERFECT_CRAFT")

## Call after obtaining a follower to check follower achievements.
func check_follower(follower: Dictionary, total_followers: int) -> void:
	if total_followers >= 1:
		unlock("FIRST_FOLLOWER")
	if follower.get("rarity", "") == "legendary":
		unlock("LEGENDARY_COMPANION")

## Call after equipping gear to check if all 5 slots are legendary+.
func check_fully_equipped(equipment: Dictionary) -> void:
	var slots := ["weapon", "helmet", "chest", "boots", "accessory"]
	for s in slots:
		var g: Dictionary = equipment.get(s, {})
		if g.is_empty():
			return
		var r: String = g.get("rarity", "")
		if r != "legendary" and r != "mythic":
			return
	unlock("FULLY_EQUIPPED")

## Call after dust changes to check dust hoarder.
func check_dust(amount: int) -> void:
	if amount >= 5000:
		unlock("DUST_HOARDER")

## Call after dungeon clears increment.
func check_dungeon_clears(clears: int) -> void:
	if clears >= 1:
		unlock("FIRST_DESCENT")
	if clears >= 10:
		unlock("DUNGEON_MASTER")
	if clears >= 50:
		unlock("ABYSS_WALKER")

## Call after ladder wins/best changes.
func check_ladder(wins: int, best: int) -> void:
	if wins >= 1:
		unlock("PROVING_GROUNDS")
	if wins >= 25:
		unlock("CHAMPION")
	if wins >= 100:
		unlock("LEGEND")
	if best >= 3:
		unlock("UNDEFEATED")
	if best >= 10:
		unlock("GODLY_STREAK")

## Call after arena rating changes.
func check_arena_rating(rating: int) -> void:
	if rating >= 1200:
		unlock("RISING_STAR")
	if rating >= 1500:
		unlock("CHAMPION_TIER")

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
