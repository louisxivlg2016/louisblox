import bpy
import os

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath('assets/models/airplane.glb'))
image = next(image for image in bpy.data.images if image.type == 'IMAGE' and image.size[0] > 0)
width, height = image.size
pixels = list(image.pixels)
for x0, y0, x1, y1, source_y in [
    (50, 38, 400, 58, 25),
    (50, 60, 400, 82, 95),
    (45, 112, 390, 134, 100),
    (60, 136, 380, 156, 100),
    (90, 170, 380, 190, 200),
]:
    for y in range(y0, y1 + 1):
        source = ((height - 1 - source_y) * width + x0) * 4
        target = ((height - 1 - y) * width + x0) * 4
        pixels[target:target + (x1 - x0 + 1) * 4] = pixels[source:source + (x1 - x0 + 1) * 4]
image.pixels = pixels
image.filepath_raw = os.path.abspath('.tmp/airplane-no-windows-texture.png')
image.save()
image.pack()
bpy.ops.export_scene.gltf(filepath=os.path.abspath('.tmp/airplane-no-windows.glb'), export_format='GLB', export_yup=True)
