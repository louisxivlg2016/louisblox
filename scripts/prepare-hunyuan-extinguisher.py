import bpy
from mathutils import Matrix, Vector

source = '/home/louisxiv/louisblox/.tmp/hunyuan-extinguisher/extinguisher.glb'
output = '/home/louisxiv/louisblox/assets/models/weapon-extinguisher.glb'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
rotation = Matrix.Rotation(-1.5707963267948966, 4, 'Z')
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    obj.data.transform(obj.matrix_world)
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    obj.data.transform(rotation)
objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
points = [vertex.co for obj in objects for vertex in obj.data.vertices]
minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
center = (minimum + maximum) / 2
scale = 1.65 / max(maximum.y - minimum.y, 0.0001)
transform = Matrix.Translation(Vector((-center.x, -center.y, -minimum.z))) @ Matrix.Scale(scale, 4)
for obj in objects:
    obj.data.transform(transform)
    obj.name = 'weapon-extinguisher'
    obj['source'] = 'Hunyuan'
    modifier = obj.modifiers.new('PixelVoxel', 'REMESH')
    modifier.mode = 'VOXEL'
    modifier.voxel_size = 0.065
    modifier.use_smooth_shade = False
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.context.scene['source'] = 'Hunyuan'
bpy.context.scene['reference'] = 'extincteur pixelé'
bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', export_animations=False, export_extras=True, export_yup=True)
print('Extincteur Hunyuan pixelé prêt', flush=True)
