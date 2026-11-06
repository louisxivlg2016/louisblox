import bpy
import bmesh
import os
from mathutils import Matrix, Vector

ROOT = '/home/louisxiv/louisblox'
LIVING = f'{ROOT}/.tmp/hunyuan-living-low-poly' if os.environ.get('USE_LOW_POLY') else f'{ROOT}/.tmp/hunyuan-living-pro' if os.environ.get('USE_PRO') else f'{ROOT}/.tmp/hunyuan-living'
ASSETS = f'{ROOT}/.tmp/hunyuan-new-assets'
COSTUMES = f'{ROOT}/.tmp/hunyuan-costume-v3'
TARGET_HEIGHT = 1.9000003337860107
models = {
    'cow': (f'{LIVING}/cow.glb', 'animal', 1.35),
    'chicken': (f'{LIVING}/chicken.glb', 'bird', 0.75),
    'sheep': (f'{LIVING}/sheep.glb', 'animal', 1.4),
    'pig': (f'{LIVING}/pig.glb', 'animal', 0.85),
    'horse': (f'{LIVING}/horse.glb', 'animal', 1.65),
    'camel': (f'{LIVING}/camel.glb', 'animal', 1.85),
    'duck': (f'{LIVING}/duck.glb', 'bird', 0.65),
    'trader': (f'{LIVING}/trader.glb', 'human', TARGET_HEIGHT),
    'classic-girl': (f'{LIVING}/classic-girl.glb', 'human', TARGET_HEIGHT),
    'classic-boy': (f'{LIVING}/classic-boy.glb', 'human', TARGET_HEIGHT),
    'soldier': (f'{COSTUMES}/full-soldier.glb', 'human', TARGET_HEIGHT),
    'rifle': (f'{ASSETS}/rifle.glb', 'rifle', 2.4),
    'police-car': (f'{ASSETS}/police-car.glb', 'vehicle', 3.1),
    'fire-truck': (f'{ASSETS}/fire-truck.glb', 'vehicle', 3.4),
}
requested = set(filter(None, os.environ.get('MODEL_NAMES', ','.join(models)).split(',')))

def bounds(objects):
    points = [vertex.co for obj in objects for vertex in obj.data.vertices]
    minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
    return minimum, maximum

def subset(source, polygons, name, pivot=None):
    if not polygons:
        return None
    copy = source.copy()
    copy.data = source.data.copy()
    copy.name = name
    bpy.context.collection.objects.link(copy)
    mesh = bmesh.new()
    mesh.from_mesh(copy.data)
    mesh.faces.index_update()
    bmesh.ops.delete(mesh, geom=[face for face in mesh.faces if face.index not in polygons], context='FACES')
    mesh.to_mesh(copy.data)
    mesh.free()
    copy['source'] = 'Hunyuan'
    if pivot is not None:
        copy.data.transform(Matrix.Translation(-pivot))
        copy.location = pivot
    return copy

for name in requested:
    source_path, kind, target = models[name]
    if not os.path.exists(source_path):
        raise FileNotFoundError(source_path)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=source_path)
    objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    for obj in objects:
        obj.data.transform(obj.matrix_world)
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)
    if kind == 'human' or name in ['cow', 'sheep', 'pig']:
        rotation = Matrix.Identity(4)
    elif kind == 'rifle':
        rotation = Matrix.Rotation(1.5707963267948966, 4, 'Z')
    else:
        rotation = Matrix.Rotation(-1.5707963267948966, 4, 'Z')
    for obj in objects:
        obj.data.transform(rotation)
    minimum, maximum = bounds(objects)
    center = (minimum + maximum) / 2
    size = maximum - minimum
    if kind in ['human', 'animal', 'bird']:
        scale = target / max(size.z, 0.0001)
    elif kind == 'rifle':
        scale = target / max(size.y, 0.0001)
    else:
        scale = min(2.65 / max(size.x, 0.0001), target / max(size.z, 0.0001), (6.2 if name == 'fire-truck' else 5.1) / max(size.y, 0.0001))
    transform = Matrix.Translation(Vector((-center.x * scale, -center.y * scale, -minimum.z * scale))) @ Matrix.Scale(scale, 4)
    for obj in objects:
        obj.data.transform(transform)
    minimum, maximum = bounds(objects)
    center = (minimum + maximum) / 2
    size = maximum - minimum
    if kind in ['animal', 'bird', 'vehicle']:
        for source in objects:
            groups = {}
            body = set()
            for polygon in source.data.polygons:
                point = polygon.center
                if kind == 'vehicle':
                    part = point.z < minimum.z + size.z * 0.4 and abs(point.x - center.x) > size.x * 0.28
                    index = (0 if point.x < center.x else 2) + (0 if point.y < center.y else 1)
                elif kind == 'animal':
                    part = point.z < minimum.z + size.z * 0.45 and abs(point.x - center.x) > size.x * 0.16 and (name != 'horse' or point.y < center.y + size.y * 0.38)
                    index = (0 if point.x < center.x else 2) + (0 if point.y < center.y else 1)
                else:
                    part = point.z < minimum.z + size.z * 0.4 and abs(point.x - center.x) < size.x * 0.22 and abs(point.y - center.y) < size.y * 0.35
                    index = 0 if point.x < center.x else 1
                if part:
                    groups.setdefault(index, set()).add(polygon.index)
                else:
                    body.add(polygon.index)
            subset(source, body, f'{name}-body')
            for index, polygons in groups.items():
                points = [source.data.vertices[vertex].co for polygon in source.data.polygons if polygon.index in polygons for vertex in polygon.vertices]
                pivot = sum(points, Vector()) / len(points)
                if kind != 'bird':
                    pivot.z = minimum.z + size.z * 0.45
                subset(source, polygons, f'animal-leg-{index}' if kind != 'vehicle' else f'animated-wheel-{index}', pivot)
            bpy.data.objects.remove(source, do_unlink=True)
    else:
        for obj in objects:
            obj.name = 'flintlock-rifle' if kind == 'rifle' else f'full-{name}'
            obj['source'] = 'Hunyuan'
    output = f'{ROOT}/assets/models/{"bayonet-rifle" if kind == "rifle" else "police-car" if name == "police-car" else "fire-truck" if name == "fire-truck" else f"full-{name}" if kind == "human" else f"reference-{name}"}.glb'
    bpy.context.scene['source'] = 'Hunyuan'
    bpy.context.scene['reference'] = name
    bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', export_animations=False, export_extras=True, export_yup=True)
    print(f'{name}: prêt, dimensions {tuple(size)}', flush=True)
