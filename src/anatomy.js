/**
 * Anatomical structure definitions mapped to MediaPipe Pose landmarks (33 points).
 * Each segment is drawn as a soft "muscle belly", bone shaft, ligament band or tendon cord
 * between two landmarks, with width relative to body scale.
 */

export const LM = {
  NOSE: 0,
  L_EYE_IN: 1, L_EYE: 2, L_EYE_OUT: 3,
  R_EYE_IN: 4, R_EYE: 5, R_EYE_OUT: 6,
  L_EAR: 7, R_EAR: 8,
  MOUTH_L: 9, MOUTH_R: 10,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13, R_ELBOW: 14,
  L_WRIST: 15, R_WRIST: 16,
  L_PINKY: 17, R_PINKY: 18,
  L_INDEX: 19, R_INDEX: 20,
  L_THUMB: 21, R_THUMB: 22,
  L_HIP: 23, R_HIP: 24,
  L_KNEE: 25, R_KNEE: 26,
  L_ANKLE: 27, R_ANKLE: 28,
  L_HEEL: 29, R_HEEL: 30,
  L_FOOT: 31, R_FOOT: 32,
};

/** Skeleton connections for the guide layer */
export const SKELETON = [
  [LM.L_SHOULDER, LM.R_SHOULDER],
  [LM.L_SHOULDER, LM.L_ELBOW],
  [LM.L_ELBOW, LM.L_WRIST],
  [LM.R_SHOULDER, LM.R_ELBOW],
  [LM.R_ELBOW, LM.R_WRIST],
  [LM.L_SHOULDER, LM.L_HIP],
  [LM.R_SHOULDER, LM.R_HIP],
  [LM.L_HIP, LM.R_HIP],
  [LM.L_HIP, LM.L_KNEE],
  [LM.L_KNEE, LM.L_ANKLE],
  [LM.R_HIP, LM.R_KNEE],
  [LM.R_KNEE, LM.R_ANKLE],
  [LM.L_ANKLE, LM.L_HEEL],
  [LM.L_ANKLE, LM.L_FOOT],
  [LM.R_ANKLE, LM.R_HEEL],
  [LM.R_ANKLE, LM.R_FOOT],
  [LM.L_WRIST, LM.L_INDEX],
  [LM.L_WRIST, LM.L_PINKY],
  [LM.L_WRIST, LM.L_THUMB],
  [LM.R_WRIST, LM.R_INDEX],
  [LM.R_WRIST, LM.R_PINKY],
  [LM.R_WRIST, LM.R_THUMB],
];

/**
 * Structure descriptor:
 *  a, b      - landmark indices
 *  w         - relative width (multiplied by bodyScale)
 *  label     - Spanish anatomical name
 *  bulge     - 0..1 muscle belly thickness at mid
 *  style     - 'fill' | 'band' | 'cord' | 'bone'
 */
