shader_type canvas_item;

// Crosshatch wipe transition shader.
// progress: 0.0 = fully visible, 1.0 = fully covered in black.
uniform float progress : hint_range(0.0, 1.0) = 0.0;
uniform float cell_size : hint_range(2.0, 64.0) = 8.0;

void fragment() {
	// Grid cell coordinates
	vec2 cell = floor(FRAGCOORD.xy / cell_size);
	// Checkerboard pattern — even/odd cells transition at different times
	float checker = mod(cell.x + cell.y, 2.0);

	// Two-phase crosshatch: phase 1 fills checker=0 cells, phase 2 fills checker=1
	float phase1 = smoothstep(0.0, 0.5, progress);   // 0→0.5 progress
	float phase2 = smoothstep(0.4, 0.9, progress);    // 0.4→0.9 progress (slight overlap)

	float fill = (checker < 0.5) ? phase1 : phase2;

	// Within each cell, grow from center outward
	vec2 cell_uv = fract(FRAGCOORD.xy / cell_size);
	float dist = max(abs(cell_uv.x - 0.5), abs(cell_uv.y - 0.5)) * 2.0;
	float mask = step(dist, fill);

	COLOR = vec4(0.0, 0.0, 0.0, mask);
}
