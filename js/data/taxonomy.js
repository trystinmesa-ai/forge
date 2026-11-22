// Reference vocabulary shared by the exercise library and the training engine.
// Keep ids stable: they are stored in your history and backups.

/** Muscle groups. `region` groups them for recovery and the "sore" check-in. */
export const MUSCLES = {
  chest:      { name: 'Chest',        region: 'chest',     size: 'large' },
  frontDelts: { name: 'Front delts',  region: 'shoulders', size: 'small' },
  sideDelts:  { name: 'Side delts',   region: 'shoulders', size: 'small' },
  rearDelts:  { name: 'Rear delts',   region: 'shoulders', size: 'small' },
  lats:       { name: 'Lats',         region: 'back',      size: 'large' },
  upperBack:  { name: 'Upper back',   region: 'back',      size: 'large' }, // traps, rhomboids
  lowerBack:  { name: 'Lower back',   region: 'lowerBack', size: 'medium' }, // erectors
  biceps:     { name: 'Biceps',       region: 'arms',      size: 'small' },
  triceps:    { name: 'Triceps',      region: 'arms',      size: 'small' },
  forearms:   { name: 'Forearms/grip', region: 'arms',     size: 'small' },
  quads:      { name: 'Quads',        region: 'legs',      size: 'large' },
  hamstrings: { name: 'Hamstrings',   region: 'legs',      size: 'large' },
  glutes:     { name: 'Glutes',       region: 'hips',      size: 'large' },
  adductors:  { name: 'Adductors',    region: 'hips',      size: 'medium' },
  calves:     { name: 'Calves',       region: 'legs',      size: 'small' },
  abs:        { name: 'Abs',          region: 'core',      size: 'medium' },
  obliques:   { name: 'Obliques',     region: 'core',      size: 'medium' },
};

/** Body areas you can report as sore, tight or painful. */
export const REGIONS = {
  chest:     { name: 'Chest' },
  shoulders: { name: 'Shoulders' },
  back:      { name: 'Upper back' },
  lowerBack: { name: 'Lower back' },
  arms:      { name: 'Arms' },
  core:      { name: 'Core' },
  hips:      { name: 'Hips & glutes' },
  legs:      { name: 'Legs' },
  knees:     { name: 'Knees' },   // joint areas: only used for pain/discomfort
  elbows:    { name: 'Elbows' },
  wrists:    { name: 'Wrists' },
  neck:      { name: 'Neck' },
};

/** Equipment. An exercise lists every item it needs (all of them must be available). */
export const EQUIPMENT = {
  barbell:    { name: 'Barbell' },          // includes plates
  rack:       { name: 'Squat rack' },
  bench:      { name: 'Bench' },
  dumbbell:   { name: 'Dumbbells' },
  kettlebell: { name: 'Kettlebells' },
  smith:      { name: 'Smith machine' },
  cable:      { name: 'Cable machine' },
  machine:    { name: 'Resistance machines' },
  band:       { name: 'Resistance bands' },
  pullupBar:  { name: 'Pull-up bar' },
  dipBars:    { name: 'Dip bars' },
  bodyweight: { name: 'Bodyweight' },       // always available
};

/** Starting equipment profiles. You can edit these and add your own in Settings. */
export const DEFAULT_PROFILES = [
  { id: 'gym', name: 'Full gym', equipment: Object.keys(EQUIPMENT) },
  { id: 'kb', name: 'Kettlebells only', equipment: ['kettlebell', 'bodyweight'] },
  { id: 'db', name: 'Dumbbells + bench', equipment: ['dumbbell', 'bench', 'bodyweight'] },
  { id: 'home', name: 'Bodyweight only', equipment: ['bodyweight'] },
];

/** Movement patterns: what substitutions must match, and what the engine balances. */
export const PATTERNS = {
  horizontalPush: { name: 'Horizontal push' },
  verticalPush:   { name: 'Vertical push' },
  horizontalPull: { name: 'Horizontal pull' },
  verticalPull:   { name: 'Vertical pull' },
  squat:          { name: 'Squat' },
  hinge:          { name: 'Hinge' },
  lunge:          { name: 'Lunge / single leg' },
  carry:          { name: 'Carry' },
  rotation:       { name: 'Rotation / anti-rotation' },
  antiExtension:  { name: 'Core: anti-extension' },
  flexion:        { name: 'Core: flexion' },
  elbowFlexion:   { name: 'Elbow flexion' },
  elbowExtension: { name: 'Elbow extension' },
  shoulderIso:    { name: 'Shoulder isolation' },
  legIso:         { name: 'Leg isolation' },
  ballistic:      { name: 'Ballistic (swings, cleans)' },
  getUp:          { name: 'Get-up / full body' },
  mobility:       { name: 'Mobility' },
};

/** What an exercise is for: drives rep ranges, failure proximity and time ordering. */
export const CATEGORIES = {
  compound:  { name: 'Main compound' },
  accessory: { name: 'Accessory' },
  isolation: { name: 'Isolation' },
  power:     { name: 'Power / ballistic' },
  core:      { name: 'Core' },
  carry:     { name: 'Carry' },
  mobility:  { name: 'Mobility' },
};

/** Standard kettlebell sizes in lb (16 kg = 35 lb, etc.). Editable in Settings. */
export const KB_SIZES_LB = [9, 13, 18, 26, 35, 44, 53, 62, 70, 80, 88, 97, 106];
