import bpy
import bmesh
import json
import math
import os
import shutil
from mathutils import Matrix, Vector

ROOT = '/home/louisxiv/louisblox'
SOURCE = f'{ROOT}/.tmp/hunyuan-nature'
PREVIEWS = f'{ROOT}/.tmp/nature-previews'
os.makedirs(PREVIEWS, exist_ok=True)

models = {
    'wolf': ('animal', 1.15, 0.46),
    'snowWolf': ('animal', 1.15, 0.46),
    'bear': ('animal', 1.75, 0.40),
    'snowBear': ('animal', 1.95, 0.40),
    'deer': ('animal', 1.85, 0.33),
    'snowDeer': ('animal', 1.85, 0.33),
    'crop-wheat': ('crop', 1.0, 0),
    'crop-carrot': ('crop', 0.7, 0.42),
    'crop-corn': ('crop', 1.55, 0.18),
    'crop-tomato': ('crop', 1.25, 0.42),
    'food-cooked-chicken': ('food', 0.78, 0),
    'food-raw-chicken': ('food', 0.78, 0),
    'food-raw-salmon': ('food', 0.78, 0),
    'food-cooked-salmon': ('food', 0.78, 0),
    'food-cheese-slice': ('food', 0.68, 0),
    'food-cheese-wheel': ('food', 0.82, 0),
    'food-tomato': ('food', 0.52, 0),
    'food-raw-meat': ('food', 0.78, 0),
    'food-cooked-meat': ('food', 0.78, 0),
    'food-cooked-corn': ('food', 0.78, 0),
    'food-bread': ('food', 0.78, 0),
    'food-cake': ('food', 0.82, 0),
    'food-milk': ('food', 0.68, 0),
    'food-wheat': ('food', 0.78, 0),
    'food-carrot': ('food', 0.72, 0),
}


def bounds(objects):
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
    minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
    return minimum, maximum


def trim_ground(objects, fraction):
    minimum, maximum = bounds(objects)
    size = maximum - minimum
    width = max(size.x, size.y)
    removed = 0
    for obj in objects:
        mesh = bmesh.new()
        mesh.from_mesh(obj.data)
        unvisited = set(mesh.verts)
        ground = set()
        while unvisited:
            first = unvisited.pop()
            component = {first}
            queue = [first]
            while queue:
                vertex = queue.pop()
                for edge in vertex.link_edges:
                    other = edge.other_vert(vertex)
                    if other in unvisited:
                        unvisited.remove(other)
                        component.add(other)
                        queue.append(other)
            points = [vertex.co for vertex in component]
            low = Vector(tuple(min(point[index] for point in points) for index in range(3)))
            high = Vector(tuple(max(point[index] for point in points) for index in range(3)))
            dimensions = high - low
            center = (low + high) / 2
            if (center.z < minimum.z + size.z * 0.48
                    and max(dimensions.x, dimensions.y) > width * 0.65
                    and dimensions.z < max(dimensions.x, dimensions.y) * 1.15):
                ground.update(component)
        if ground:
            removed += len(ground)
            bmesh.ops.delete(mesh, geom=list(ground), context='VERTS')
        mesh.to_mesh(obj.data)
        mesh.free()
        obj.data.update()
    if fraction > 0:
        floor = minimum.z + size.z * fraction
        for obj in objects:
            mesh = bmesh.new()
            mesh.from_mesh(obj.data)
            faces = [face for face in mesh.faces if face.calc_center_median().z < floor]
            if faces:
                bmesh.ops.delete(mesh, geom=faces, context='FACES')
            mesh.to_mesh(obj.data)
            mesh.free()
            obj.data.update()
    print(f'{removed} sommets de socle retirés', flush=True)


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


def split_legs(objects, name, fraction):
    minimum, maximum = bounds(objects)
    center = (minimum + maximum) / 2
    size = maximum - minimum
    legs = []
    for source in objects:
        groups = {}
        body = set()
        for polygon in source.data.polygons:
            point = polygon.center
            is_leg = point.z < minimum.z + size.z * fraction and abs(point.x - center.x) > size.x * 0.13
            if is_leg:
                index = (0 if point.x < center.x else 2) + (0 if point.y < center.y else 1)
                groups.setdefault(index, set()).add(polygon.index)
            else:
                body.add(polygon.index)
        subset(source, body, f'{name}-body')
        for index, polygons in groups.items():
            points = [source.data.vertices[vertex].co for polygon in source.data.polygons if polygon.index in polygons for vertex in polygon.vertices]
            pivot = sum(points, Vector()) / len(points)
            pivot.z = minimum.z + size.z * fraction
            legs.append(subset(source, polygons, f'animal-leg-{index}', pivot))
        bpy.data.objects.remove(source, do_unlink=True)
    return [leg.name for leg in legs if leg]


