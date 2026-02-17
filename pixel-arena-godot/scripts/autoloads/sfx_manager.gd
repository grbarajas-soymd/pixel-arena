extends Node
## Sound effects and music manager.
## Plays audio via AudioStreamPlayer nodes.
## Continuous shuffled playlist of all 16 tracks with duck/unduck support.

var _sfx_players: Array[AudioStreamPlayer] = []
var _music_player: AudioStreamPlayer
var _gs: Node  # GameState ref

const MAX_CONCURRENT_SFX: int = 8

# Playlist state
var _playlist: Array[AudioStream] = []
var _playlist_index: int = 0
var _ducked: bool = false
var _normal_music_db: float = -6.0


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

	# Build shuffled playlist of all 16 tracks
	var track_nums: Array[int] = []
	for i in range(1, 17):
		track_nums.append(i)
	track_nums.shuffle()
	for tn in track_nums:
		_playlist.append(load("res://assets/audio/music/theme-" + str(tn) + ".ogg"))

	# Apply persisted volume settings
	set_music_volume(float(_gs.music_volume))
	set_sfx_volume(float(_gs.sfx_volume))


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


func start_playlist() -> void:
	if _music_player.playing:
		return  # Already playing
	if not _gs.music_enabled:
		return
	_play_playlist_track()


func _play_playlist_track() -> void:
	if _playlist.is_empty():
		return
	_music_player.stream = _playlist[_playlist_index]
	_music_player.volume_db = _normal_music_db if not _ducked else -20.0
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
		_music_player.volume_db = -20.0


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
