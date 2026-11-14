import bpy
import os
from mathutils import Matrix

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath('.tmp/hunyuan-vehicle-images/police-car.glb'))
font = bpy.data.fonts.load('/usr/share/fonts/liberation/LiberationSans-Bold.ttf')

def material(name, color):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = 0.75
    return result

white = material('Police label white', (0.92, 0.94, 0.94))
blue = material('Police label blue', (0.015, 0.12, 0.65))

def panel(name, center, rotation, width, height, surface):
    bpy.ops.mesh.primitive_plane_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = rotation
    obj.scale = (width, height, 1)
    obj.data.materials.append(surface)

def lettering(name, center, rotation, width, surface):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = 'POLICE'
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.size = 0.1
    curve.font = font
    curve.resolution_u = 8
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(surface)
    bpy.context.view_layer.update()
    local_width = max(point[0] for point in obj.bound_box) - min(point[0] for point in obj.bound_box)
    scale = width / local_width
    obj.scale = (scale, scale, scale)
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = rotation
    obj.location = center
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')

right = Matrix(((0, 0, 1), (1, 0, 0), (0, 1, 0))).to_quaternion()
left = Matrix(((0, 0, -1), (-1, 0, 0), (0, 1, 0))).to_quaternion()
for sign, rotation in ((1, right), (-1, left)):
    panel('Police side panel', (sign * 0.252, 0.025, -0.045), rotation, 0.46, 0.09, white)
    lettering('POLICE side lettering', (sign * 0.254, 0.025, -0.043), rotation, 0.34, blue)

bpy.ops.export_scene.gltf(filepath=os.path.abspath('.tmp/hunyuan-vehicle-images/police-car-labeled.glb'), export_format='GLB', export_apply=True)
