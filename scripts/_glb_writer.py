"""
Minimal, dependency-free glTF 2.0 binary (.glb) writer.
Used to (a) generate the tensile/bending-tester placeholder and
(b) as reference logic for the printer optimizer script. No external
glTF library available in this sandbox (no network to install
pygltflib/trimesh), so this implements just enough of the spec by hand:
one buffer, one bufferView per accessor, no skinning, no textures.
"""
import struct
import json
import numpy as np


def pad_to_4(data: bytes, pad_byte: bytes) -> bytes:
    remainder = len(data) % 4
    if remainder == 0:
        return data
    return data + pad_byte * (4 - remainder)


class GLBBuilder:
    def __init__(self):
        self.buffers = bytearray()
        self.buffer_views = []
        self.accessors = []
        self.meshes = []
        self.nodes = []
        self.materials = []
        self.scene_nodes = []

    def _add_buffer_view(self, data: bytes, target=None):
        offset = len(self.buffers)
        # glTF requires bufferView byteOffset to be aligned to the accessor's
        # component size; 4-byte alignment satisfies every component type we use.
        while offset % 4 != 0:
            self.buffers.append(0)
            offset += 1
        self.buffers.extend(data)
        bv = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target is not None:
            bv["target"] = target
        self.buffer_views.append(bv)
        return len(self.buffer_views) - 1

    def add_accessor_vec3(self, arr: np.ndarray, target=34962):
        arr = arr.astype("<f4")
        bv = self._add_buffer_view(arr.tobytes(), target)
        acc = {
            "bufferView": bv,
            "componentType": 5126,  # FLOAT
            "count": arr.shape[0],
            "type": "VEC3",
            "min": arr.min(axis=0).tolist(),
            "max": arr.max(axis=0).tolist(),
        }
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def add_accessor_indices(self, arr: np.ndarray):
        arr = arr.astype("<u4")
        bv = self._add_buffer_view(arr.tobytes(), 34963)
        acc = {
            "bufferView": bv,
            "componentType": 5125,  # UNSIGNED_INT
            "count": arr.shape[0],
            "type": "SCALAR",
        }
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def add_material(self, name, rgba, metallic=0.3, roughness=0.6):
        self.materials.append(
            {
                "name": name,
                "pbrMetallicRoughness": {
                    "baseColorFactor": rgba,
                    "metallicFactor": metallic,
                    "roughnessFactor": roughness,
                },
            }
        )
        return len(self.materials) - 1

    def add_box_node(self, name, center, size, material_idx):
        """Axis-aligned box, vertices in the node's LOCAL space (so the node's
        translation alone controls where it sits in the scene, and can be
        animated later without touching geometry)."""
        hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
        # 24 verts (4 per face) so normals are flat/correct per face.
        faces = [
            # (normal, 4 corner offsets)
            ((0, 0, 1), [(-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]),
            ((0, 0, -1), [(hx, -hy, -hz), (-hx, -hy, -hz), (-hx, hy, -hz), (hx, hy, -hz)]),
            ((0, 1, 0), [(-hx, hy, hz), (hx, hy, hz), (hx, hy, -hz), (-hx, hy, -hz)]),
            ((0, -1, 0), [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, -hy, hz), (-hx, -hy, hz)]),
            ((1, 0, 0), [(hx, -hy, hz), (hx, -hy, -hz), (hx, hy, -hz), (hx, hy, hz)]),
            ((-1, 0, 0), [(-hx, -hy, -hz), (-hx, -hy, hz), (-hx, hy, hz), (-hx, hy, -hz)]),
        ]
        positions = []
        normals = []
        indices = []
        for normal, corners in faces:
            base = len(positions)
            for c in corners:
                positions.append(c)
                normals.append(normal)
            indices += [base, base + 1, base + 2, base, base + 2, base + 3]

        pos_acc = self.add_accessor_vec3(np.array(positions, dtype="<f4"))
        norm_acc = self.add_accessor_vec3(np.array(normals, dtype="<f4"))
        idx_acc = self.add_accessor_indices(np.array(indices, dtype="<u4"))

        mesh = {
            "name": f"{name}_mesh",
            "primitives": [
                {
                    "attributes": {"POSITION": pos_acc, "NORMAL": norm_acc},
                    "indices": idx_acc,
                    "material": material_idx,
                }
            ],
        }
        self.meshes.append(mesh)
        mesh_idx = len(self.meshes) - 1

        node = {"name": name, "mesh": mesh_idx, "translation": list(center)}
        self.nodes.append(node)
        node_idx = len(self.nodes) - 1
        self.scene_nodes.append(node_idx)
        return node_idx

    def write(self, path):
        gltf = {
            "asset": {"version": "2.0", "generator": "digital-twin-lab minimal GLB writer"},
            "scene": 0,
            "scenes": [{"nodes": self.scene_nodes}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "materials": self.materials,
            "accessors": self.accessors,
            "bufferViews": self.buffer_views,
            "buffers": [{"byteLength": len(self.buffers)}],
        }
        json_bytes = pad_to_4(json.dumps(gltf).encode("utf-8"), b" ")
        bin_bytes = pad_to_4(bytes(self.buffers), b"\x00")

        total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
        with open(path, "wb") as f:
            f.write(struct.pack("<4sII", b"glTF", 2, total_len))
            f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))  # 'JSON'
            f.write(json_bytes)
            f.write(struct.pack("<II", len(bin_bytes), 0x004E4942))  # 'BIN\0'
            f.write(bin_bytes)
        return total_len
