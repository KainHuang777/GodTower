import {
  AnimationState,
  AnimationStateData,
  AssetManager,
  AtlasAttachmentLoader,
  Skeleton,
  SkeletonJson,
  SkeletonRenderer,
  type TextureAtlas,
} from '@esotericsoftware/spine-canvas';

const DRAGON_ASSET_PATH = 'assets/sprites/spine/dragon-shadow/';
const DRAGON_ATLAS = 'Monster_Boss_1004.atlas';
const DRAGON_JSON = 'Monster_Boss_1004.json';

interface DragonSpineInstance {
  skeleton: Skeleton;
  animationState: AnimationState;
  anchorX: number;
  anchorY: number;
}

let dragonSpine: DragonSpineInstance | null = null;
let dragonSpineLoading = false;
let lastAnimationUpdateMs = 0;
const rendererByContext = new WeakMap<CanvasRenderingContext2D, SkeletonRenderer>();

/**
 * 載入 Boss 1004 作為龍影的 Spine 試點。
 * 載入與解析失敗時不會阻斷遊戲，drawDragonSpine 會回傳 false 讓呼叫端使用原生像素 fallback。
 */
export function preloadDragonSpine(): void {
  if (dragonSpine || dragonSpineLoading) return;
  dragonSpineLoading = true;

  const assets = new AssetManager(DRAGON_ASSET_PATH);
  assets.loadTextureAtlas(DRAGON_ATLAS);
  assets.loadJson(DRAGON_JSON);
  assets.loadAll()
    .then(() => {
      const atlas = assets.require(DRAGON_ATLAS) as TextureAtlas;
      const parser = new SkeletonJson(new AtlasAttachmentLoader(atlas));
      // 原始骨架約 245×205，縮至 Boss 於兩格內可辨識的尺寸。
      parser.scale = 0.24;
      const skeletonData = parser.readSkeletonData(assets.require(DRAGON_JSON) as object);
      const skeleton = new Skeleton(skeletonData);
      skeleton.setToSetupPose();

      const animationState = new AnimationState(new AnimationStateData(skeletonData));
      animationState.setAnimation(0, 'Walk', true);
      animationState.apply(skeleton);
      skeleton.updateWorldTransform();

      // 以實際可見 attachment 的 AABB 對齊中心，不再依賴固定 y 位移。
      // 這可避免 mesh 骨架有非零原點時看起來像被畫布裁掉。
      const bounds = skeleton.getBoundsRect();
      dragonSpine = {
        skeleton,
        animationState,
        anchorX: -bounds.x - bounds.width / 2,
        anchorY: -bounds.y - bounds.height / 2,
      };
    })
    .catch((error: unknown) => {
      console.warn('[Asset Loader] Dragon Spine pilot failed; using pixel-art fallback.', error);
    })
    .finally(() => {
      dragonSpineLoading = false;
    });
}

/** 在既有遊戲 Canvas 上繪製可動骨架；未就緒時交給呼叫端 fallback。 */
export function drawDragonSpine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hitFlashFrame: number,
): boolean {
  if (!dragonSpine) return false;

  const now = performance.now();
  const deltaSeconds = lastAnimationUpdateMs === 0
    ? 0
    : Math.min((now - lastAnimationUpdateMs) / 1000, 0.1);
  lastAnimationUpdateMs = now;
  dragonSpine.animationState.update(deltaSeconds);
  dragonSpine.animationState.apply(dragonSpine.skeleton);

  // 以骨架實際可見範圍置中，避免頭部或尾端因非零原點而落在預期範圍外。
  dragonSpine.skeleton.x = x + dragonSpine.anchorX;
  dragonSpine.skeleton.y = y + dragonSpine.anchorY;
  dragonSpine.skeleton.updateWorldTransform();

  let renderer = rendererByContext.get(ctx);
  if (!renderer) {
    renderer = new SkeletonRenderer(ctx);
    renderer.triangleRendering = true; // Boss 1004 的身體與頭部使用 mesh attachment。
    rendererByContext.set(ctx, renderer);
  }

  ctx.save();
  ctx.globalAlpha = hitFlashFrame > 0 ? 0.65 : 1;
  renderer.draw(dragonSpine.skeleton);
  ctx.restore();
  return true;
}
