import bpy
import os
from mathutils import Vector

assets = [
    ('assets/models/airplane.glb', 'assets/icons/vehicle-airplane.png', 0.65),
    ('assets/models/raceCar.glb', 'assets/icons/vehicle-race-car.png', 0.65),
    ('assets/models/blueCar.glb', 'assets/icons/vehicle-blue-car.png', 0.65),
    ('assets/models/train.glb', 'assets/icons/vehicle-train.png', -0.65),
    ('assets/models/full-footballer.glb', '.tmp/hunyuan-footballer-preview.png', 0.0),
]

for source, output, angle in assets:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(source))
    root = bpy.data.objects.new('IconRoot', None)
    bpy.context.collection.objects.link(root)
    for obj in list(bpy.context.scene.objects):
        if obj != root and obj.parent is None:
            obj.parent = root
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
    center = (minimum + maximum) / 2
    root.scale = (2 / max(maximum - minimum),) * 3
    root.location = Vector(tuple(-center[index] * root.scale[index] for index in range(3)))
    root.rotation_euler.z = angle
    target = Vector((0, 0, 0))
    bpy.ops.object.camera_add(location=(3.4, -6.5, 2.8))
    camera = bpy.context.object
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 2.2 if 'airplane' in source or 'train' in source else 2.65
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.world = bpy.data.worlds.new('IconWorld')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.75
    bpy.ops.object.light_add(type='AREA', location=(2, -4, 6))
    light = bpy.context.object
    light.data.energy = 450
    light.data.size = 5
    light.rotation_euler = (target - light.location).to_track_quat('-Z', 'Y').to_euler()
    scene.view_settings.view_transform = 'Standard'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.filepath = os.path.abspath(output)
    bpy.ops.render.render(write_still=True)
