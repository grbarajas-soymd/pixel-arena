extends CanvasLayer
## In-game HUD — shows HP bars, resources, combat log, and action buttons.

@onready var hero_hp_bar: ProgressBar = %HeroHpBar
@onready var hero_name_label: Label = %HeroNameLabel
@onready var enemy_hp_bar: ProgressBar = %EnemyHpBar
@onready var enemy_name_label: Label = %EnemyNameLabel
@onready var combat_log: RichTextLabel = %CombatLog
@onready var turn_label: Label = %TurnLabel
@onready var action_container: GridContainer = %ActionContainer

var _combat_engine: CombatEngine


func setup(engine: CombatEngine) -> void:
	_combat_engine = engine
	engine.turn_started.connect(_on_turn_started)
	engine.damage_dealt.connect(_on_damage_dealt)
	engine.heal_applied.connect(_on_heal_applied)
	engine.combat_ended.connect(_on_combat_ended)
	engine.fatigue_triggered.connect(_on_fatigue)

	_update_hero_bar()
	_update_enemy_bar()


func _on_turn_started(turn_num: int, is_player: bool) -> void:
	turn_label.text = "Turn " + str(turn_num)
	_update_hero_bar()
	_update_enemy_bar()
	# Enable/disable action buttons based on whose turn it is
	for btn in action_container.get_children():
		if btn is Button:
			btn.disabled = not is_player


func _on_damage_dealt(_attacker: Dictionary, defender: Dictionary, amount: int, is_crit: bool) -> void:
	var crit_text = " CRIT!" if is_crit else ""
	var name = defender.get("name", "???")
	_log("[color=#ff6644]" + name + " takes " + str(amount) + " damage" + crit_text + "[/color]")
	_update_hero_bar()
	_update_enemy_bar()


func _on_heal_applied(target: Dictionary, amount: int) -> void:
	_log("[color=#44ff88]" + target.get("name", "???") + " heals " + str(amount) + " HP[/color]")
	_update_hero_bar()
	_update_enemy_bar()


func _on_combat_ended(player_won: bool) -> void:
	if player_won:
		_log("[color=#ffd700]Victory![/color]")
	else:
		_log("[color=#ff4444]Defeated![/color]")
	for btn in action_container.get_children():
		if btn is Button:
			btn.disabled = true


func _on_fatigue(target: Dictionary, damage: int, turn: int) -> void:
	_log("[color=#ff8844]" + target.get("name", "???") + " takes " + str(damage) + " fatigue damage (turn " + str(turn) + ")[/color]")


func _update_hero_bar() -> void:
	if _combat_engine:
		var h = _combat_engine.hero
		hero_hp_bar.max_value = float(h.get("max_hp", 1000))
		hero_hp_bar.value = float(h.get("hp", 0))
		hero_name_label.text = h.get("name", "Hero")


func _update_enemy_bar() -> void:
	if _combat_engine:
		var e = _combat_engine.enemy
		enemy_hp_bar.max_value = float(e.get("max_hp", 1000))
		enemy_hp_bar.value = float(e.get("hp", 0))
		enemy_name_label.text = e.get("name", "Enemy")


func _log(text: String) -> void:
	combat_log.append_text(text + "\n")
	# Auto-scroll to bottom
	combat_log.scroll_to_line(combat_log.get_line_count() - 1)
