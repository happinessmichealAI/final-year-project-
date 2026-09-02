"""
Builds a schematic placeholder for the tensile/bending tester.

This is NOT your real CAD model. It's a low-fidelity stand-in built from
primitive boxes, so the app has something to show for machine #5 while the
actual SolidWorks assembly (in your uploaded zip) still needs to be opened,
assembled, and exported to glTF by someone with SolidWorks or Blender access.

I grounded the part list and rough proportions in what's ACTUALLY in your
CAD zip (NEMA 34 stepper, 8mm/2mm-pitch lead screw, S-type load cell,
3030 aluminum extrusion frame, STM32F746G-DISCO controller) so it's at least
topologically honest about what the real machine contains — but sizes,
exact proportions, and the arrangement are approximate, not measured from
your parts. Swap this out the moment you have a real export.
"""
import sys
sys.path.insert(0, "/home/claude/digital-twin-lab/scripts")
from _glb_writer import GLBBuilder

b = GLBBuilder()

frame_mat = b.add_material("frame_extrusion", [0.62, 0.63, 0.66, 1.0], metallic=0.7, roughness=0.4)
base_mat = b.add_material("base_plate", [0.35, 0.36, 0.39, 1.0], metallic=0.5, roughness=0.6)
crosshead_mat = b.add_material("crosshead", [0.85, 0.58, 0.18, 1.0], metallic=0.4, roughness=0.5)
grip_mat = b.add_material("grip", [0.15, 0.15, 0.17, 1.0], metallic=0.6, roughness=0.3)
loadcell_mat = b.add_material("load_cell", [0.75, 0.2, 0.18, 1.0], metallic=0.6, roughness=0.4)
panel_mat = b.add_material("control_panel", [0.1, 0.11, 0.13, 1.0], metallic=0.2, roughness=0.7)
screen_mat = b.add_material("panel_screen", [0.25, 0.55, 0.6, 1.0], metallic=0.0, roughness=0.3)
motor_mat = b.add_material("stepper_motor", [0.2, 0.21, 0.23, 1.0], metallic=0.8, roughness=0.35)
screw_mat = b.add_material("lead_screw", [0.7, 0.7, 0.72, 1.0], metallic=0.9, roughness=0.2)

# --- Frame (3030 aluminum extrusion columns + base, per your CAD file names) ---
b.add_box_node("base_plate", (0, 0.01, 0), (0.42, 0.02, 0.30), base_mat)
b.add_box_node("column_left", (-0.17, 0.32, -0.12), (0.03, 0.6, 0.03), frame_mat)
b.add_box_node("column_right", (-0.17, 0.32, 0.12), (0.03, 0.6, 0.03), frame_mat)
b.add_box_node("top_beam", (-0.17, 0.62, 0), (0.05, 0.03, 0.30), frame_mat)

# --- Lead screw + stepper (drives the crosshead) ---
b.add_box_node("lead_screw", (0.05, 0.32, 0), (0.012, 0.55, 0.012), screw_mat)
b.add_box_node("stepper_motor", (0.05, 0.63, 0), (0.09, 0.09, 0.09), motor_mat)

# --- Moving crosshead assembly (this is what gets animated during a test) ---
b.add_box_node("crosshead", (-0.06, 0.42, 0), (0.30, 0.04, 0.26), crosshead_mat)
b.add_box_node("upper_grip", (-0.06, 0.39, 0), (0.05, 0.06, 0.05), grip_mat)
b.add_box_node("load_cell", (-0.06, 0.46, 0), (0.06, 0.05, 0.06), loadcell_mat)

# --- Fixed lower grip on the base ---
b.add_box_node("lower_grip", (-0.06, 0.06, 0), (0.05, 0.06, 0.05), grip_mat)

# --- Controller (STM32F746G-DISCO / TB6600 driver, per your CAD file names) ---
b.add_box_node("control_panel", (0.15, 0.28, -0.22), (0.12, 0.16, 0.03), panel_mat)
b.add_box_node("control_panel_screen", (0.15, 0.30, -0.203), (0.08, 0.08, 0.002), screen_mat)

out_path = "/home/claude/digital-twin-lab/public/models/tensile_bending_tester_placeholder.glb"
size = b.write(out_path)
print(f"Wrote {out_path} ({size/1e3:.1f} KB), {len(b.nodes)} nodes")