export const STRUCTURES = {
  muscles: [
    // Torso
    { a: LM.L_SHOULDER, b: LM.R_SHOULDER, w: 0.22, bulge: 0.55, label: 'Trapecio', side: 'center' },
    { a: LM.L_SHOULDER, b: LM.L_HIP, w: 0.28, bulge: 0.7, label: 'Oblicuo izq.', side: 'L' },
    { a: LM.R_SHOULDER, b: LM.R_HIP, w: 0.28, bulge: 0.7, label: 'Oblicuo der.', side: 'R' },
    { a: LM.L_SHOULDER, b: LM.R_HIP, w: 0.18, bulge: 0.45, label: 'Recto abdominal', side: 'center' },
    { a: LM.R_SHOULDER, b: LM.L_HIP, w: 0.18, bulge: 0.45, label: 'Recto abdominal', side: 'center' },
    { a: LM.L_HIP, b: LM.R_HIP, w: 0.2, bulge: 0.4, label: 'Abdominales', side: 'center' },

    // Arms
    { a: LM.L_SHOULDER, b: LM.L_ELBOW, w: 0.2, bulge: 0.85, label: 'Bíceps / Deltoides izq.', side: 'L' },
    { a: LM.L_ELBOW, b: LM.L_WRIST, w: 0.14, bulge: 0.55, label: 'Antebrazo izq.', side: 'L' },
    { a: LM.R_SHOULDER, b: LM.R_ELBOW, w: 0.2, bulge: 0.85, label: 'Bíceps / Deltoides der.', side: 'R' },
    { a: LM.R_ELBOW, b: LM.R_WRIST, w: 0.14, bulge: 0.55, label: 'Antebrazo der.', side: 'R' },

    // Legs
    { a: LM.L_HIP, b: LM.L_KNEE, w: 0.26, bulge: 0.9, label: 'Cuádriceps izq.', side: 'L' },
    { a: LM.L_KNEE, b: LM.L_ANKLE, w: 0.16, bulge: 0.6, label: 'Gemelo izq.', side: 'L' },
    { a: LM.R_HIP, b: LM.R_KNEE, w: 0.26, bulge: 0.9, label: 'Cuádriceps der.', side: 'R' },
    { a: LM.R_KNEE, b: LM.R_ANKLE, w: 0.16, bulge: 0.6, label: 'Gemelo der.', side: 'R' },

    // Neck / shoulders
    { a: LM.L_SHOULDER, b: LM.NOSE, w: 0.1, bulge: 0.35, label: 'Esternocleidomastoideo', side: 'L' },
    { a: LM.R_SHOULDER, b: LM.NOSE, w: 0.1, bulge: 0.35, label: 'Esternocleidomastoideo', side: 'R' },
  ],

  bones: [
    // Spine (virtual midline)
    { a: LM.L_SHOULDER, b: LM.L_HIP, w: 0.06, bulge: 0.1, label: 'Columna (izq.)', side: 'center', style: 'bone' },
    { a: LM.R_SHOULDER, b: LM.R_HIP, w: 0.06, bulge: 0.1, label: 'Columna (der.)', side: 'center', style: 'bone' },

    // Clavicles / shoulders
    { a: LM.L_SHOULDER, b: LM.R_SHOULDER, w: 0.07, bulge: 0.05, label: 'Clavículas', side: 'center', style: 'bone' },

    // Arms
    { a: LM.L_SHOULDER, b: LM.L_ELBOW, w: 0.08, bulge: 0.08, label: 'Húmero izq.', side: 'L', style: 'bone' },
    { a: LM.L_ELBOW, b: LM.L_WRIST, w: 0.06, bulge: 0.05, label: 'Radio / Cúbito izq.', side: 'L', style: 'bone' },
    { a: LM.R_SHOULDER, b: LM.R_ELBOW, w: 0.08, bulge: 0.08, label: 'Húmero der.', side: 'R', style: 'bone' },
    { a: LM.R_ELBOW, b: LM.R_WRIST, w: 0.06, bulge: 0.05, label: 'Radio / Cúbito der.', side: 'R', style: 'bone' },

    // Pelvis
    { a: LM.L_HIP, b: LM.R_HIP, w: 0.1, bulge: 0.15, label: 'Pelvis', side: 'center', style: 'bone' },

    // Legs
    { a: LM.L_HIP, b: LM.L_KNEE, w: 0.1, bulge: 0.1, label: 'Fémur izq.', side: 'L', style: 'bone' },
    { a: LM.L_KNEE, b: LM.L_ANKLE, w: 0.08, bulge: 0.08, label: 'Tibia / Peroné izq.', side: 'L', style: 'bone' },
    { a: LM.R_HIP, b: LM.R_KNEE, w: 0.1, bulge: 0.1, label: 'Fémur der.', side: 'R', style: 'bone' },
    { a: LM.R_KNEE, b: LM.R_ANKLE, w: 0.08, bulge: 0.08, label: 'Tibia / Peroné der.', side: 'R', style: 'bone' },

    // Feet
    { a: LM.L_ANKLE, b: LM.L_FOOT, w: 0.06, bulge: 0.05, label: 'Pie izq.', side: 'L', style: 'bone' },
    { a: LM.R_ANKLE, b: LM.R_FOOT, w: 0.06, bulge: 0.05, label: 'Pie der.', side: 'R', style: 'bone' },

    // Hands
    { a: LM.L_WRIST, b: LM.L_INDEX, w: 0.04, bulge: 0.02, label: 'Mano izq.', side: 'L', style: 'bone' },
    { a: LM.R_WRIST, b: LM.R_INDEX, w: 0.04, bulge: 0.02, label: 'Mano der.', side: 'R', style: 'bone' },
  ],

  ligaments: [
    // Joint capsules / ligaments around major joints
    { a: LM.L_SHOULDER, b: LM.L_ELBOW, w: 0.05, bulge: 0.0, label: 'Lig. glenohumeral izq.', side: 'L', joint: LM.L_SHOULDER, style: 'band' },
    { a: LM.R_SHOULDER, b: LM.R_ELBOW, w: 0.05, bulge: 0.0, label: 'Lig. glenohumeral der.', side: 'R', joint: LM.R_SHOULDER, style: 'band' },
    { a: LM.L_ELBOW, b: LM.L_WRIST, w: 0.045, bulge: 0.0, label: 'Lig. colateral codo izq.', side: 'L', joint: LM.L_ELBOW, style: 'band' },
    { a: LM.R_ELBOW, b: LM.R_WRIST, w: 0.045, bulge: 0.0, label: 'Lig. colateral codo der.', side: 'R', joint: LM.R_ELBOW, style: 'band' },
    { a: LM.L_HIP, b: LM.L_KNEE, w: 0.06, bulge: 0.0, label: 'Lig. iliofemoral izq.', side: 'L', joint: LM.L_HIP, style: 'band' },
    { a: LM.R_HIP, b: LM.R_KNEE, w: 0.06, bulge: 0.0, label: 'Lig. iliofemoral der.', side: 'R', joint: LM.R_HIP, style: 'band' },
    { a: LM.L_KNEE, b: LM.L_ANKLE, w: 0.05, bulge: 0.0, label: 'Lig. cruzados / colaterales izq.', side: 'L', joint: LM.L_KNEE, style: 'band' },
    { a: LM.R_KNEE, b: LM.R_ANKLE, w: 0.05, bulge: 0.0, label: 'Lig. cruzados / colaterales der.', side: 'R', joint: LM.R_KNEE, style: 'band' },
    { a: LM.L_ANKLE, b: LM.L_FOOT, w: 0.04, bulge: 0.0, label: 'Lig. tobillo izq.', side: 'L', joint: LM.L_ANKLE, style: 'band' },
    { a: LM.R_ANKLE, b: LM.R_FOOT, w: 0.04, bulge: 0.0, label: 'Lig. tobillo der.', side: 'R', joint: LM.R_ANKLE, style: 'band' },
    { a: LM.L_HIP, b: LM.R_HIP, w: 0.05, bulge: 0.0, label: 'Lig. pélvicos', side: 'center', joint: null, style: 'band' },
    { a: LM.L_SHOULDER, b: LM.R_SHOULDER, w: 0.04, bulge: 0.0, label: 'Lig. acromioclaviculares', side: 'center', style: 'band' },
  ],

  tendons: [
    // Muscle-to-bone attachment cords near joints
    { a: LM.L_SHOULDER, b: LM.L_ELBOW, w: 0.035, bulge: 0.0, label: 'Tendón bíceps izq.', side: 'L', style: 'cord', offset: 0.18 },
    { a: LM.R_SHOULDER, b: LM.R_ELBOW, w: 0.035, bulge: 0.0, label: 'Tendón bíceps der.', side: 'R', style: 'cord', offset: 0.18 },
    { a: LM.L_ELBOW, b: LM.L_WRIST, w: 0.03, bulge: 0.0, label: 'Tendones flexores izq.', side: 'L', style: 'cord', offset: -0.12 },
    { a: LM.R_ELBOW, b: LM.R_WRIST, w: 0.03, bulge: 0.0, label: 'Tendones flexores der.', side: 'R', style: 'cord', offset: -0.12 },
    { a: LM.L_HIP, b: LM.L_KNEE, w: 0.04, bulge: 0.0, label: 'Tendón cuádriceps izq.', side: 'L', style: 'cord', offset: 0.1 },
    { a: LM.R_HIP, b: LM.R_KNEE, w: 0.04, bulge: 0.0, label: 'Tendón cuádriceps der.', side: 'R', style: 'cord', offset: 0.1 },
    { a: LM.L_KNEE, b: LM.L_ANKLE, w: 0.035, bulge: 0.0, label: 'Tendón de Aquiles izq.', side: 'L', style: 'cord', offset: -0.15 },
    { a: LM.R_KNEE, b: LM.R_ANKLE, w: 0.035, bulge: 0.0, label: 'Tendón de Aquiles der.', side: 'R', style: 'cord', offset: -0.15 },
    { a: LM.L_WRIST, b: LM.L_INDEX, w: 0.025, bulge: 0.0, label: 'Tendones extensores mano izq.', side: 'L', style: 'cord' },
    { a: LM.R_WRIST, b: LM.R_INDEX, w: 0.025, bulge: 0.0, label: 'Tendones extensores mano der.', side: 'R', style: 'cord' },
    { a: LM.L_ANKLE, b: LM.L_HEEL, w: 0.04, bulge: 0.0, label: 'Aquiles → calcáneo izq.', side: 'L', style: 'cord' },
    { a: LM.R_ANKLE, b: LM.R_HEEL, w: 0.04, bulge: 0.0, label: 'Aquiles → calcáneo der.', side: 'R', style: 'cord' },
  ],
};