def render_preview(name, kind, target):
    objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    minimum, maximum = bounds(objects)
    center = (minimum + maximum) / 2
    size = maximum - minimum
    radius = max(size.x, size.y, size.z)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 192 if kind == 'animal' else 128
    scene.render.resolution_y = scene.render.resolution_x
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get('Background')
    background.inputs['Color'].default_value = (1, 1, 1, 1)
    background.inputs['Strength'].default_value = 0.85
    scene.view_settings.view_transform = 'Standard'
    camera_data = bpy.data.cameras.new('preview-camera')
    camera = bpy.data.objects.new('preview-camera', camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = center + Vector((radius * 1.2, radius * 1.7, radius * 0.8))
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = radius * 1.35
    scene.camera = camera
    light_data = bpy.data.lights.new('preview-light', 'AREA')
    light_data.energy = 450 * max(target, 0.4)
    light = bpy.data.objects.new('preview-light', light_data)
    bpy.context.collection.objects.link(light)
    light.location = center + Vector((-radius, radius * 1.5, radius * 2))
    light.rotation_euler = (center - light.location).to_track_quat('-Z', 'Y').to_euler()
    output = f'{PREVIEWS}/{name}.png'
    scene.render.filepath = output
    bpy.ops.render.render(write_still=True)
    if kind == 'crop':
        folder = f'{ROOT}/assets/crop-icons'
        filename = name.removeprefix('crop-') + '.png'
    elif kind == 'food':
        folder = f'{ROOT}/assets/food-icons'
        filename = name.removeprefix('food-') + '.png'
    else:
        return
    os.makedirs(folder, exist_ok=True)
    shutil.copyfile(output, f'{folder}/{filename}')


manifest_path = f'{ROOT}/.tmp/hunyuan-nature-prepared.json'
manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
requested = set(filter(None, os.environ.get('MODEL_NAMES', ','.join(models)).split(',')))
for name in requested:
    kind, target, fraction = models[name]
    source_path = f'{SOURCE}/{name}.glb'
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
    if kind == 'crop':
        trim_ground(objects, fraction)
        objects = [obj for obj in objects if len(obj.data.vertices) > 0]
    yaw = { 'bear': math.pi / 2, 'snowBear': math.pi / 2, 'deer': 0, 'snowDeer': 0 }.get(name, -math.pi / 2)
    rotation = Matrix.Rotation(yaw, 4, 'Z') if kind == 'animal' else Matrix.Identity(4)
    for obj in objects:
        obj.data.transform(rotation)
    minimum, maximum = bounds(objects)
    center = (minimum + maximum) / 2
    size = maximum - minimum
    scale = target / max(size.z if kind != 'food' else max(size), 0.0001)
    transform = Matrix.Translation(Vector((-center.x * scale, -center.y * scale, -minimum.z * scale))) @ Matrix.Scale(scale, 4)
    for obj in objects:
        obj.data.transform(transform)
    legs = split_legs(objects, name, fraction) if kind == 'animal' else []
    objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if kind != 'animal':
        for obj in objects:
            obj.name = name
            obj['source'] = 'Hunyuan'
    filename = f'reference-{name}.glb' if kind == 'animal' else f'{name}.glb'
    output = f'{ROOT}/assets/models/{filename}'
    bpy.context.scene['source'] = 'Hunyuan'
    bpy.context.scene['reference'] = name
    bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', export_animations=False, export_extras=True, export_yup=True)
    render_preview(name, kind, target)
    minimum, maximum = bounds(objects)
    manifest[name] = { 'source': 'Hunyuan', 'file': filename, 'legs': legs, 'min': list(minimum), 'max': list(maximum) }
    with open(manifest_path, 'w') as file:
        json.dump(manifest, file, indent=2)
    print(f'{name}: prêt, {len(legs)} pattes, dimensions {tuple(maximum - minimum)}', flush=True)
