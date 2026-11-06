import bpy
import json
import math
import os
from mathutils import Matrix, Vector

ROOT = '/home/louisxiv/louisblox'
SOURCE = f'{ROOT}/.tmp/hunyuan-pirate'
PREVIEWS = f'{ROOT}/.tmp/pirate-previews'
os.makedirs(PREVIEWS, exist_ok=True)
models = {
    'horse-saddle': ('saddle', 0.95),
    'pirate-ship': ('ship', 15),
    'pirate-treasure': ('treasure', 3.5),
    'pirate-player': ('player', 1.9000003337860107),
}


def bounds(objects):
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
    minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
    return minimum, maximum


def image_color(material, uv):
    if not material or not material.use_nodes:
        return (0, 0, 0)
    for node in material.node_tree.nodes:
        if node.type != 'TEX_IMAGE' or not node.image:
            continue
        image = node.image
        if not image.pixels:
            continue
        x = min(image.size[0] - 1, max(0, int((uv.x % 1) * image.size[0])))
        y = min(image.size[1] - 1, max(0, int((uv.y % 1) * image.size[1])))
        offset = (y * image.size[0] + x) * 4
        return tuple(image.pixels[offset:offset + 3])
    return (0, 0, 0)


def mark_sails(objects):
    sails = {}
    minimum, maximum = bounds(objects)
    floor = minimum.z + (maximum.z - minimum.z) * 0.32
    count = 0
    for obj in objects:
        materials = list(obj.data.materials)
        for polygon in obj.data.polygons:
            if polygon.center.z < floor:
                continue
            uv = obj.data.uv_layers.active
            if not uv or not polygon.loop_indices:
                continue
            point = sum((uv.data[index].uv for index in polygon.loop_indices), Vector((0, 0))) / len(polygon.loop_indices)
            source = materials[polygon.material_index]
            red, green, blue = image_color(source, point)
            if min(red, green, blue) < 0.55 or max(red, green, blue) - min(red, green, blue) > 0.3:
                continue
            if source.name not in sails:
                material = source.copy()
                material.name = 'ship-sail'
                sails[source.name] = len(obj.data.materials)
                obj.data.materials.append(material)
            polygon.material_index = sails[source.name]
            count += 1
    print(f'{count} faces de voile identifiées', flush=True)
    return count


def render_preview(name, kind, suffix=''):
    objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    minimum, maximum = bounds(objects)
    center = (minimum + maximum) / 2
    size = maximum - minimum
    radius = max(size)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 256 if kind in ['ship', 'player'] else 160
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
    if kind == 'player':
        direction = Vector((0.35, 2.5, 0.35)) if suffix != 'back' else Vector((0.35, -2.5, 0.35))
    else:
        direction = Vector((1.2, 1.7, 0.75))
    camera.location = center + direction * radius
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = radius * 1.35
    scene.camera = camera
    light_data = bpy.data.lights.new('preview-light', 'AREA')
    light_data.energy = 450 * max(radius, 1)
    light = bpy.data.objects.new('preview-light', light_data)
    bpy.context.collection.objects.link(light)
    light.location = center + Vector((-radius, radius * 1.5, radius * 2))
    light.rotation_euler = (center - light.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = f'{PREVIEWS}/{name}{"-" + suffix if suffix else ""}.png'
    bpy.ops.render.render(write_still=True)


def tint_sails(color):
    for material in bpy.data.materials:
        if not material.name.startswith('ship-sail') or not material.use_nodes:
            continue
        for node in list(material.node_tree.nodes):
            if node.type == 'MIX_RGB':
                material.node_tree.nodes.remove(node)
        shader = next((node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED'), None)
        if not shader:
            continue
        source = shader.inputs['Base Color'].links[0].from_socket if shader.inputs['Base Color'].links else None
        tint = material.node_tree.nodes.new('ShaderNodeMixRGB')
        tint.blend_type = 'MULTIPLY'
        tint.inputs[0].default_value = 1
        tint.inputs[2].default_value = (*color, 1)
        if source:
            material.node_tree.links.new(source, tint.inputs[1])
        else:
            tint.inputs[1].default_value = (1, 1, 1, 1)
        material.node_tree.links.new(tint.outputs[0], shader.inputs['Base Color'])


manifest_path = f'{ROOT}/.tmp/hunyuan-pirate-prepared.json'
manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
requested = set(filter(None, os.environ.get('MODEL_NAMES', ','.join(models)).split(',')))
for name in requested:
    kind, target = models[name]
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
    rotation = Matrix.Rotation(math.pi if kind in ['player', 'treasure'] else -math.pi / 2 if kind in ['ship', 'saddle'] else 0, 4, 'Z')
    for obj in objects:
        obj.data.transform(rotation)
    minimum, maximum = bounds(objects)
    center = (minimum + maximum) / 2
    size = maximum - minimum
    if kind == 'player':
        scale = target / max(size.z, 0.0001)
    elif kind == 'treasure':
        scale = target / max(size.z, 0.0001)
    else:
        scale = target / max(size.x, size.y, size.z, 0.0001)
    transform = Matrix.Translation(Vector((-center.x * scale, -center.y * scale, -minimum.z * scale))) @ Matrix.Scale(scale, 4)
    for obj in objects:
        obj.data.transform(transform)
    sail_faces = mark_sails(objects) if kind == 'ship' else 0
    for obj in objects:
        obj.name = name
        obj['source'] = 'Hunyuan'
    filename = f'{name}.glb'
    bpy.context.scene['source'] = 'Hunyuan'
    bpy.context.scene['reference'] = name
    bpy.ops.export_scene.gltf(filepath=f'{ROOT}/assets/models/{filename}', export_format='GLB', export_animations=False, export_extras=True, export_yup=True)
    render_preview(name, kind, 'back' if kind == 'player' else '')
    if kind == 'player':
        render_preview(name, kind, 'front')
    if kind == 'ship':
        tint_sails((0.78, 0.08, 0.12))
        render_preview(name, kind, 'red')
        tint_sails((0.08, 0.24, 0.82))
        render_preview(name, kind, 'blue')
    minimum, maximum = bounds(objects)
    manifest[name] = { 'source': 'Hunyuan', 'file': filename, 'sailFaces': sail_faces, 'min': list(minimum), 'max': list(maximum) }
    with open(f'{ROOT}/.tmp/hunyuan-pirate-prepared.json', 'w') as file:
        json.dump(manifest, file, indent=2)
    print(f'{name}: modèle prêt, dimensions {tuple(maximum - minimum)}', flush=True)
