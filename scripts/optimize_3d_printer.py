"""
Safe, verifiable size reduction for workhorse_3d_printer.glb.

Does exactly two things, both lossless for what's actually rendered:
1. Removes the TEXCOORD_0 accessor/bufferView from every primitive. Verified
   safe because the file has zero images (checked: gltf['images'] == []),
   so no material actually samples a texture using these UVs.
2. Downgrades each primitive's index buffer from UNSIGNED_INT (4 bytes) to
   UNSIGNED_SHORT (2 bytes) wherever that primitive's vertex count fits
   (< 65536) — a well-defined, lossless re-encoding, not simplification.

Does NOT touch POSITION/NORMAL data or reduce triangle count. Real polygon
reduction needs proper tooling (gltf-transform/meshoptimizer) that requires
network access this sandbox doesn't have — see README for that step.
"""
import struct
import json
import numpy as np

SRC = "/mnt/user-data/uploads/workhorse_3d_printer.glb"
OUT = "/home/claude/digital-twin-lab/public/models/workhorse_3d_printer.glb"

with open(SRC, "rb") as f:
    magic, version, length = struct.unpack("<4sII", f.read(12))
    jlen, jtype = struct.unpack("<II", f.read(8))
    gltf = json.loads(f.read(jlen))
    blen, btype = struct.unpack("<II", f.read(8))
    bindata = f.read(blen)

assert gltf.get("images", []) == [], "File has images — TEXCOORD strip would NOT be safe, aborting."

comp_bytes = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
type_n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_accessor(acc):
    bv = gltf["bufferViews"][acc["bufferView"]]
    offset = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    dtype = {5121: "<u1", 5123: "<u2", 5125: "<u4", 5126: "<f4"}[acc["componentType"]]
    n = acc["count"] * type_n[acc["type"]]
    arr = np.frombuffer(bindata, dtype=dtype, count=n, offset=offset)
    return arr.reshape(acc["count"], type_n[acc["type"]]) if type_n[acc["type"]] > 1 else arr

# Build new buffer from scratch, keeping only accessors we still need.
new_buf = bytearray()
new_buffer_views = []
new_accessors = []
old_to_new_accessor = {}
removed_texcoord_bytes = 0
downgraded_index_bytes = 0

def append_data(data: bytes, target):
    offset = len(new_buf)
    while offset % 4 != 0:
        new_buf.append(0)
        offset += 1
    new_buf.extend(data)
    new_buffer_views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(data), "target": target})
    return len(new_buffer_views) - 1


def keep_accessor(old_idx, target, data_override=None, new_component_type=None):
    if old_idx in old_to_new_accessor:
        return old_to_new_accessor[old_idx]
    acc = gltf["accessors"][old_idx]
    if data_override is not None:
        data = data_override
        comp_type = new_component_type
    else:
        raw = read_accessor(acc)
        data = raw.astype({5126: "<f4", 5125: "<u4", 5123: "<u2"}[acc["componentType"]]).tobytes()
        comp_type = acc["componentType"]
    bv_idx = append_data(data, target)
    new_acc = {
        "bufferView": bv_idx,
        "componentType": comp_type,
        "count": acc["count"],
        "type": acc["type"],
    }
    if "min" in acc:
        new_acc["min"] = acc["min"]
    if "max" in acc:
        new_acc["max"] = acc["max"]
    new_accessors.append(new_acc)
    new_idx = len(new_accessors) - 1
    old_to_new_accessor[old_idx] = new_idx
    return new_idx


for mesh in gltf["meshes"]:
    for prim in mesh["primitives"]:
        # Drop TEXCOORD_0 (and any other TEXCOORD_n) — unused, no images exist.
        texcoord_keys = [k for k in prim["attributes"] if k.startswith("TEXCOORD")]
        for k in texcoord_keys:
            acc = gltf["accessors"][prim["attributes"][k]]
            bv = gltf["bufferViews"][acc["bufferView"]]
            removed_texcoord_bytes += bv["byteLength"]
            del prim["attributes"][k]

        for attr, old_idx in prim["attributes"].items():
            prim["attributes"][attr] = keep_accessor(old_idx, 34962)

        if "indices" in prim:
            old_idx = prim["indices"]
            acc = gltf["accessors"][old_idx]
            if acc["componentType"] == 5125:  # currently UNSIGNED_INT
                raw = read_accessor(acc)
                max_val = int(raw.max()) if raw.size else 0
                if max_val < 65536:
                    old_bytes = acc["count"] * 4
                    new_data = raw.astype("<u2").tobytes()
                    downgraded_index_bytes += old_bytes - len(new_data)
                    prim["indices"] = keep_accessor(
                        old_idx, 34963, data_override=new_data, new_component_type=5123
                    )
                else:
                    prim["indices"] = keep_accessor(old_idx, 34963)
            else:
                prim["indices"] = keep_accessor(old_idx, 34963)

gltf["accessors"] = new_accessors
gltf["bufferViews"] = new_buffer_views
gltf["buffers"] = [{"byteLength": len(new_buf)}]

def pad4(data, pad_byte):
    r = len(data) % 4
    return data if r == 0 else data + pad_byte * (4 - r)

json_bytes = pad4(json.dumps(gltf).encode("utf-8"), b" ")
bin_bytes = pad4(bytes(new_buf), b"\x00")
total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)

with open(OUT, "wb") as f:
    f.write(struct.pack("<4sII", b"glTF", 2, total_len))
    f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
    f.write(json_bytes)
    f.write(struct.pack("<II", len(bin_bytes), 0x004E4942))
    f.write(bin_bytes)

import os
orig_size = os.path.getsize(SRC)
new_size = os.path.getsize(OUT)
print(f"Original: {orig_size/1e6:.2f} MB")
print(f"New:      {new_size/1e6:.2f} MB")
print(f"Reduction: {(1 - new_size/orig_size)*100:.1f}%")
print(f"Index bytes saved from uint32->uint16: {downgraded_index_bytes/1e6:.2f} MB")
# Note: a per-primitive TEXCOORD byte tally was removed from this output —
# several primitives share bufferViews, which made a naive per-primitive sum
# overcount. The real, verified number is the file-size delta above.
