class_name DioData
## Static data for Dio popup appearances — dialogue pools, sprite mappings,
## entrance animation configs.  No autoload needed; preloaded by DioPopup.

# ── Sprite variant paths (filename without extension, under npcs/) ────────

const SPRITES_PERFECT_GEAR: Array = [
	"dio_impressed", "dio_dramatic", "dio_slow_clap", "dio_blowing_kiss",
]
const SPRITES_TRASH_GEAR: Array = [
	"dio_disappointed", "dio_facepalm", "dio_laughing",
]
const SPRITES_DEATH: Array = [
	"dio_disappointed", "dio_facepalm", "dio_laughing",
	"dio_slow_clap", "dio_lounging",
]
const SPRITES_VICTORY: Array = [
	"dio_impressed", "dio_dramatic", "dio_blowing_kiss", "dio_slow_clap",
]
const SPRITES_BOSS_KILL: Array = [
	"dio_impressed", "dio_pointing", "dio_dramatic",
]

# ── Dialogue pools ────────────────────────────────────────────────────────

const PERFECT_GEAR_LINES: Array = [
	"Now THAT is what I'm talking about. Almost makes up for your gameplay.",
	"Ooh, shiny. Try not to get killed before you can use it.",
	"The universe occasionally rewards mediocrity. Today is your day.",
	"Even a broken clock gets a perfect roll twice a day.",
	"I... I'm actually impressed. Don't let it go to your head.",
	"The crafting gods smile upon you. I'm a bit jealous, honestly.",
	"That's the kind of gear heroes write ballads about. You're welcome.",
	"Perfect roll. Screenshot it — this won't happen again.",
	"I've seen gods weep for lesser items. Equip it immediately.",
	"Well well well. Maybe you ARE my favorite champion after all.",
]

const TRASH_GEAR_LINES: Array = [
	"That is... wow. I've seen better gear in a goblin's trash heap.",
	"The game literally rolled every stat as low as possible. Impressive.",
	"Maybe try offering it to a merchant? As a joke?",
	"I'm embarrassed FOR you. And I'm an incorporeal fire god.",
	"Vendor trash has never been more aptly named.",
	"At least you can salvage it for... almost nothing.",
	"The universe has spoken, and it said 'no.'",
	"I've seen better drops from slimes. SLIMES.",
	"That's the worst roll I've ever seen. And I've watched a LOT of champions.",
	"You could probably do more damage throwing this at the enemy.",
]

const DEATH_LINES: Array = [
	"And there it is. Lasted longer than the last one, at least.",
	"Don't worry. Pain is just weakness leaving the... oh wait, that's your soul.",
	"I'll add you to the memorial wall. It's very full.",
	"Honestly? Saw that coming three rooms ago.",
	"Have you considered a career in... not doing this?",
	"The monster barely had to try. That must sting.",
	"Another one bites the dungeon dust. Very original.",
	"Remember: dying is just giving up with extra steps.",
	"I'd offer a resurrection but I used all those on better champions.",
	"Well. That happened. Shall we pretend it didn't?",
]

const VICTORY_LINES: Array = [
	"You actually did it. I... I need a moment.",
	"Against all odds and my personal expectations — you won.",
	"The dungeon weeps. I may have shed a single flaming tear.",
	"Champion indeed. Don't let it go to your head — it barely fits your helmet.",
	"I've watched thousands of champions. Most die. You... didn't. Bravo.",
	"The egregore council owes me money. I bet on you. Barely.",
	"Dungeon conquered. Now do it again, but harder.",
	"You smell like victory and goblin blood. Mostly goblin blood.",
	"I'm genuinely proud. Write that down, it won't happen often.",
	"The prophecy spoke of a chosen one. It wasn't you, but close enough.",
]

const BOSS_KILL_LINES: Array = [
	"The big one falls. Not bad for a mortal.",
	"Boss down! I'd high-five you but... ethereal.",
	"That was almost impressive. The boss was level one, right? ...Right?",
	"Even the boss looked surprised. Nice.",
	"One boss closer to freedom. Mine, not yours.",
	"The boss had a family. Just kidding, it was spawned from void energy.",
]

# ── Entrance animation preferences per context ────────────────────────────

const ENTRANCES_GEAR: Array = ["peek_left", "peek_right", "pop_bottom"]
const ENTRANCES_DEATH: Array = ["slide_left", "slide_right", "pop_bottom", "peek_left", "peek_right"]
const ENTRANCES_VICTORY: Array = ["slide_left", "slide_right", "pop_bottom"]
const ENTRANCES_BOSS: Array = ["pop_bottom", "slide_right"]

# ── Helpers ────────────────────────────────────────────────────────────────

static func get_sprites(context: String) -> Array:
	match context:
		"perfect_gear": return SPRITES_PERFECT_GEAR
		"trash_gear":   return SPRITES_TRASH_GEAR
		"death":        return SPRITES_DEATH
		"victory":      return SPRITES_VICTORY
		"boss_kill":    return SPRITES_BOSS_KILL
	return ["dio_idle"]


static func get_lines(context: String) -> Array:
	match context:
		"perfect_gear": return PERFECT_GEAR_LINES
		"trash_gear":   return TRASH_GEAR_LINES
		"death":        return DEATH_LINES
		"victory":      return VICTORY_LINES
		"boss_kill":    return BOSS_KILL_LINES
	return ["..."]


static func get_entrances(context: String) -> Array:
	match context:
		"perfect_gear", "trash_gear": return ENTRANCES_GEAR
		"death":                      return ENTRANCES_DEATH
		"victory":                    return ENTRANCES_VICTORY
		"boss_kill":                  return ENTRANCES_BOSS
	return ["slide_left", "slide_right"]


static func pick_random(arr: Array):
	if arr.is_empty():
		return null
	return arr[randi() % arr.size()]