export const LAYER_META = {
  muscles: {
    name: 'Músculos',
    color: '#ff6b6b',
    glow: '#ff3b3b',
    description:
      'Tejido contráctil que genera movimiento. Observa cómo se tensan hombros, brazos y piernas al moverte.',
  },
  bones: {
    name: 'Huesos',
    color: '#e8f0ff',
    glow: '#a5b4fc',
    description:
      'Andamiaje rígido del cuerpo. El esqueleto sostiene, protege órganos y sirve de palanca a los músculos.',
  },
  ligaments: {
    name: 'Ligamentos',
    color: '#fbbf24',
    glow: '#f59e0b',
    description:
      'Bandas fibrosas que unen hueso con hueso y estabilizan las articulaciones en cada movimiento.',
  },
  tendons: {
    name: 'Tendones',
    color: '#a78bfa',
    glow: '#8b5cf6',
    description:
      'Cuerdas densas que anclan el músculo al hueso y transmiten la fuerza de la contracción.',
  },
  all: {
    name: 'Todo',
    color: '#5eead4',
    glow: '#2dd4bf',
    description:
      'Vista completa: músculos, huesos, ligamentos y tendones superpuestos como un atlas vivo.',
  },
};

export function visible(lm, i, min = 0.45) {
  return lm && lm[i] && (lm[i].visibility ?? 1) >= min;
}

export function bodyScale(landmarks, w, h) {
  if (!landmarks) return Math.min(w, h) * 0.05;
  const ls = landmarks[LM.L_SHOULDER];
  const rs = landmarks[LM.R_SHOULDER];
  const lh = landmarks[LM.L_HIP];
  const rh = landmarks[LM.R_HIP];
  if (!ls || !rs) return Math.min(w, h) * 0.05;
  const shoulder = Math.hypot((ls.x - rs.x) * w, (ls.y - rs.y) * h);
  let torso = shoulder;
  if (lh && rh) {
    const midS = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
    const midH = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
    torso = Math.hypot((midS.x - midH.x) * w, (midS.y - midH.y) * h);
  }
  return Math.max(shoulder * 0.35, torso * 0.18, 12);
}

export function confidence(landmarks) {
  if (!landmarks?.length) return 0;
  const key = [
    LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP,
    LM.L_ELBOW, LM.R_ELBOW, LM.L_KNEE, LM.R_KNEE,
  ];
  let sum = 0;
  for (const i of key) sum += landmarks[i]?.visibility ?? 0;
  return sum / key.length;
}
