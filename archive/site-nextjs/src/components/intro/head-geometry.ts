/*
 * Tête, lunettes et torse redessinés en vectoriel d'après le dessin (repère 474 × 474).
 * Courbes lisses et traits d'épaisseur constante, comme le bras (arm-geometry.ts).
 */

/** Torse et épaules (fond blanc), prolongés hors du cadre pour les écrans larges. */
export const TORSO_FILL =
  "M100 480L115 404C120 372 136 340 168 330L266 319C272 328 280 334 290 338C312 346 340 346 360 341" +
  "C384 334 398 322 401 307C440 309 466 311 480 313C560 320 690 362 790 490Z";

/** Bord gauche du torse et ligne d'épaule passant derrière la main. */
export const TORSO_EDGE = "M103 480L115 404C120 372 136 340 168 330L266 319";

/** Épaule droite : part du cou et file hors du cadre. */
export const SHOULDER = "M401 307C440 309 466 311 480 313C560 320 690 362 790 490";

/** Le visage et le crâne (fond blanc). */
export const HEAD_FILL =
  "M208.5 189C211 179 214 165 217 153C220 143 222 136 225 126C228 117 231 111 235 107" +
  "C245 88 262 76 288 71C305 68 330 67 355 73C370 78 382 92 390 108C396 120 400 132 401 145V307" +
  "C398 322 384 334 360 341C340 346 312 346 290 338C272 326 265 312 265 300C266 270 266 240 264 206L203 204Z";

/** Profil (front et arête du nez) puis crâne, jusqu'à la nuque. */
export const HEAD_OUTLINE =
  "M208.5 189C211 179 214 165 217 153C220 143 222 136 225 126C228 117 231 111 235 107" +
  "C245 88 262 76 288 71C305 68 330 67 355 73C370 78 382 92 390 108C396 120 400 132 401 145V307";

/** Bas du visage (caché par le verre au repos) puis mâchoire jusqu'au cou. */
export const FACE_JAW =
  "M264 206C266 240 266 280 265 300C265 312 272 326 290 338C312 346 340 346 360 341C384 334 398 322 401 307";

export const HAT_BRIM = "M161 122C190 121 230 120 272 120C320 120 360 122 396 123";

export const GLASSES_BAR = "M188 141C200 137 214 135 226 135L340 139L398 140C410 140 418 141 421 146C424 152 423 162 418 168";
export const LENS_LEFT = "M188 141C186 150 187 162 191 172C195 181 201 186 208 188";
export const LENS_MAIN = "M257 138C257 150 259 166 264 180C270 191 280 196 292 196C306 196 320 190 327 180C333 168 335 154 337 140";

/** Yeux fermés (le plaisir), et pupilles quand il les ouvre. */
export const EYES_CLOSED: ReadonlyArray<string> = [
  "M277 158C279 168 285 176 293 177C301 177 307 170 310 158",
  "M201 157C202 163 205 167 209 168",
];
export const PUPILS: ReadonlyArray<{ cx: number; cy: number; rx: number; ry: number }> = [
  { cx: 294, cy: 168, rx: 5, ry: 7 },
  { cx: 203, cy: 163, rx: 2.8, ry: 4.2 },
];

export const EAR = "M370 160C378 152 390 155 393 168C396 182 390 196 380 200C375 202 372 199 372 196";
export const SMILE = "M297 233C300 240 306 243 314 243C320 243 324 240 326 237";
export const CHIN = "M309 247C302 262 288 273 265 278";

/** La barbe de trois jours : petits tirets inclinés. */
export const STUBBLE: ReadonlyArray<readonly [number, number]> = [
  [366, 150], [365, 160], [366, 170], [357, 163], [356, 178], [349, 197], [363, 205],
  [298, 223], [312, 225], [323, 226], [335, 214], [344, 226], [353, 213], [350, 197],
  [367, 223], [358, 235], [349, 246], [338, 240], [356, 257], [344, 267], [334, 257],
  [333, 277], [323, 270], [322, 253], [312, 274], [321, 292], [307, 300], [298, 284],
  [290, 295], [278, 293], [271, 292], [294, 308], [283, 307], [274, 312], [290, 243],
  [281, 246], [272, 246], [287, 256], [276, 257],
];
