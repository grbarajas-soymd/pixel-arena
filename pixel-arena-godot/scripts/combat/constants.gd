class_name CombatConstants
## All combat constants — 1:1 port of src/constants.js

# Canvas / arena dimensions (logical units used in combat math)
const CW: int = 1000
const CH: int = 500
const AX: int = 40       # Arena left edge
const AY: int = 60       # Arena top edge
const AW: int = 920      # Arena width
const AH: int = 370      # Arena height
const GY: int = 400      # Ground Y (AY + AH - 30)
const GY_MIN: int = 320  # Back of arena (depth) = GY - 80
const GY_MAX: int = 430  # Front of arena = GY + 30

# Movement
const STRAFE_SPEED: float = 0.35  # Y-speed as fraction of moveSpeed

# Timing
const TK: int = 50  # Tick interval in milliseconds

# Combat
const MELEE: int = 55           # Melee range threshold
const RANGED_PEN: float = 0.7   # Ranged attack penalty at close range
const AF_DMG_REDUCTION: float = 0.30  # Arena followers take 30% less damage

# Ladder constants
const LADDER_SEQUENCE: Array[String] = ["wizard", "ranger", "assassin", "barbarian"]
const LADDER_NAMES: Array[String] = [
	"Draven", "Zara", "Krix", "Moku", "Thane", "Vex", "Nira", "Bolt",
	"Crag", "Syla", "Fenn", "Hex", "Jolt", "Pyra", "Onyx", "Dusk",
	"Blaze", "Storm", "Frost", "Ash", "Rune", "Shade", "Grim", "Talon",
	"Echo", "Ember", "Flux", "Nova", "Spike", "Wisp"
]
