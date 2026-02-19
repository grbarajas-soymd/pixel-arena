class_name DioLiveLines
## Fetch, cache, and merge AI-generated Dio lines with hardcoded fallback.
## All failures are silent — the game always has Dio lines.

const CACHE_PATH := "user://dio_lines.json"

static var _lines: Dictionary = {}  # { "perfect_gear": ["...", ...], ... }
static var _version: int = 0
static var _loaded: bool = false


static func load_cache() -> void:
	if _loaded:
		return
	_loaded = true
	if not FileAccess.file_exists(CACHE_PATH):
		return
	var f := FileAccess.open(CACHE_PATH, FileAccess.READ)
	if not f:
		return
	var text := f.get_as_text()
	f.close()
	var parsed = JSON.parse_string(text)
	if parsed is Dictionary:
		_version = int(parsed.get("version", 0))
		var lines_dict = parsed.get("lines", {})
		if lines_dict is Dictionary:
			_lines = lines_dict


static func update_from_server(data: Dictionary) -> void:
	var new_version: int = int(data.get("version", 0))
	if new_version == 0:
		return  # Server has no lines
	if new_version == _version and not _lines.is_empty():
		return  # Already up to date
	var lines_dict = data.get("lines", {})
	if not lines_dict is Dictionary or lines_dict.is_empty():
		return
	_version = new_version
	_lines = lines_dict
	# Save to cache file
	var f := FileAccess.open(CACHE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(data))
		f.close()


static func get_live(context: String) -> Array:
	return _lines.get(context, []) as Array
