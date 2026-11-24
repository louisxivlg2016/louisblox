import { BlockKind } from './voxel';

function sky(context: CanvasRenderingContext2D, top: string, bottom: string) {
  const gradient = context.createLinearGradient(0, 0, 0, context.canvas.height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
}

function circle(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function polygon(context: CanvasRenderingContext2D, color: string, points: Array<[number, number]>) {
  context.fillStyle = color;
  context.beginPath();
  points.forEach(([x, y], index) => index === 0 ? context.moveTo(x, y) : context.lineTo(x, y));
  context.closePath();
  context.fill();
}

function tree(context: CanvasRenderingContext2D, x: number, y: number, scale: number, color: string) {
  context.fillStyle = '#68472d';
  context.fillRect(x - 4 * scale, y, 8 * scale, 42 * scale);
  circle(context, x, y - 7 * scale, 24 * scale, color);
  circle(context, x - 17 * scale, y + 5 * scale, 18 * scale, color);
  circle(context, x + 17 * scale, y + 5 * scale, 18 * scale, color);
}

export function drawPainting(context: CanvasRenderingContext2D, kind: BlockKind) {
  const width = context.canvas.width;
  const height = context.canvas.height;
  context.clearRect(0, 0, width, height);
  context.save();
  context.scale(width / 256, height / 192);

  if (kind === BlockKind.PaintingCastle) {
    sky(context, '#70b9e8', '#d9eddf');
    circle(context, 205, 34, 18, '#fff1b0');
    circle(context, 52, 37, 13, '#f5fbff');
    circle(context, 67, 34, 17, '#f5fbff');
    circle(context, 83, 39, 12, '#f5fbff');
    polygon(context, '#91a7ad', [[0, 118], [49, 57], [86, 105], [126, 48], [178, 112], [217, 68], [256, 114], [256, 150], [0, 150]]);
    polygon(context, '#708b86', [[0, 132], [54, 86], [102, 130], [157, 78], [211, 132], [256, 96], [256, 154], [0, 154]]);
    context.fillStyle = '#75a94e';
    context.fillRect(0, 127, 256, 65);
    context.fillStyle = '#b9a77d';
    context.fillRect(72, 96, 112, 69);
    context.fillRect(57, 77, 35, 88);
    context.fillRect(166, 77, 35, 88);
    context.fillStyle = '#ded2ac';
    context.fillRect(64, 84, 21, 81);
    context.fillRect(173, 84, 21, 81);
    context.fillRect(81, 102, 94, 63);
    for (const x of [57, 72, 87, 166, 181, 72, 94, 158, 180]) context.fillRect(x, x < 100 || x > 160 ? 70 : 94, 10, 12);
    context.fillStyle = '#655b55';
    for (const [x, y] of [[69, 105], [181, 105], [94, 119], [153, 119]]) context.fillRect(x, y, 9, 16);
    context.fillStyle = '#4c4037';
    context.beginPath();
    context.arc(128, 140, 15, Math.PI, 0);
    context.fillRect(113, 140, 30, 25);
    context.fill();
    context.fillStyle = '#a74235';
    polygon(context, '#b84237', [[74, 70], [74, 48], [97, 54], [74, 60]]);
    polygon(context, '#b84237', [[183, 70], [183, 48], [206, 54], [183, 60]]);
    context.fillStyle = '#5c4935';
    context.fillRect(72, 45, 3, 28);
    context.fillRect(181, 45, 3, 28);
    context.fillStyle = '#c6b184';
    polygon(context, '#c6b184', [[108, 192], [148, 192], [137, 153], [119, 153]]);
  } else if (kind === BlockKind.PaintingSunset) {
    sky(context, '#474b8c', '#ef8d62');
    circle(context, 131, 82, 37, '#ffd47a');
    context.fillStyle = '#e76f58';
    context.fillRect(0, 96, 256, 4);
    const water = context.createLinearGradient(0, 99, 0, 192);
    water.addColorStop(0, '#5f79a0');
    water.addColorStop(1, '#274f70');
    context.fillStyle = water;
    context.fillRect(0, 99, 256, 93);
    polygon(context, '#3f4c66', [[0, 105], [41, 70], [79, 99], [119, 77], [164, 105], [210, 73], [256, 103], [256, 116], [0, 116]]);
    context.fillStyle = '#f4ae6a';
    for (let y = 112; y < 188; y += 9) {
      const half = 12 + (y - 105) * 0.42;
      context.fillRect(128 - half, y, half * 2, 3);
    }
    context.fillStyle = 'rgba(202, 231, 237, 0.5)';
    for (const [x, y, w] of [[15, 131, 43], [183, 144, 55], [31, 173, 62], [171, 118, 29]]) context.fillRect(x, y, w, 2);
    polygon(context, '#253e49', [[0, 163], [31, 148], [58, 158], [83, 145], [104, 166], [104, 192], [0, 192]]);
  } else if (kind === BlockKind.PaintingKing) {
    sky(context, '#263d65', '#536887');
    context.fillStyle = '#bd963f';
    context.fillRect(15, 15, 226, 162);
    context.fillStyle = '#24354f';
    context.fillRect(20, 20, 216, 152);
    polygon(context, '#782f3c', [[52, 172], [69, 125], [103, 109], [153, 109], [187, 125], [204, 172]]);
    polygon(context, '#ede5d2', [[99, 112], [128, 142], [157, 112], [148, 172], [108, 172]]);
    context.fillStyle = '#d4a52f';
    context.fillRect(124, 135, 8, 37);
    circle(context, 128, 83, 38, '#e6b993');
    context.fillStyle = '#e8e1cf';
    context.fillRect(91, 60, 10, 59);
    context.fillRect(155, 60, 10, 59);
    circle(context, 96, 100, 12, '#e8e1cf');
    circle(context, 160, 100, 12, '#e8e1cf');
    context.fillStyle = '#3c3031';
    context.fillRect(108, 79, 8, 5);
    context.fillRect(140, 79, 8, 5);
    context.fillStyle = '#b87668';
    context.fillRect(121, 101, 14, 3);
    polygon(context, '#e4bd3f', [[91, 57], [87, 28], [105, 40], [116, 20], [128, 39], [142, 19], [153, 41], [169, 28], [164, 58]]);
    context.fillStyle = '#f3d66b';
    context.fillRect(91, 51, 73, 12);
    for (const [x, color] of [[103, '#b63e42'], [127, '#5384c5'], [151, '#b63e42']] as const) circle(context, x, 55, 4, color);
  } else if (kind === BlockKind.PaintingCat) {
    sky(context, '#a9d4ce', '#e7d9b6');
    circle(context, 128, 100, 65, '#b97850');
    polygon(context, '#b97850', [[75, 71], [77, 22], [111, 52]]);
    polygon(context, '#b97850', [[181, 71], [179, 22], [145, 52]]);
    polygon(context, '#e6ad98', [[83, 55], [83, 35], [99, 51]]);
    polygon(context, '#e6ad98', [[173, 55], [173, 35], [157, 51]]);
    circle(context, 102, 91, 13, '#f1e5cc');
    circle(context, 154, 91, 13, '#f1e5cc');
    circle(context, 103, 92, 6, '#47624e');
    circle(context, 153, 92, 6, '#47624e');
    context.fillStyle = '#2f3130';
    context.fillRect(101, 86, 3, 13);
    context.fillRect(152, 86, 3, 13);
    polygon(context, '#7f4744', [[120, 112], [136, 112], [128, 121]]);
    context.strokeStyle = '#584337';
    context.lineWidth = 3;
    for (const y of [113, 125]) {
      context.beginPath(); context.moveTo(104, y); context.lineTo(54, y - 7); context.stroke();
      context.beginPath(); context.moveTo(152, y); context.lineTo(202, y - 7); context.stroke();
    }
    context.fillStyle = '#815038';
    for (const [x, y] of [[84, 67], [94, 60], [162, 60], [172, 67], [76, 104], [180, 104]]) context.fillRect(x, y, 8, 13);
    polygon(context, '#815038', [[88, 154], [111, 142], [128, 160], [145, 142], [168, 154], [184, 192], [72, 192]]);
  } else if (kind === BlockKind.PaintingForest) {
    sky(context, '#8ac5d5', '#d5ddae');
    circle(context, 201, 35, 20, '#f7e5a0');
    context.fillStyle = '#78a65b';
    context.fillRect(0, 118, 256, 74);
    polygon(context, '#6c9b62', [[0, 127], [36, 88], [75, 125], [117, 82], [162, 123], [209, 91], [256, 126], [256, 151], [0, 151]]);
    tree(context, 40, 83, 1.25, '#2f6745');
    tree(context, 211, 89, 1.2, '#356e47');
    tree(context, 92, 100, 0.82, '#467e48');
    tree(context, 162, 105, 0.72, '#477e48');
    polygon(context, '#c5ad78', [[105, 192], [165, 192], [143, 130], [126, 130]]);
    context.fillStyle = '#8db1c1';
    polygon(context, '#8db1c1', [[0, 163], [37, 151], [74, 161], [101, 154], [104, 166], [69, 174], [31, 165], [0, 177]]);
    for (const [x, y, color] of [[23, 153, '#f0d266'], [190, 158, '#e597a7'], [74, 180, '#eee5cf'], [217, 138, '#e6d375']] as const) circle(context, x, y, 3, color);
  } else {
    context.fillStyle = '#eee4d0';
    context.fillRect(0, 0, 256, 192);
    context.fillStyle = '#315c91';
    context.fillRect(20, 19, 89, 71);
    context.fillStyle = '#cf4b3f';
    context.fillRect(139, 20, 94, 42);
    context.fillStyle = '#e4b93f';
    context.fillRect(139, 72, 44, 93);
    context.fillStyle = '#4b8b68';
    context.fillRect(193, 72, 40, 93);
    circle(context, 75, 135, 39, '#9a5a91');
    circle(context, 75, 135, 20, '#eee4d0');
    context.strokeStyle = '#2d3338';
    context.lineWidth = 7;
    context.beginPath(); context.moveTo(16, 175); context.lineTo(237, 13); context.stroke();
    context.fillStyle = '#2d3338';
    context.fillRect(119, 15, 6, 162);
    context.fillRect(15, 98, 222, 6);
  }
  context.restore();
}
