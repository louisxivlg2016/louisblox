import { LinearFilter, LinearMipmapLinearFilter, MirroredRepeatWrapping, SRGBColorSpace, TextureLoader } from 'three';
import type { Texture } from 'three';
import { BlockKind } from './voxel';
import roseUrl from '../../assets/vitraux/rose-lisse.webp';
import geometricUrl from '../../assets/vitraux/geometric-lisse.webp';
import sunUrl from '../../assets/vitraux/sun-lisse.webp';
import forestUrl from '../../assets/vitraux/forest-lisse.webp';
import oceanUrl from '../../assets/vitraux/ocean-lisse.webp';
import violetUrl from '../../assets/vitraux/violet-lisse.webp';
import rainbowUrl from '../../assets/vitraux/rainbow-lisse.webp';
import doveUrl from '../../assets/vitraux/dove-lisse.webp';
import { translate } from './language';

export type VitrailDesign = { name: string; url: string };
const designs = (): Partial<Record<BlockKind, VitrailDesign>> => ({
  [BlockKind.GlassWhite]: { name: 'Roses', url: roseUrl },
  [BlockKind.GlassOrange]: { name: 'Soleil', url: sunUrl },
  [BlockKind.GlassMagenta]: { name: translate('Arc-en-ciel', 'Rainbow'), url: rainbowUrl },
  [BlockKind.GlassLightBlue]: { name: translate('Océan', 'Ocean'), url: oceanUrl },
  [BlockKind.GlassYellow]: { name: 'Soleil', url: sunUrl },
  [BlockKind.GlassLime]: { name: translate('Forêt', 'Forest'), url: forestUrl },
  [BlockKind.GlassPink]: { name: 'Roses', url: roseUrl },
  [BlockKind.GlassGray]: { name: translate('Géométrie', 'Geometry'), url: geometricUrl },
  [BlockKind.GlassLightGray]: { name: translate('Colombe', 'Dove'), url: doveUrl },
  [BlockKind.GlassCyan]: { name: translate('Océan', 'Ocean'), url: oceanUrl },
  [BlockKind.GlassPurple]: { name: translate('Nuit violette', 'Purple Night'), url: violetUrl },
  [BlockKind.GlassBlue]: { name: translate('Océan', 'Ocean'), url: oceanUrl },
  [BlockKind.GlassBrown]: { name: translate('Forêt', 'Forest'), url: forestUrl },
  [BlockKind.GlassGreen]: { name: translate('Forêt', 'Forest'), url: forestUrl },
  [BlockKind.GlassRed]: { name: 'Roses', url: roseUrl },
  [BlockKind.GlassBlack]: { name: translate('Nuit violette', 'Purple Night'), url: violetUrl },
});

export function getVitrailDesign(kind: BlockKind) {
  return designs()[kind];
}

const textures = new Map<BlockKind, Texture>();
const loader = new TextureLoader();

export function getVitrailTexture(kind: BlockKind) {
  const design = getVitrailDesign(kind);
  if (!design) return null;
  let texture = textures.get(kind);
  if (!texture) {
    texture = loader.load(design.url);
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.wrapS = MirroredRepeatWrapping;
    texture.wrapT = MirroredRepeatWrapping;
    texture.colorSpace = SRGBColorSpace;
    textures.set(kind, texture);
  }
  return texture;
}

export function getVitrailIcon(kind: BlockKind) {
  return getVitrailDesign(kind)?.url;
}
