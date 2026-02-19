extends Node
## Sound effects and music manager.
## Plays audio via AudioStreamPlayer nodes.
## Context-aware music playlists with crossfade and ducking support.

var _sfx_players: Array[AudioStreamPlayer] = []
var _music_player: AudioStreamPlayer
var _gs: Node  # GameState ref

const MAX_CONCURRENT_SFX: int = 8

# Context playlist state
var _context_playlists: Dictionary = {}  # context_name -> Array[AudioStream]
var _current_context: String = ""
var _playlist: Array[AudioStream] = []
var _playlist_index: int = 0
var _ducked: bool = false
var _normal_music_db: float = -12.0
var _duck_tween: Tween


func _ready() -> void:
	_gs = get_node("/root/GameState")

	# Create SFX player pool
	for i in MAX_CONCURRENT_SFX:
		var player = AudioStreamPlayer.new()
		player.bus = "SFX"
		add_child(player)
		_sfx_players.append(player)

	# Create music player
	_music_player = AudioStreamPlayer.new()
	_music_player.bus = "Music"
	add_child(_music_player)
	_music_player.finished.connect(_on_music_finished)

	# Build context playlists
	_build_context_playlists()

	# Apply persisted volume settings
	set_music_volume(float(_gs.music_volume))
	set_sfx_volume(float(_gs.sfx_volume))


func _build_context_playlists() -> void:
	# Menu: theme-7, theme-14
	_context_playlists["menu"] = _load_tracks([7, 14])
	# Tutorial: theme-4
	_context_playlists["tutorial"] = _load_tracks([4])
	# Real-time battle (arena, ladder): theme-6, theme-13
	_context_playlists["battle"] = _load_tracks([6, 13])
	# Dungeon battle (turn-based, normal): theme-8
	_context_playlists["dungeon_battle"] = _load_tracks([8])
	# Dungeon boss fights: theme-12
	_context_playlists["dungeon_boss"] = _load_tracks([12])
	# Death screens: theme-9
	_context_playlists["death"] = _load_tracks([9])
	# Dungeon exploration: theme-1,2,3,5,10,15,16
	_context_playlists["dungeon_explore"] = _load_tracks([1, 2, 3, 5, 10, 15, 16])


func _load_tracks(nums: Array) -> Array[AudioStream]:
	var tracks: Array[AudioStream] = []
	for n in nums:
		var stream = load("res://assets/audio/music/theme-" + str(n) + ".ogg")
		if stream:
			tracks.append(stream)
	return tracks


func play_sfx(stream: AudioStream, volume_db: float = 0.0) -> void:
	if not _gs.sfx_enabled:
		return
	for player in _sfx_players:
		if not player.playing:
			player.stream = stream
			player.volume_db = volume_db
			player.play()
			return
	# All players busy — skip this sound


## Duck music, play SFX, then auto-unduck after delay.
func play_sfx_ducked(stream: AudioStream, volume_db: float = 0.0, unduck_delay: float = 2.0) -> void:
	if not _gs.sfx_enabled and not _gs.music_enabled:
		return
	# Duck music down
	_ducked = true
	if _duck_tween and _duck_tween.is_valid():
		_duck_tween.kill()
	_duck_tween = create_tween()
	_duck_tween.tween_property(_music_player, "volume_db", -24.0, 0.3)
	# Play the SFX
	play_sfx(stream, volume_db)
	# Schedule unduck
	_duck_tween.tween_interval(unduck_delay)
	_duck_tween.tween_property(_music_player, "volume_db", _normal_music_db, 0.8)
	_duck_tween.tween_callback(func(): _ducked = false)


## Switch to a context playlist with crossfade. If already in this context, do nothing.
func play_context(context: String) -> void:
	if not _gs.music_enabled:
		_current_context = context
		return
	if context == _current_context and _music_player.playing:
		return
	_current_context = context
	var tracks: Array[AudioStream] = _context_playlists.get(context, [])
	if tracks.is_empty():
		return
	# Build shuffled playlist for this context
	_playlist = tracks.duplicate()
	_playlist.shuffle()
	_playlist_index = 0
	# Crossfade: fade out current, then start new with fade in
	if _music_player.playing:
		var tw := create_tween()
		tw.tween_property(_music_player, "volume_db", -40.0, 0.5)
		tw.tween_callback(_start_playlist_with_fade)
	else:
		_play_playlist_track()


func _start_playlist_with_fade() -> void:
	if _playlist.is_empty():
		return
	_music_player.stream = _playlist[_playlist_index]
	_music_player.volume_db = -40.0
	_music_player.play()
	var tw := create_tween()
	tw.tween_property(_music_player, "volume_db", _normal_music_db, 0.5)


func start_playlist() -> void:
	if _music_player.playing:
		return  # Already playing
	if not _gs.music_enabled:
		return
	# Default to menu context if none set
	if _current_context.is_empty():
		play_context("menu")
	else:
		_play_playlist_track()


func _play_playlist_track() -> void:
	if _playlist.is_empty():
		return
	_music_player.stream = _playlist[_playlist_index]
	_music_player.volume_db = _normal_music_db if not _ducked else -24.0
	_music_player.play()


func _on_music_finished() -> void:
	_playlist_index = (_playlist_index + 1) % _playlist.size()
	if _playlist_index == 0:
		_playlist.shuffle()  # Re-shuffle when cycling
	_play_playlist_track()


func stop_music() -> void:
	_music_player.stop()


func duck_music() -> void:
	if not _ducked:
		_ducked = true
		_music_player.volume_db = -24.0


func unduck_music() -> void:
	if _ducked:
		_ducked = false
		_music_player.volume_db = _normal_music_db


func set_music_volume(linear: float) -> void:
	var bus_idx := AudioServer.get_bus_index("Music")
	if bus_idx >= 0:
		AudioServer.set_bus_volume_db(bus_idx, linear_to_db(maxf(0.001, linear)))


func set_sfx_volume(linear: float) -> void:
	var bus_idx := AudioServer.get_bus_index("SFX")
	if bus_idx >= 0:
		AudioServer.set_bus_volume_db(bus_idx, linear_to_db(maxf(0.001, linear)))


func set_sfx_enabled(enabled: bool) -> void:
	_gs.sfx_enabled = enabled


func set_music_enabled(enabled: bool) -> void:
	_gs.music_enabled = enabled
	if enabled:
		start_playlist()
	else:
		stop_music()
