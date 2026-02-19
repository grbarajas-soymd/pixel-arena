extends Node
## Network layer — auth, cloud saves, and arena API.

const _DioLiveLines = preload("res://scripts/data/dio_live_lines.gd")

# Auth signals
signal auth_login_complete(username: String)
signal auth_signup_complete(username: String)
signal auth_logout_complete
signal auth_error(message: String)

# Cloud save signals
signal cloud_save_fetched(save_data: Dictionary)
signal cloud_save_uploaded
signal cloud_save_not_found
signal cloud_save_deleted

# Arena signals
signal upload_complete(success: bool)
signal opponents_fetched(opponents: Array)
signal opponent_fetched(opponent: Dictionary)
signal register_complete(player_id: String)
signal battle_reported(success: bool)
signal network_error(message: String)

# Dio signals
signal dio_lines_fetched(data: Dictionary)

# Bug report signals
signal bug_report_submitted(success: bool)

# API config
var api_base_url: String = ""

# Auth state
var auth_token: String = ""
var auth_username: String = ""
var auth_user_id: String = ""

# Arena identity (separate from auth account)
var player_id: String = ""
var player_name: String = ""

const TOKEN_PATH: String = "user://auth_token.cfg"


func _ready() -> void:
	_load_api_url()
	_load_token()
	if not auth_token.is_empty():
		validate_token()
	# Load cached Dio lines, then fetch fresh from server
	_DioLiveLines.load_cache()
	if not api_base_url.is_empty():
		fetch_dio_lines()


func _load_api_url() -> void:
	var env_url: String = OS.get_environment("API_URL")
	if not env_url.is_empty():
		api_base_url = env_url
		return
	if OS.has_feature("web"):
		var js_origin = JavaScriptBridge.eval("window.location.origin", true)
		if js_origin:
			api_base_url = str(js_origin)
			return
	if OS.is_debug_build():
		api_base_url = "http://localhost:3001"
		return
	# Production fallback for desktop (Steam) builds
	api_base_url = "https://someofyoumaydie.com"


func _save_token() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("auth", "token", auth_token)
	cfg.set_value("auth", "username", auth_username)
	cfg.set_value("auth", "user_id", auth_user_id)
	cfg.save(TOKEN_PATH)


func _load_token() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(TOKEN_PATH) == OK:
		auth_token = cfg.get_value("auth", "token", "")
		auth_username = cfg.get_value("auth", "username", "")
		auth_user_id = cfg.get_value("auth", "user_id", "")


func _clear_token() -> void:
	auth_token = ""
	auth_username = ""
	auth_user_id = ""
	if FileAccess.file_exists(TOKEN_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(TOKEN_PATH))


func is_logged_in() -> bool:
	return not auth_token.is_empty() and not auth_user_id.is_empty()


func _auth_headers() -> PackedStringArray:
	return PackedStringArray([
		"Content-Type: application/json",
		"Authorization: Bearer " + auth_token
	])


# ============ AUTH ============

func signup(username: String, password: String) -> void:
	if api_base_url.is_empty():
		auth_error.emit("No server configured")
		return
	var http := HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(_on_signup_complete.bind(http))
	var body := JSON.stringify({"username": username, "password": password})
	http.request(api_base_url + "/api/auth/signup", ["Content-Type: application/json"], HTTPClient.METHOD_POST, body)


func login(username: String, password: String) -> void:
	if api_base_url.is_empty():
		auth_error.emit("No server configured")
		return
	var http := HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(_on_login_complete.bind(http))
	var body := JSON.stringify({"username": username, "password": password})
	http.request(api_base_url + "/api/auth/login", ["Content-Type: application/json"], HTTPClient.METHOD_POST, body)


func logout() -> void:
	_clear_token()
	player_id = ""
	player_name = ""
	auth_logout_complete.emit()


func validate_token() -> void:
	if api_base_url.is_empty() or auth_token.is_empty():
		_clear_token()
		return
	var http := HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(_on_validate_complete.bind(http))
	http.request(api_base_url + "/api/auth/me", _auth_headers(), HTTPClient.METHOD_GET)


# ============ CLOUD SAVES ============

func fetch_cloud_save() -> void:
	if api_base_url.is_empty() or not is_logged_in():
		return
	var http := HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(_on_cloud_save_fetched.bind(http))
	http.request(api_base_url + "/api/saves", _auth_headers(), HTTPClient.METHOD_GET)


func upload_cloud_save(save_data: Dictionary) -> void:
	if api_base_url.is_empty() or not is_logged_in():
		return
	var http := HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(_on_cloud_save_uploaded.bind(http))
	var body := JSON.stringify({"save": save_data})
	http.request(api_base_url + "/api/saves", _auth_headers(), HTTPClient.METHOD_PUT, body)


func delete_cloud_save() -> void:
	if api_base_url.is_empty() or not is_logged_in():
		return
	var http := HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(_on_cloud_save_deleted.bind(http))
	http.request(api_base_url + "/api/saves", _auth_headers(), HTTPClient.METHOD_DELETE)


