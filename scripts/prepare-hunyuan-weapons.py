import bpy
import os
from mathutils import Matrix, Vector

root = '/home/louisxiv/louisblox'
models = {
    'auto-rifle': 2.4,
    'bomb-launcher': 2.4,
    'pistol': 1.15,
    'paintball': 1.65,
}
requested = set(filter(None, os.environ.get('MODEL_NAMES', ','.join(models)).split(',')))
for name in requested:
    source = f'{root}/.tmp/hunyuan-weapons/{name}.glb'
    if not os.path.exists(source):
        raise FileNotFoundError(source)
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
    length = max(maximum.y - minimum.y, 0.0001)
    scale = models[name] / length
    transform = Matrix.Translation(Vector((-center.x, -center.y, -minimum.z))) @ Matrix.Scale(scale, 4)
    for obj in objects:
        obj.data.transform(transform)
        obj.name = f'weapon-{name}'
        obj['source'] = 'Hunyuan'
    bpy.context.scene['source'] = 'Hunyuan'
    bpy.context.scene['reference'] = name
    bpy.ops.export_scene.gltf(filepath=f'{root}/assets/models/weapon-{name}.glb', export_format='GLB', export_animations=False, export_extras=True, export_yup=True)
    print(f'{name}: modèle préparé', flush=True)
