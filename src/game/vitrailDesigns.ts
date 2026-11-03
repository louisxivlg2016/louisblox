import { NearestFilter, SRGBColorSpace, TextureLoader } from 'three';
import type { Texture } from 'three';
import { BlockKind } from './voxel';
import roseUrl from '../../assets/vitraux/rose.png';
import geometricUrl from '../../assets/vitraux/geometric.png';
import sunUrl from '../../assets/vitraux/sun.png';
import forestUrl from '../../assets/vitraux/forest.png';
import oceanUrl from '../../assets/vitraux/ocean.png';
import violetUrl from '../../assets/vitraux/violet.png';
import rainbowUrl from '../../assets/vitraux/rainbow.png';
import doveUrl from '../../assets/vitraux/dove.png';

export type VitrailDesign = { name: string; url: string };
const designs: Partial<Record<BlockKind, VitrailDesign>> = {
  [BlockKind.Glass]: { name: 'Colombe', url: doveUrl },
  [BlockKind.GlassWhite]: { name: 'Roses', url: roseUrl },
  [BlockKind.GlassOrange]: { name: 'Soleil', url: sunUrl },
  [BlockKind.GlassMagenta]: { name: 'Arc-en-ciel', url: rainbowUrl },
  [BlockKind.GlassLightBlue]: { name: 'Océan', url: oceanUrl },
  [BlockKind.GlassYellow]: { name: 'Soleil', url: sunUrl },
  [BlockKind.GlassLime]: { name: 'Forêt', url: forestUrl },
  [BlockKind.GlassPink]: { name: 'Roses', url: roseUrl },
  [BlockKind.GlassGray]: { name: 'Géométrie', url: geometricUrl },
  [BlockKind.GlassLightGray]: { name: 'Colombe', url: doveUrl },
  [BlockKind.GlassCyan]: { name: 'Océan', url: oceanUrl },
  [BlockKind.GlassPurple]: { name: 'Nuit violette', url: violetUrl },
  [BlockKind.GlassBlue]: { name: 'Océan', url: oceanUrl },
  [BlockKind.GlassBrown]: { name: 'Forêt', url: forestUrl },
  [BlockKind.GlassGreen]: { name: 'Forêt', url: forestUrl },
  [BlockKind.GlassRed]: { name: 'Roses', url: roseUrl },
  [BlockKind.GlassBlack]: { name: 'Nuit violette', url: violetUrl },
};

export function getVitrailDesign(kind: BlockKind) {
  return designs[kind];
}

const textures = new Map<BlockKind, Texture>();
const loader = new TextureLoader();

export function getVitrailTexture(kind: BlockKind) {
  const design = getVitrailDesign(kind);
  if (!design) return null;
  let texture = textures.get(kind);
  if (!texture) {
    texture = loader.load(design.url);
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = SRGBColorSpace;
    textures.set(kind, texture);
  }
  return texture;
}

export function getVitrailIcon(kind: BlockKind) {
  return getVitrailDesign(kind)?.url;
}
