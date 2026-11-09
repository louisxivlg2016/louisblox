import bpy
import bmesh
import math
import os
from mathutils import Matrix, Vector

ROOT = '/home/louisxiv/louisblox'
MODELS = {'singe': 1.15, 'ocelot': 0.9, 'girafe': 2.7, 'elephant': 2.2}
FRACTIONS = {'singe': 0.36, 'ocelot': 0.35, 'girafe': 0.62, 'elephant': 0.42}


def bounds(objects):
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
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
        subset(source, body, f'reference-{name}-body')
        for index, polygons in groups.items():
            points = [source.data.vertices[vertex].co for polygon in source.data.polygons if polygon.index in polygons for vertex in polygon.vertices]
            pivot = sum(points, Vector()) / len(points)
            pivot.z = minimum.z + size.z * fraction
            legs.append(subset(source, polygons, f'animal-leg-{index}', pivot))
        bpy.data.objects.remove(source, do_unlink=True)
    return [leg.name for leg in legs if leg]


def render_preview(name, target):
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
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
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
    scene.render.filepath = f'{ROOT}/.tmp/jungle-previews/{name}.png'
    bpy.ops.render.render(write_still=True)


os.makedirs(f'{ROOT}/.tmp/jungle-previews', exist_ok=True)
requested = set(filter(None, os.environ.get('MODEL_NAMES', ','.join(MODELS)).split(',')))
for name in requested:
    source_path = f'{ROOT}/.tmp/hunyuan-jungle/{name}.glb'
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
        obj.data.transform(Matrix.Rotation(-math.pi / 2, 4, 'Z'))
    minimum, maximum = bounds(objects)
    center = (minimum + maximum) / 2
    scale = MODELS[name] / max((maximum - minimum).z, 0.0001)
    transform = Matrix.Translation(Vector((-center.x * scale, -center.y * scale, -minimum.z * scale))) @ Matrix.Scale(scale, 4)
    for obj in objects:
        obj.data.transform(transform)
    legs = split_legs(objects, name, FRACTIONS[name])
    objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    bpy.context.scene['source'] = 'Hunyuan'
    bpy.context.scene['reference'] = name
    bpy.ops.export_scene.gltf(filepath=f'{ROOT}/assets/models/reference-{name}.glb', export_format='GLB', export_animations=False, export_extras=True, export_yup=True)
    render_preview(name, MODELS[name])
    print(f'{name}: {len(legs)} pivots de pattes préparés', flush=True)
