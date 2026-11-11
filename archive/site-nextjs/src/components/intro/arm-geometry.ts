/*
 * Bras, main et verre redessinés en vectoriel d'après le dessin (repère 474 × 474).
 * Traits d'épaisseur constante et courbes lisses : ils restent nets en mouvement.
 */

/** Épaisseur du trait du dessin d'origine, dans le repère 474. */
export const STROKE = 4.6;

/** Silhouette du bras (fond blanc), prolongée sous le bas du cadre pour le mouvement. */
export const ARM_FILL =
  "M100 391C95 388 92 385 93 382C94 378 98 376 101 377C107 379 113 382 119 384" +
  "C117 372 114 350 112 330C111 322 114 316 120 316C126 316 129 320 130 326C132 338 135 350 139 360" +
  "C143 346 147 332 150 318C152 310 155 307 159 307C164 307 167 311 167 316C167 328 167 344 166 358" +
  "C176 348 188 338 205 335C222 333 238 332 250 334C262 337 267 348 270 360C274 376 279 396 285 418" +
  "C292 440 302 460 316 480L322 560H200L206 474C180 455 150 432 121 410C113 404 106 397 100 391Z";

/** Contour extérieur de la main : pouce, deux doigts levés, dos de la main, bord droit de l'avant-bras. */
export const HAND_OUTLINE =
  "M100 391C95 388 92 385 93 382C94 378 98 376 101 377C107 379 113 382 119 384" +
  "C117 372 114 350 112 330C111 322 114 316 120 316C126 316 129 320 130 326C132 338 135 350 139 360" +
  "C143 346 147 332 150 318C152 310 155 307 159 307C164 307 167 311 167 316C167 328 167 344 166 358" +
  "C176 348 188 338 205 335C209 334 212 334 215 335";

export const HAND_RIGHT_EDGE =
  "M226 334C236 332 246 332 252 336C262 342 267 350 270 360C274 376 279 396 285 418C292 440 302 460 314 474";

/** Bord inférieur de l'avant-bras (du pouce vers le bas du cadre). */
export const FOREARM_EDGE = "M100 391C108 398 114 404 121 409C150 431 178 452 206 474";

/** L'anneau du « OK » formé par le pouce et l'index autour du pied. */
export const RING =
  "M217 350C233 349 247 358 247 374C247 390 233 399 217 399C201 399 187 390 187 373C187 359 200 350 217 350Z";

/** Les deux attaches de l'anneau sous le dos de la main. */
export const RING_TIES: ReadonlyArray<string> = ["M190 363C191 349 202 340 214 341", "M221 341C233 338 244 340 247 352"];

/** Verre : coupe (bord droit en haut), pied, surface du vin. */
export const BOWL =
  "M168 201H262C264 201 265 202 265 204V258C265 281 258 298 245 306C236 311 228 312 220 312" +
  "C206 312 190 306 180 296C170 286 165 273 165 258V204C165 202 166 201 168 201Z";

export const STEM = "M220 312V401";

/** Bord supérieur du verre : redessiné au premier plan, il passe devant le nez comme sur le dessin. */
export const RIM = "M165 207V204C165 202 166 201 168 201H262C264 201 265 202 265 204V207";

/** Le vin au repos ; l'animation le fait basculer à l'intérieur de la coupe. */
export const WINE = "M100 259Q136 251 172 259T244 260T316 259V340H100Z";

/** Point de bascule du vin, au centre de la coupe. */
export const WINE_PIVOT = "214px 282px";