# ============ ARENA ============

func register(display_name: String) -> void:
	if api_base_url.is_empty():
		network_error.emit("No API server configured")
		return
	var http := HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(_on_register_complete.bind(http))
	var body := JSON.stringify({"name": display_name})
	http.request(api_base_url + "/api/register", ["Content-Type: application/json"], HTTPClient.METHOD_POST, body)


func upload_build(build_data: Dictionary) -> void:
	if api_base_url.is_empty():
		network_error.emit("No API server configured")
		return
	if player_id.is_empty():
		network_error.emit("Not registered")
		return
	var http := HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(_on_upload_complete.bind(http))
	var body := JSON.stringify(build_data)
	http.request(api_base_url + "/api/characters", ["Content-Type: application/json", "X-Player-Id: " + player_id], HTTPClient.METHOD_PUT, body)


func fetch_opponents() -> void:
	if api_base_url.is_empty():
		network_error.emit("No API server configured")
		return
	var exclude := player_id if not player_id.is_empty() else ""
	var http := HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(_on_opponents_fetched.bind(http))
	http.request(api_base_url + "/api/characters?exclude=" + exclude.uri_encode())


func fetch_opponent(rating: int) -> void:
	if api_base_url.is_empty():
		network_error.emit("No API server configured")
		return
	var http := HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(_on_opponent_single_fetched.bind(http))
	http.request(api_base_url + "/api/opponent?rating=" + str(rating))


func report_battle(opponent_id: String, player_won: bool) -> void:
	if api_base_url.is_empty() or player_id.is_empty():
		return
	var http := HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(_on_battle_reported.bind(http))
	var body := JSON.stringify({
		"challengerId": player_id,
		"defenderId": opponent_id,
		"challengerWon": player_won,
	})
	http.request(api_base_url + "/api/battles", ["Content-Type: application/json"], HTTPClient.METHOD_POST, body)


func upload_stats(ladder_best: int, dungeon_clears: int) -> void:
	if api_base_url.is_empty() or player_id.is_empty():
		return
	var http := HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(_on_stats_uploaded.bind(http))
	var body := JSON.stringify({"ladderBest": ladder_best, "dungeonClears": dungeon_clears})
	http.request(api_base_url + "/api/stats", ["Content-Type: application/json", "X-Player-Id: " + player_id], HTTPClient.METHOD_POST, body)


# ============ AUTH CALLBACKS ============

func _on_signup_complete(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray, http: HTTPRequest) -> void:
	http.queue_free()
	if response_code == 200:
		var parsed = JSON.parse_string(body.get_string_from_utf8())
		if parsed is Dictionary:
			auth_token = str(parsed.get("token", ""))
			auth_user_id = str(parsed.get("userId", ""))
			auth_username = str(parsed.get("username", ""))
			_save_token()
			auth_signup_complete.emit(auth_username)
			return
	var parsed = JSON.parse_string(body.get_string_from_utf8())
	var err_msg := "Signup failed"
	if parsed is Dictionary and parsed.has("error"):
		err_msg = str(parsed["error"])
	auth_error.emit(err_msg)


func _on_login_complete(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray, http: HTTPRequest) -> void:
	http.queue_free()
	if response_code == 200:
		var parsed = JSON.parse_string(body.get_string_from_utf8())
		if parsed is Dictionary:
			auth_token = str(parsed.get("token", ""))
			auth_user_id = str(parsed.get("userId", ""))
			auth_username = str(parsed.get("username", ""))
			_save_token()
			auth_login_complete.emit(auth_username)
			return
	var parsed = JSON.parse_string(body.get_string_from_utf8())
	var err_msg := "Login failed"
	if parsed is Dictionary and parsed.has("error"):
		err_msg = str(parsed["error"])
	auth_error.emit(err_msg)


func _on_validate_complete(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray, http: HTTPRequest) -> void:
	http.queue_free()
	if response_code == 200:
		var parsed = JSON.parse_string(body.get_string_from_utf8())
		if parsed is Dictionary:
			auth_username = str(parsed.get("username", auth_username))
			auth_user_id = str(parsed.get("userId", auth_user_id))
			auth_login_complete.emit(auth_username)
			return
	_clear_token()


# ============ CLOUD SAVE CALLBACKS ============

func _on_cloud_save_fetched(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray, http: HTTPRequest) -> void:
	http.queue_free()
	if response_code == 200:
		var parsed = JSON.parse_string(body.get_string_from_utf8())
		if parsed is Dictionary and parsed.has("save"):
			cloud_save_fetched.emit(parsed["save"])
			return
	if response_code == 404:
		cloud_save_not_found.emit()
		return
	network_error.emit("Failed to fetch cloud save: HTTP " + str(response_code))


func _on_cloud_save_uploaded(_result: int, response_code: int, _headers: PackedStringArray, _body: PackedByteArray, http: HTTPRequest) -> void:
	http.queue_free()
	if response_code == 200:
		cloud_save_uploaded.emit()
	else:
		network_error.emit("Cloud save upload failed: HTTP " + str(response_code))


