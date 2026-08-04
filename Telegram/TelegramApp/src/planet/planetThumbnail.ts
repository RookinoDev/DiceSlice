// One-shot offscreen render of a PlanetProfile to a static PNG - the grid can't afford a live
// WebGL context per card (see CardArt.tsx), so this builds the exact same scene PlanetCanvas.tsx
// does (same layers/features/cracks/atmosphere/moons/outline post-pass), renders a single frame
// to a detached canvas, extracts a Blob, and disposes everything immediately. Called at most
// once per card - see ../../ui/cards/thumbnailCache.ts for the cache that makes that true.
import { WebGLRenderer, WebGLRenderTarget, Scene, OrthographicCamera, PlaneGeometry, Mesh, ShaderMaterial, Vector2, DoubleSide, NoBlending, AdditiveBlending, NormalBlending, type Material } from 'three'
import { planetVertexShader } from './glsl/common'
import { outlinePostFragmentShader, outlinePostVertexShader } from './shaders/outlinePost'
import { buildAtmosphereLayer, buildCrackLayer, buildFeatureLayer, buildLayers, buildMoonMeshes } from './PlanetCanvas'
import { planetMaxScale, type PlanetProfile } from './planetProfiles'

/** Renders `profile` once at `sizePx`x`sizePx` and resolves a PNG Blob. Every uniform that
 *  PlanetCanvas animates over time is pinned to a fixed value here - a card's thumbnail is a
 *  single deterministic snapshot, not a moment of live gameplay, and determinism means a cache
 *  eviction + re-render always reproduces the same image. */
export function renderPlanetThumbnail(profile: PlanetProfile, sizePx: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = sizePx
  canvas.height = sizePx
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true })
  renderer.setClearColor(0x000000, 0)
  renderer.setSize(sizePx, sizePx, false)

  const scene = new Scene()
  const layers = buildLayers(profile)
  const featureLayer = buildFeatureLayer(profile, layers)
  if (featureLayer) layers.push(featureLayer)
  if (profile.kind !== 'gasGiant' && profile.kind !== 'nebula') layers.push(buildCrackLayer(profile))
  const atmosphereLayer = buildAtmosphereLayer(profile, layers)
  if (atmosphereLayer) layers.push(atmosphereLayer)

  const maxScale = planetMaxScale(profile)
  const camera = new OrthographicCamera(-maxScale, maxScale, maxScale, -maxScale, 0.1, 10)
  camera.position.z = 5

  const geometry = new PlaneGeometry(2, 2)
  const rotation = 0
  const meshes = layers.map((layer) => {
    const material = new ShaderMaterial({
      vertexShader: planetVertexShader,
      fragmentShader: layer.fragmentShader,
      uniforms: layer.uniforms,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: layer.isAdditive ? AdditiveBlending : NormalBlending,
    })
    if (material.uniforms.uRotation) material.uniforms.uRotation.value = rotation + (layer.rotationOffset ?? 0)
    // uPlanetTime stays at its default 0 - see the function doc comment on why this is
    // deterministic instead of PlanetCanvas's live Math.random() phase jitter.
    const mesh = new Mesh(geometry, material)
    mesh.renderOrder = layer.renderOrder
    if (layer.scale) mesh.scale.set(layer.scale, layer.scale, 1)
    scene.add(mesh)
    return mesh
  })

  const moonMeshes = buildMoonMeshes(profile.moons, geometry, scene)
  moonMeshes.forEach((moon) => {
    // Same orbit formula as PlanetCanvas's animate loop, evaluated once at the moon's own
    // starting phase instead of ticking it forward - a moon's initial phase is itself
    // deterministic (see planetProfiles.ts's withMoons), so this reproduces cleanly too.
    const ang = moon.spec.phase
    const depth = Math.sin(ang)
    moon.mesh.position.set(Math.cos(ang) * moon.spec.orbitRadiusX, depth * moon.spec.orbitRadiusY, 0)
    moon.mesh.renderOrder = depth < 0 ? -1 : 100
    moon.mesh.scale.setScalar(moon.spec.scale * (0.85 + 0.15 * (depth * 0.5 + 0.5)))
    const moonUniforms = (moon.mesh.material as ShaderMaterial).uniforms
    moonUniforms.uRotation.value = rotation
  })

  // Toon outline post-pass - identical to PlanetCanvas's, so a thumbnail matches the live
  // focused-card look exactly instead of looking like a cheaper render of the same planet.
  const renderTarget = new WebGLRenderTarget(sizePx, sizePx, { depthBuffer: false, stencilBuffer: false })
  const postScene = new Scene()
  const postCamera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
  postCamera.position.z = 5
  const postMaterial = new ShaderMaterial({
    vertexShader: outlinePostVertexShader,
    fragmentShader: outlinePostFragmentShader,
    uniforms: { uScene: { value: renderTarget.texture }, uTexel: { value: new Vector2(1 / sizePx, 1 / sizePx) } },
    blending: NoBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  })
  postScene.add(new Mesh(geometry, postMaterial))

  renderer.setRenderTarget(renderTarget)
  renderer.render(scene, camera)
  renderer.setRenderTarget(null)
  renderer.render(postScene, postCamera)

  const dispose = () => {
    meshes.forEach((mesh) => (mesh.material as Material).dispose())
    moonMeshes.forEach((moon) => (moon.mesh.material as Material).dispose())
    postMaterial.dispose()
    renderTarget.dispose()
    geometry.dispose()
    renderer.dispose()
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      dispose()
      if (blob) resolve(blob)
      else reject(new Error('planet thumbnail: canvas.toBlob returned null'))
    }, 'image/png')
  })
}
