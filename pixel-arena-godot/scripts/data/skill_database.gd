extends Node
## Loads skills.json and provides skill/ultimate lookups.

var _skills: Array[Dictionary] = []
var _ultimates: Array[Dictionary] = []


func _ready() -> void:
	_load_data()


func _load_data() -> void:
	var file = FileAccess.open("res://data/skills.json", FileAccess.READ)
	if not file:
		push_error("Cannot load skills.json")
		return
	var raw = JSON.parse_string(file.get_as_text())
	file.close()
	if not raw is Dictionary:
		push_error("skills.json is not a Dictionary")
		return
	for entry in raw.get("skills", []):
		_skills.append(entry)
	for entry in raw.get("ultimates", []):
		_ultimates.append(entry)


func get_skill(skill_id: String) -> Dictionary:
	for s in _skills:
		if s.get("id", "") == skill_id:
			return s
	return {}


func get_ultimate(ult_id: String) -> Dictionary:
	for u in _ultimates:
		if u.get("id", "") == ult_id:
			return u
	return {}


func get_skills_for_source(source: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for s in _skills:
		if s.get("source", "") == source:
			result.append(s)
	return result


func get_ultimates_for_source(source: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for u in _ultimates:
		if u.get("source", "") == source:
			result.append(u)
	return result


func get_all_skills() -> Array[Dictionary]:
	return _skills


func get_all_ultimates() -> Array[Dictionary]:
	return _ultimates