func _on_cloud_save_deleted(_result: int, response_code: int, _headers: PackedStringArray, _body: PackedByteArray, http: HTTPRequest) -> void:
	http.queue_free()
	if response_code == 200:
		cloud_save_deleted.emit()


# ============ ARENA CALLBACKS ============

func _on_register_complete(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray, http: HTTPRequest) -> void:
	http.queue_free()
	if response_code == 200:
		var parsed = JSON.parse_string(body.get_string_from_utf8())
		if parsed is Dictionary and parsed.has("playerId"):
			player_id = str(parsed["playerId"])
			register_complete.emit(player_id)
			return
	network_error.emit("Registration failed: HTTP " + str(response_code))


func _on_upload_complete(_result: int, response_code: int, _headers: PackedStringArray, _body: PackedByteArray, http: HTTPRequest) -> void:
	http.queue_free()
	if response_code == 200:
		upload_complete.emit(true)
	else:
		upload_complete.emit(false)
		network_error.emit("Upload failed: HTTP " + str(response_code))


func _on_opponents_fetched(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray, http: HTTPRequest) -> void:
	http.queue_free()
	if response_code == 200:
		var parsed = JSON.parse_string(body.get_string_from_utf8())
		if parsed is Array:
			opponents_fetched.emit(parsed)
			return
	network_error.emit("Failed to fetch opponents: HTTP " + str(response_code))


func _on_opponent_single_fetched(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray, http: HTTPRequest) -> void:
	http.queue_free()
	if response_code == 200:
		var parsed = JSON.parse_string(body.get_string_from_utf8())
		if parsed is Dictionary:
			opponent_fetched.emit(parsed)
			return
	network_error.emit("Failed to fetch opponent: HTTP " + str(response_code))


func _on_battle_reported(_result: int, response_code: int, _headers: PackedStringArray, _body: PackedByteArray, http: HTTPRequest) -> void:
	http.queue_free()
	battle_reported.emit(response_code == 200)


func _on_stats_uploaded(_result: int, _response_code: int, _headers: PackedStringArray, _body: PackedByteArray, http: HTTPRequest) -> void:
	http.queue_free()


# ---- Dio Live Lines ----

func fetch_dio_lines() -> void:
	if api_base_url.is_empty():
		return
	var http := HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(_on_dio_lines_fetched.bind(http))
	http.request(api_base_url + "/api/dio/lines")


func _on_dio_lines_fetched(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray, http: HTTPRequest) -> void:
	http.queue_free()
	if response_code == 200:
		var parsed = JSON.parse_string(body.get_string_from_utf8())
		if parsed is Dictionary:
			_DioLiveLines.update_from_server(parsed)
			dio_lines_fetched.emit(parsed)


# ============ BUG REPORTS ============

func submit_bug_report(category: String, description: String) -> void:
	if api_base_url.is_empty():
		bug_report_submitted.emit(false)
		return

	# Capture screenshot
	var screenshot_b64 := ""
	var vp := get_viewport()
	if vp:
		await RenderingServer.frame_post_draw
		var img := vp.get_texture().get_image()
		if img:
			var png := img.save_png_to_buffer()
			screenshot_b64 = Marshalls.raw_to_base64(png)

	# Gather diagnostics
	var gs := get_node_or_null("/root/GameState")
	var diag := {}
	diag["scene"] = get_tree().current_scene.name if get_tree().current_scene else "unknown"
	diag["platform"] = OS.get_name()
	diag["locale"] = OS.get_locale()
	diag["viewport"] = str(get_viewport().size) if get_viewport() else ""
	diag["godot_version"] = Engine.get_version_info().get("string", "")
	if gs:
		diag["class_key"] = str(gs.class_key) if "class_key" in gs else ""
		diag["dungeon_floor"] = str(gs.dg_run.get("floor", 0)) if "dg_run" in gs and gs.dg_run is Dictionary else "0"
		diag["dungeon_clears"] = str(gs.dungeon_clears) if "dungeon_clears" in gs else "0"
		diag["ladder_wins"] = str(gs.ladder_wins) if "ladder_wins" in gs else "0"
		diag["follower_count"] = str(gs.followers.size()) if "followers" in gs and gs.followers is Array else "0"
		diag["dust"] = str(gs.dust) if "dust" in gs else "0"
		diag["gold"] = str(gs.gold) if "gold" in gs else "0"

	var payload := {
		"category": category,
		"description": description,
		"diagnostics": diag,
	}
	if not screenshot_b64.is_empty():
		payload["screenshot"] = screenshot_b64

	var http := HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(_on_bug_report_complete.bind(http))
	var body := JSON.stringify(payload)
	http.request(api_base_url + "/api/bugs", ["Content-Type: application/json"], HTTPClient.METHOD_POST, body)


func _on_bug_report_complete(_result: int, response_code: int, _headers: PackedStringArray, _body: PackedByteArray, http: HTTPRequest) -> void:
	http.queue_free()
	bug_report_submitted.emit(response_code >= 200 and response_code < 300)
