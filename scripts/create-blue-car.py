import bpy
import os
from math import pi

bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, color, alpha=1):
    value = color.lstrip('#')
    rgb = tuple(int(value[index:index + 2], 16) / 255 for index in (0, 2, 4))
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, alpha)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, alpha)
    shader.inputs['Roughness'].default_value = 0.58
    shader.inputs['Metallic'].default_value = 0.04
    if alpha < 1:
        shader.inputs['Alpha'].default_value = alpha
        mat.surface_render_method = 'DITHERED'
    return mat

blue = material('Car cyan blue', '#25b9e9')
dark = material('Tires and chassis', '#151a20')
white = material('White seats and headlights', '#f2f7fa')
gray = material('Bumpers and wheel hubs', '#737e88')
red = material('Rear lights', '#e43d35')
glass = material('Windshield', '#bdeafa', 0.28)

def box(name, position, size, mat, bevel=0.035):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new('Small clean edges', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 1
    return obj

def cylinder(name, position, radius, depth, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=radius, depth=depth, location=position, rotation=(0, pi / 2, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj

box('Strong black chassis', (0, 0, 0.55), (3.45, 6.35, 0.55), dark)
box('Main blue body', (0, 0, 1.12), (3.25, 5.95, 0.85), blue)
box('Front hood', (0, -2.15, 1.65), (3.2, 1.9, 0.65), blue)
box('Rear trunk', (0, 2.15, 1.65), (3.2, 1.75, 0.65), blue)
box('Cabin floor', (0, 0.15, 1.42), (3.15, 2.65, 0.32), blue)
box('Cabin roof', (0, 0.12, 3.15), (3.3, 3.15, 0.3), blue)
for x in [-1.46, 1.46]:
    for y in [-1.25, 1.25]:
        box('Blue cabin pillar', (x, y, 2.35), (0.25, 0.25, 1.65), blue)
    box('Lower side door', (x, 0.05, 1.85), (0.22, 2.25, 0.8), blue)
    box('Blue side mirror', (x * 1.23, -1.1, 2.25), (0.35, 0.42, 0.38), blue)
box('Front windshield', (0, -1.29, 2.42), (2.65, 0.07, 1.05), glass, 0.015)
box('Dashboard', (0, -0.92, 1.98), (2.65, 0.45, 0.35), dark)
for x in [-0.7, 0.7]:
    box('White seat cushion', (x, 0.35, 1.68), (0.82, 0.85, 0.3), white)
    box('White seat back', (x, 0.72, 2.02), (0.82, 0.3, 0.9), white)
bpy.ops.mesh.primitive_torus_add(major_radius=0.3, minor_radius=0.055, major_segments=24, minor_segments=8, location=(-0.7, -0.62, 2.12), rotation=(pi / 2, 0, 0))
bpy.context.object.name = 'Black steering wheel'
bpy.context.object.data.materials.append(dark)
box('Front black grille', (0, -3.0, 1.12), (1.45, 0.09, 0.48), dark)
for z in [0.98, 1.13, 1.28]:
    box('Silver grille bar', (0, -3.055, z), (1.35, 0.035, 0.045), gray, 0.008)
for x in [-1.08, 1.08]:
    box('Front white headlight', (x, -3.015, 1.43), (0.66, 0.1, 0.55), white)
    box('Rear red light', (x, 3.015, 1.43), (0.66, 0.1, 0.46), red)
for y in [-3.15, 3.15]:
    box('Dark bumper', (0, y, 0.83), (3.5, 0.35, 0.35), dark)
for x in [-1.68, 1.68]:
    for y in [-2.1, 2.1]:
        cylinder('Black tire', (x, y, 0.67), 0.67, 0.46, dark)
        cylinder('Gray wheel hub', (x * 1.01, y, 0.67), 0.32, 0.49, gray)
        cylinder('Dark hub center', (x * 1.015, y, 0.67), 0.13, 0.5, dark)

bpy.ops.export_scene.gltf(filepath=os.path.abspath('assets/models/blueCar.glb'), export_format='GLB', export_yup=True)
