import bpy
from mathutils import Vector

names = ['camel', 'cow', 'horse', 'pig', 'sheep', 'chicken', 'duck', 'bear', 'deer', 'wolf', 'snowWolf', 'snowBear']

for name in names:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    path = f'assets/models/{name}.glb'
    bpy.ops.import_scene.gltf(filepath=path)
    objects = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    largest = max(high - low)
    voxel_size = largest / 22
    for obj in objects:
        bpy.context.view_layer.objects.active = obj
        remesh = obj.modifiers.new('Minecraft voxels', 'REMESH')
        remesh.mode = 'VOXEL'
        remesh.voxel_size = voxel_size
        remesh.use_smooth_shade = False
        bpy.ops.object.modifier_apply(modifier=remesh.name)
        decimate = obj.modifiers.new('Game geometry', 'DECIMATE')
        decimate.ratio = 0.7
        bpy.ops.object.modifier_apply(modifier=decimate.name)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True)
    print(f'{name}: voxelisé')
