// The built-in exercise library.
//
// Fields (see docs/DATA.md):
//   id, name
//   cat       category (taxonomy CATEGORIES): sets the default prescription (programming.js)
//   pattern   movement pattern (taxonomy PATTERNS): substitutions must match it
//   load      how resistance is added: barbell | dumbbell | kettlebell | machine | cable | smith | band | bodyweight
//   eq        every piece of equipment required (all must be available)
//   primary / secondary  muscles (taxonomy MUSCLES)
//   diff      1 beginner-friendly · 2 intermediate · 3 technical
//   uni       one side at a time (reps are per side)
//   heavy     a heavy barbell lift: always uses conservative ranges, never max-rep sets
//   measure   'reps' (default) or 'time' (seconds)
//   stress    body areas it loads noticeably: skipped or swapped when you report pain there
//   alt       hand-picked alternatives (the app also finds same-pattern matches automatically)
//   cues      short technique cues, written for this app
//   area / warmup  (mobility) what it loosens, and which warm-ups it suits
//
// Technique cues are this app's own wording of standard coaching points (see NSCA Essentials).
// They are reminders, not a substitute for learning a lift in person.

const X = (id, name, cat, pattern, load, eq, primary, secondary = [], o = {}) => ({
  id, name, cat, pattern, load, eq, primary, secondary,
  diff: 1, uni: false, heavy: false, measure: 'reps', stress: [], alt: [], cues: [], ...o,
});

export const EXERCISES = [
  // ───────── Horizontal push ─────────
  X('bb-bench', 'Barbell bench press', 'compound', 'horizontalPush', 'barbell', ['barbell', 'bench', 'rack'], ['chest'], ['frontDelts', 'triceps'], {
    diff: 2, heavy: true, stress: ['shoulders', 'elbows', 'wrists'], alt: ['db-bench', 'smith-bench', 'machine-chest-press'],
    cues: ['Shoulder blades pinched back and down; keep them there', 'Feet planted, slight arch, butt on the bench', 'Lower to the lower chest with elbows about 45° from your sides', 'Press up and slightly back toward your face'],
  }),
  X('bb-incline-bench', 'Incline barbell bench press', 'compound', 'horizontalPush', 'barbell', ['barbell', 'bench', 'rack'], ['chest', 'frontDelts'], ['triceps'], {
    diff: 2, heavy: true, stress: ['shoulders', 'elbows'], alt: ['db-incline-bench', 'smith-incline-press'],
    cues: ['Bench at 30–45°', 'Shoulder blades back and down', 'Lower to the upper chest, just below the collarbone', 'Wrists stacked over elbows'],
  }),
  X('db-bench', 'Dumbbell bench press', 'compound', 'horizontalPush', 'dumbbell', ['dumbbell', 'bench'], ['chest'], ['frontDelts', 'triceps'], {
    stress: ['shoulders'], alt: ['bb-bench', 'machine-chest-press', 'push-up'],
    cues: ['Kick the dumbbells up off your knees as you lie back', 'Shoulder blades back, slight arch', 'Lower until you feel a stretch across the chest, elbows about 45°', 'Press up and slightly together without clanking'],
  }),
  X('db-incline-bench', 'Incline dumbbell press', 'compound', 'horizontalPush', 'dumbbell', ['dumbbell', 'bench'], ['chest', 'frontDelts'], ['triceps'], {
    stress: ['shoulders'], alt: ['bb-incline-bench', 'smith-incline-press'],
    cues: ['Bench at 30–45°', 'Lower to the upper chest with forearms vertical', 'Stretch at the bottom without losing shoulder position', 'Press up over the upper chest'],
  }),
  X('smith-bench', 'Smith machine bench press', 'compound', 'horizontalPush', 'smith', ['smith', 'bench'], ['chest'], ['frontDelts', 'triceps'], {
    stress: ['shoulders'], alt: ['bb-bench', 'db-bench'],
    cues: ['Set the bench so the bar touches your lower chest', 'Set the safety stops just above chest height', 'Shoulder blades back and down', 'Controlled down, strong press up'],
  }),
  X('smith-incline-press', 'Smith machine incline press', 'compound', 'horizontalPush', 'smith', ['smith', 'bench'], ['chest', 'frontDelts'], ['triceps'], {
    stress: ['shoulders'], alt: ['db-incline-bench', 'bb-incline-bench'],
    cues: ['Bench at 30–45°, positioned so the bar meets your upper chest', 'Set the safety stops', 'Elbows slightly tucked', 'Pause lightly at the chest, then press'],
  }),
  X('machine-chest-press', 'Machine chest press', 'accessory', 'horizontalPush', 'machine', ['machine'], ['chest'], ['frontDelts', 'triceps'], {
    alt: ['db-bench', 'smith-bench'],
    cues: ['Seat height so the handles line up with mid-chest', 'Back flat against the pad, shoulder blades back', 'Press without locking out hard', 'Slow return to a full stretch'],
  }),
  X('cable-fly', 'Cable fly', 'isolation', 'horizontalPush', 'cable', ['cable'], ['chest'], ['frontDelts'], {
    stress: ['shoulders'], alt: ['db-fly', 'pec-deck'],
    cues: ['Pulleys around shoulder height, staggered stance', 'Soft bend in the elbows, held constant', 'Hug a big tree: bring hands together in front of the chest', 'Let the arms open to a stretch without the shoulders rolling forward'],
  }),
  X('db-fly', 'Dumbbell fly', 'isolation', 'horizontalPush', 'dumbbell', ['dumbbell', 'bench'], ['chest'], ['frontDelts'], {
    stress: ['shoulders'], alt: ['cable-fly', 'pec-deck'],
    cues: ['Palms facing, slight elbow bend', 'Open the arms in a wide arc until the chest stretches', 'Stop before the shoulders feel strained', 'Squeeze the chest to bring the weights back up'],
  }),
  X('pec-deck', 'Pec deck (machine fly)', 'isolation', 'horizontalPush', 'machine', ['machine'], ['chest'], ['frontDelts'], {
    alt: ['cable-fly', 'db-fly'],
    cues: ['Handles at chest height', 'Chest up, shoulders back', 'Bring the handles together with a slow squeeze', 'Control the stretch on the way back'],
  }),
  X('push-up', 'Push-up', 'accessory', 'horizontalPush', 'bodyweight', ['bodyweight'], ['chest'], ['triceps', 'frontDelts', 'abs'], {
    stress: ['wrists', 'shoulders'], alt: ['db-bench', 'feet-elevated-push-up'],
    cues: ['Hands slightly wider than shoulders', 'Body in one straight line; squeeze glutes and abs', 'Lower until your chest nearly touches the floor', 'Elbows about 45° from your sides'],
  }),
  X('feet-elevated-push-up', 'Feet-elevated push-up', 'accessory', 'horizontalPush', 'bodyweight', ['bodyweight'], ['chest', 'frontDelts'], ['triceps', 'abs'], {
    diff: 2, stress: ['wrists', 'shoulders'], alt: ['push-up', 'db-incline-bench'],
    cues: ['Feet on a bench, step or chair', 'Keep the body straight; don’t let the hips sag', 'Lower your chest toward the floor between your hands', 'Press away hard at the top'],
  }),
  X('dip', 'Dip', 'compound', 'horizontalPush', 'bodyweight', ['dipBars'], ['chest', 'triceps'], ['frontDelts'], {
    diff: 2, stress: ['shoulders', 'elbows'], alt: ['db-bench', 'close-grip-bench'],
    cues: ['Lean slightly forward for more chest, upright for more triceps', 'Lower until upper arms are about parallel to the floor, or less if shoulders complain', 'Shoulders stay down, away from your ears', 'Press up to straight arms'],
  }),
  X('kb-floor-press', 'Kettlebell floor press', 'accessory', 'horizontalPush', 'kettlebell', ['kettlebell'], ['chest', 'triceps'], ['frontDelts'], {
    uni: true, alt: ['db-bench', 'push-up'],
    cues: ['Lie on the floor, knees bent, bell in the rack position on one side', 'Upper arm on the floor, about 45° from the body', 'Press straight up, wrist straight', 'Lower until the elbow touches the floor softly'],
  }),
  X('band-chest-press', 'Band chest press', 'accessory', 'horizontalPush', 'band', ['band'], ['chest'], ['triceps', 'frontDelts'], {
    alt: ['push-up', 'machine-chest-press'],
    cues: ['Anchor the band behind you at chest height', 'Staggered stance, slight forward lean', 'Press forward and together', 'Return slowly against the band'],
  }),

  // ───────── Vertical push ─────────
  X('bb-ohp', 'Standing barbell overhead press', 'compound', 'verticalPush', 'barbell', ['barbell', 'rack'], ['frontDelts'], ['sideDelts', 'triceps', 'upperBack', 'abs'], {
    diff: 2, heavy: true, stress: ['shoulders', 'lowerBack', 'wrists'], alt: ['db-shoulder-press', 'landmine-press', 'machine-shoulder-press'],
    cues: ['Grip just outside the shoulders, bar resting on the front delts', 'Squeeze glutes and brace, so you don’t lean back', 'Move your head back slightly and press the bar straight up', 'Finish with the bar over the middle of your feet, head through'],
  }),
  X('db-shoulder-press', 'Seated dumbbell shoulder press', 'compound', 'verticalPush', 'dumbbell', ['dumbbell', 'bench'], ['frontDelts'], ['sideDelts', 'triceps'], {
    stress: ['shoulders'], alt: ['bb-ohp', 'machine-shoulder-press'],
    cues: ['Bench upright or one notch back', 'Start with dumbbells at shoulder height, palms forward or slightly in', 'Press up and slightly in', 'Lower to about chin to ear level'],
  }),
  X('db-half-kneel-press', 'Half-kneeling single-arm dumbbell press', 'accessory', 'verticalPush', 'dumbbell', ['dumbbell'], ['frontDelts'], ['triceps', 'obliques', 'glutes'], {
    uni: true, diff: 2, stress: ['shoulders'], alt: ['kb-press', 'landmine-press'],
    cues: ['Kneel with the same-side knee down as the pressing arm', 'Squeeze the down-side glute; ribs down', 'Press straight up without leaning away', 'Lower under control to the shoulder'],
  }),
  X('kb-press', 'Single-arm kettlebell press', 'accessory', 'verticalPush', 'kettlebell', ['kettlebell'], ['frontDelts'], ['triceps', 'sideDelts', 'obliques'], {
    uni: true, diff: 2, stress: ['shoulders', 'wrists'], alt: ['db-half-kneel-press', 'db-shoulder-press'],
    cues: ['Start in the rack: bell resting on the forearm, wrist straight, elbow tucked', 'Squeeze glutes and the free fist', 'Press up, letting the bell rotate so the palm faces forward at the top', 'Pull it back down into the rack'],
  }),
  X('kb-push-press', 'Kettlebell push press', 'power', 'verticalPush', 'kettlebell', ['kettlebell'], ['frontDelts', 'triceps'], ['quads', 'glutes'], {
    uni: true, diff: 2, stress: ['shoulders'], alt: ['kb-press'],
    cues: ['From the rack, dip a few inches by bending the knees, torso upright', 'Drive up through the legs and use that momentum to press', 'Lock out overhead with the biceps by the ear', 'Lower under control back to the rack'],
  }),
  X('landmine-press', 'Landmine press', 'accessory', 'verticalPush', 'barbell', ['barbell'], ['frontDelts', 'chest'], ['triceps', 'obliques'], {
    uni: true, alt: ['db-half-kneel-press', 'kb-press'],
    cues: ['One end of the bar in a corner or landmine; hold the other end at the shoulder', 'Staggered stance, slight forward lean', 'Press up and forward until the arm is straight', 'Shoulder-friendly: good when straight overhead pressing hurts'],
  }),
  X('machine-shoulder-press', 'Machine shoulder press', 'accessory', 'verticalPush', 'machine', ['machine'], ['frontDelts'], ['sideDelts', 'triceps'], {
    alt: ['db-shoulder-press', 'bb-ohp'],
    cues: ['Handles start at about shoulder height', 'Back against the pad', 'Press up without shrugging', 'Slow return'],
  }),
  X('pike-push-up', 'Pike push-up', 'accessory', 'verticalPush', 'bodyweight', ['bodyweight'], ['frontDelts'], ['triceps', 'upperBack'], {
    diff: 2, stress: ['shoulders', 'wrists'], alt: ['db-shoulder-press', 'kb-press'],
    cues: ['Hips high so your body makes an upside-down V', 'Lower the top of your head toward the floor in front of your hands', 'Elbows track back, not flared out', 'Press back up to the V'],
  }),

  // ───────── Shoulder isolation ─────────
  X('db-lateral-raise', 'Dumbbell lateral raise', 'isolation', 'shoulderIso', 'dumbbell', ['dumbbell'], ['sideDelts'], [], {
    alt: ['cable-lateral-raise'],
    cues: ['Slight forward lean, soft elbows', 'Raise the arms out to the sides to shoulder height', 'Lead with the elbows; don’t shrug', 'Lower slowly, no swinging'],
  }),
  X('cable-lateral-raise', 'Cable lateral raise', 'isolation', 'shoulderIso', 'cable', ['cable'], ['sideDelts'], [], {
    uni: true, alt: ['db-lateral-raise'],
    cues: ['Pulley at the lowest setting; handle in the far hand', 'Raise out to the side to shoulder height', 'Keep tension at the bottom, not resting', 'Slow lower'],
  }),
  X('band-lateral-raise', 'Band lateral raise', 'isolation', 'shoulderIso', 'band', ['band'], ['sideDelts'], [], {
    alt: ['db-lateral-raise'],
    cues: ['Stand on the band, ends in each hand', 'Raise out to the sides to shoulder height', 'Lead with the elbows', 'Control the return'],
  }),
  X('band-pull-apart', 'Band pull-apart', 'isolation', 'shoulderIso', 'band', ['band'], ['rearDelts', 'upperBack'], [], {
    alt: ['face-pull', 'rear-delt-fly'],
    cues: ['Arms straight in front at shoulder height, band taut', 'Pull the band apart until it touches your chest', 'Squeeze the shoulder blades together', 'Return slowly'],
  }),
  X('face-pull', 'Face pull', 'isolation', 'shoulderIso', 'cable', ['cable'], ['rearDelts', 'upperBack'], [], {
    alt: ['band-pull-apart', 'rear-delt-fly'],
    cues: ['Rope at upper-chest to face height', 'Pull toward your forehead, hands finishing beside your ears', 'Elbows high and wide; thumbs point back at the end', 'Pause, then return slowly'],
  }),
  X('rear-delt-fly', 'Bent-over rear delt fly', 'isolation', 'shoulderIso', 'dumbbell', ['dumbbell'], ['rearDelts'], ['upperBack'], {
    alt: ['face-pull', 'reverse-pec-deck', 'band-pull-apart'],
    cues: ['Hinge forward with a flat back, or lie chest-down on an incline bench', 'Soft elbows; raise the arms out wide', 'Think “arms out”, not “squeeze the shoulder blades”', 'Light weight, slow lower'],
  }),
  X('reverse-pec-deck', 'Reverse pec deck', 'isolation', 'shoulderIso', 'machine', ['machine'], ['rearDelts'], ['upperBack'], {
    alt: ['rear-delt-fly', 'face-pull'],
    cues: ['Face the pad; handles at shoulder height', 'Sweep the arms back in a wide arc', 'Pause briefly, then return slowly'],
  }),
  X('db-shrug', 'Dumbbell shrug', 'isolation', 'shoulderIso', 'dumbbell', ['dumbbell'], ['upperBack'], ['forearms'], {
    alt: ['farmer-carry-db'],
    cues: ['Stand tall, dumbbells at your sides', 'Shrug straight up toward the ears', 'Pause at the top', 'Lower fully; no rolling'],
  }),

  // ───────── Vertical pull ─────────
  X('pull-up', 'Pull-up', 'compound', 'verticalPull', 'bodyweight', ['pullupBar'], ['lats'], ['biceps', 'upperBack', 'forearms'], {
    diff: 2, stress: ['shoulders', 'elbows'], alt: ['lat-pulldown', 'band-pull-up', 'chin-up'],
    cues: ['Overhand grip, slightly wider than the shoulders', 'Start from a full hang, then pull the shoulders down first', 'Drive the elbows down toward your back pockets', 'Chin over the bar, then lower all the way'],
  }),
  X('chin-up', 'Chin-up', 'compound', 'verticalPull', 'bodyweight', ['pullupBar'], ['lats', 'biceps'], ['upperBack', 'forearms'], {
    diff: 2, stress: ['elbows'], alt: ['pull-up', 'lat-pulldown'],
    cues: ['Underhand grip, shoulder width', 'Pull your chest toward the bar', 'Keep the ribs down; avoid kicking', 'Lower to straight arms'],
  }),
  X('band-pull-up', 'Band-assisted pull-up', 'compound', 'verticalPull', 'bodyweight', ['pullupBar', 'band'], ['lats'], ['biceps', 'upperBack'], {
    alt: ['pull-up', 'lat-pulldown'],
    cues: ['Loop the band over the bar; put a knee or foot in it', 'Same technique as a pull-up', 'Use a lighter band as you get stronger'],
  }),
  X('lat-pulldown', 'Lat pulldown', 'compound', 'verticalPull', 'cable', ['cable'], ['lats'], ['biceps', 'upperBack'], {
    alt: ['pull-up', 'band-pull-up', 'single-arm-pulldown'],
    cues: ['Thighs locked under the pad, grip a little wider than the shoulders', 'Lean back slightly; chest up', 'Pull the bar to the upper chest, elbows down and back', 'Let the arms go fully straight at the top'],
  }),
  X('single-arm-pulldown', 'Single-arm cable pulldown', 'accessory', 'verticalPull', 'cable', ['cable'], ['lats'], ['biceps'], {
    uni: true, alt: ['lat-pulldown'],
    cues: ['Kneel or sit facing a high pulley', 'Pull the elbow down to your side', 'Feel the stretch overhead at the top'],
  }),
  X('straight-arm-pulldown', 'Straight-arm pulldown', 'isolation', 'verticalPull', 'cable', ['cable'], ['lats'], ['triceps'], {
    alt: ['db-pullover'],
    cues: ['High pulley, bar or rope, slight hip hinge', 'Arms nearly straight', 'Sweep the bar down to your thighs using the lats', 'Slow return to overhead stretch'],
  }),
  X('db-pullover', 'Dumbbell pullover', 'isolation', 'verticalPull', 'dumbbell', ['dumbbell', 'bench'], ['lats'], ['chest', 'triceps'], {
    stress: ['shoulders'], alt: ['straight-arm-pulldown'],
    cues: ['Lie across or along a bench, one dumbbell held over the chest', 'Soft elbows; lower behind your head until you feel a stretch', 'Pull back over the chest'],
  }),

  // ───────── Horizontal pull ─────────
  X('bb-row', 'Barbell bent-over row', 'compound', 'horizontalPull', 'barbell', ['barbell'], ['upperBack', 'lats'], ['rearDelts', 'biceps', 'lowerBack'], {
    diff: 2, heavy: true, stress: ['lowerBack'], alt: ['chest-supported-db-row', 'seated-cable-row', 'db-row'],
    cues: ['Hinge to about 45°, flat back, knees soft', 'Pull the bar to your lower ribs', 'Elbows drive back; squeeze the shoulder blades', 'Torso stays still; no heaving'],
  }),
  X('db-row', 'One-arm dumbbell row', 'compound', 'horizontalPull', 'dumbbell', ['dumbbell', 'bench'], ['lats', 'upperBack'], ['biceps', 'rearDelts'], {
    uni: true, alt: ['seated-cable-row', 'kb-row', 'chest-supported-db-row'],
    cues: ['Hand and knee on the bench, back flat', 'Pull the dumbbell toward your hip', 'Let the shoulder stretch forward at the bottom', 'No twisting the torso'],
  }),
  X('chest-supported-db-row', 'Chest-supported dumbbell row', 'compound', 'horizontalPull', 'dumbbell', ['dumbbell', 'bench'], ['upperBack', 'lats'], ['rearDelts', 'biceps'], {
    alt: ['db-row', 'machine-row'],
    cues: ['Lie chest-down on an incline bench', 'Row both dumbbells, elbows about 45° out', 'Squeeze the shoulder blades at the top', 'Gentle on the lower back'],
  }),
  X('seated-cable-row', 'Seated cable row', 'compound', 'horizontalPull', 'cable', ['cable'], ['upperBack', 'lats'], ['biceps', 'rearDelts'], {
    alt: ['machine-row', 'db-row', 'bb-row'],
    cues: ['Sit tall, slight knee bend', 'Pull the handle to your stomach', 'Shoulders down and back at the finish', 'Reach forward for a stretch without rounding hard'],
  }),
  X('machine-row', 'Chest-supported machine row', 'compound', 'horizontalPull', 'machine', ['machine'], ['upperBack', 'lats'], ['biceps', 'rearDelts'], {
    alt: ['seated-cable-row', 'chest-supported-db-row'],
    cues: ['Chest against the pad', 'Pull the handles back, elbows close or wide', 'Pause and squeeze', 'Slow return'],
  }),
  X('inverted-row', 'Inverted row', 'accessory', 'horizontalPull', 'bodyweight', ['barbell', 'rack'], ['upperBack', 'lats'], ['biceps', 'rearDelts', 'abs'], {
    alt: ['seated-cable-row', 'band-row'],
    cues: ['Bar set at about hip height in a rack (or use a Smith machine)', 'Hang underneath with a straight body, heels on the floor', 'Pull your chest to the bar', 'Bend the knees to make it easier'],
  }),
  X('kb-row', 'Single-arm kettlebell row', 'accessory', 'horizontalPull', 'kettlebell', ['kettlebell'], ['lats', 'upperBack'], ['biceps', 'rearDelts'], {
    uni: true, alt: ['db-row', 'kb-gorilla-row'],
    cues: ['Staggered stance, free hand on your front thigh, flat back', 'Row the bell toward your hip', 'Elbow brushes past the ribs', 'Lower to a full stretch'],
  }),
  X('kb-gorilla-row', 'Kettlebell gorilla row', 'compound', 'horizontalPull', 'kettlebell', ['kettlebell'], ['lats', 'upperBack'], ['biceps', 'obliques', 'hamstrings'], {
    diff: 2, alt: ['kb-row', 'bb-row'],
    cues: ['Two bells between wide feet, hinge to a flat back', 'Row one bell while pushing the other into the floor', 'Alternate sides; hips stay square', 'Reps are per side'],
  }),
  X('band-row', 'Band row', 'accessory', 'horizontalPull', 'band', ['band'], ['upperBack', 'lats'], ['biceps', 'rearDelts'], {
    alt: ['seated-cable-row', 'inverted-row'],
    cues: ['Anchor the band at chest height or loop it round your feet', 'Sit or stand tall', 'Pull the hands to your ribs and squeeze', 'Return slowly'],
  }),

  // ───────── Squat ─────────
  X('bb-back-squat', 'Barbell back squat', 'compound', 'squat', 'barbell', ['barbell', 'rack'], ['quads', 'glutes'], ['adductors', 'lowerBack', 'abs'], {
    diff: 2, heavy: true, stress: ['knees', 'lowerBack', 'hips'], alt: ['smith-squat', 'leg-press', 'hack-squat', 'db-goblet-squat'],
    cues: ['Bar on the upper back, hands just outside shoulders', 'Big breath and brace before each rep', 'Sit down between your hips; knees follow your toes', 'Go as deep as you can with a neutral back, then drive up'],
  }),
  X('bb-front-squat', 'Barbell front squat', 'compound', 'squat', 'barbell', ['barbell', 'rack'], ['quads'], ['glutes', 'upperBack', 'abs'], {
    diff: 3, heavy: true, stress: ['knees', 'wrists'], alt: ['bb-back-squat', 'kb-front-squat', 'hack-squat'],
    cues: ['Bar on the front of the shoulders, elbows high', 'Stay upright; think “elbows up” out of the bottom', 'Squat deep between the hips', 'Cross-arm grip is fine if wrists are tight'],
  }),
  X('db-goblet-squat', 'Dumbbell goblet squat', 'accessory', 'squat', 'dumbbell', ['dumbbell'], ['quads', 'glutes'], ['adductors', 'abs'], {
    stress: ['knees'], alt: ['kb-goblet-squat', 'leg-press'],
    cues: ['Hold one end of a dumbbell at your chest', 'Feet a bit wider than hips, toes slightly out', 'Sit down between the heels, elbows inside the knees', 'Chest up, drive through the whole foot'],
  }),
  X('kb-goblet-squat', 'Kettlebell goblet squat', 'accessory', 'squat', 'kettlebell', ['kettlebell'], ['quads', 'glutes'], ['adductors', 'abs'], {
    stress: ['knees'], alt: ['db-goblet-squat', 'kb-front-squat'],
    cues: ['Hold the bell by the horns at your chest', 'Sit straight down between your heels', 'Use your elbows to nudge the knees out at the bottom', 'Stand tall and squeeze the glutes'],
  }),
  X('kb-front-squat', 'Double kettlebell front squat', 'compound', 'squat', 'kettlebell', ['kettlebell'], ['quads', 'glutes'], ['abs', 'upperBack'], {
    diff: 2, stress: ['knees'], alt: ['kb-goblet-squat', 'bb-front-squat'],
    cues: ['Two bells in the rack position, elbows tucked', 'Brace hard; the bells try to pull you forward', 'Squat deep with an upright torso', 'Drive up through mid-foot'],
  }),
  X('smith-squat', 'Smith machine squat', 'compound', 'squat', 'smith', ['smith'], ['quads', 'glutes'], ['adductors'], {
    stress: ['knees'], alt: ['bb-back-squat', 'hack-squat', 'leg-press'],
    cues: ['Feet slightly in front of the bar', 'Set the safety stops just below your bottom position', 'Sit down and back, knees tracking the toes', 'Drive up through the whole foot'],
  }),
  X('hack-squat', 'Hack squat (machine)', 'compound', 'squat', 'machine', ['machine'], ['quads'], ['glutes', 'adductors'], {
    stress: ['knees'], alt: ['leg-press', 'smith-squat'],
    cues: ['Back flat on the pad, feet shoulder width mid-platform', 'Lower as deep as you can control', 'Don’t let the heels lift', 'Press up without locking the knees hard'],
  }),
  X('leg-press', 'Leg press', 'compound', 'squat', 'machine', ['machine'], ['quads', 'glutes'], ['adductors', 'hamstrings'], {
    stress: ['knees'], alt: ['hack-squat', 'bb-back-squat', 'db-goblet-squat'],
    cues: ['Feet shoulder width, middle of the platform', 'Lower until your lower back just starts to lift off the pad, then stop', 'Knees track over the toes', 'Press without slamming into lockout'],
  }),
  X('bw-squat', 'Bodyweight squat', 'accessory', 'squat', 'bodyweight', ['bodyweight'], ['quads', 'glutes'], ['adductors'], {
    alt: ['kb-goblet-squat', 'bw-split-squat'],
    cues: ['Arms forward for balance', 'Sit deep between your heels', 'Slow 3-second lowering makes it harder', 'Stand tall at the top'],
  }),
  X('leg-extension', 'Leg extension', 'isolation', 'legIso', 'machine', ['machine'], ['quads'], [], {
    stress: ['knees'], alt: ['bw-split-squat'],
    cues: ['Knee lined up with the machine’s pivot', 'Extend until the legs are straight; squeeze', 'Lower slowly', 'Good with high reps'],
  }),

  // ───────── Hinge ─────────
  X('bb-deadlift', 'Barbell deadlift', 'compound', 'hinge', 'barbell', ['barbell'], ['glutes', 'hamstrings', 'lowerBack'], ['upperBack', 'quads', 'forearms'], {
    diff: 3, heavy: true, stress: ['lowerBack', 'hips'], reps: [3, 6], rir: [2, 3], restSec: 180,
    alt: ['bb-rdl', 'kb-deadlift', 'db-rdl'],
    cues: ['Bar over mid-foot, shins touching it when you grip', 'Pull the slack out: chest up, lats tight, back flat', 'Push the floor away; bar stays against your legs', 'Stand tall without leaning back; lower the same way'],
  }),
  X('bb-rdl', 'Barbell Romanian deadlift', 'compound', 'hinge', 'barbell', ['barbell'], ['hamstrings', 'glutes'], ['lowerBack', 'forearms'], {
    diff: 2, heavy: true, stress: ['lowerBack'], alt: ['db-rdl', 'kb-deadlift', 'smith-rdl'],
    cues: ['Start standing; soft knees', 'Push the hips back; the bar slides down your thighs', 'Stop when your hamstrings are fully stretched and your back is still flat', 'Drive the hips forward to stand'],
  }),
  X('smith-rdl', 'Smith machine Romanian deadlift', 'compound', 'hinge', 'smith', ['smith'], ['hamstrings', 'glutes'], ['lowerBack'], {
    stress: ['lowerBack'], alt: ['bb-rdl', 'db-rdl'],
    cues: ['Stand close to the bar; feet hip width', 'Hips back, bar tracks down the thighs', 'Stop at a deep hamstring stretch with a flat back', 'Hips through to stand'],
  }),
  X('db-rdl', 'Dumbbell Romanian deadlift', 'compound', 'hinge', 'dumbbell', ['dumbbell'], ['hamstrings', 'glutes'], ['lowerBack', 'forearms'], {
    stress: ['lowerBack'], alt: ['bb-rdl', 'kb-deadlift'],
    cues: ['Dumbbells in front of the thighs', 'Hips back, soft knees, flat back', 'Lower to mid-shin or until the stretch stops you', 'Squeeze the glutes to stand'],
  }),
  X('kb-deadlift', 'Kettlebell deadlift', 'accessory', 'hinge', 'kettlebell', ['kettlebell'], ['glutes', 'hamstrings'], ['lowerBack', 'quads', 'forearms'], {
    stress: ['lowerBack'], alt: ['db-rdl', 'kb-single-leg-deadlift'],
    cues: ['Bell between your feet, lined up with the ankles', 'Hips back, grab the handle, flat back', 'Stand up by driving the hips forward', 'Learn this before swings'],
  }),
  X('hip-thrust', 'Barbell hip thrust', 'accessory', 'hinge', 'barbell', ['barbell', 'bench'], ['glutes'], ['hamstrings'], {
    alt: ['glute-bridge', 'cable-pull-through'],
    cues: ['Upper back on the bench edge, bar over the hips (use a pad)', 'Feet flat, shins vertical at the top', 'Drive the hips up until the body is flat from shoulders to knees', 'Chin tucked, ribs down; pause at the top'],
  }),
  X('glute-bridge', 'Glute bridge', 'accessory', 'hinge', 'bodyweight', ['bodyweight'], ['glutes'], ['hamstrings'], {
    alt: ['hip-thrust', 'sl-glute-bridge'],
    cues: ['Lie on your back, knees bent, feet flat', 'Drive through the heels and lift the hips', 'Squeeze the glutes hard at the top; don’t arch the low back', 'Lower slowly'],
  }),
  X('sl-glute-bridge', 'Single-leg glute bridge', 'accessory', 'hinge', 'bodyweight', ['bodyweight'], ['glutes'], ['hamstrings', 'obliques'], {
    uni: true, alt: ['glute-bridge', 'hip-thrust'],
    cues: ['One foot planted, the other leg straight or knee hugged', 'Push the hips up evenly; don’t let one side drop', 'Pause at the top'],
  }),
  X('cable-pull-through', 'Cable pull-through', 'accessory', 'hinge', 'cable', ['cable'], ['glutes', 'hamstrings'], [], {
    alt: ['kb-swing', 'hip-thrust', 'db-rdl'],
    cues: ['Face away from a low pulley, rope between your legs', 'Hinge back, letting the rope pull your hands through', 'Snap the hips forward to stand', 'Arms just hold on; hips do the work'],
  }),
  X('db-sl-rdl', 'Single-leg dumbbell Romanian deadlift', 'accessory', 'hinge', 'dumbbell', ['dumbbell'], ['hamstrings', 'glutes'], ['obliques', 'forearms'], {
    uni: true, diff: 2, alt: ['kb-single-leg-deadlift', 'db-rdl'],
    cues: ['Dumbbell in the hand opposite the standing leg', 'Hinge forward as the free leg reaches back, hips square', 'Lower until the stretch stops you', 'Use a wall for balance if needed'],
  }),
  X('kb-single-leg-deadlift', 'Single-leg kettlebell deadlift', 'accessory', 'hinge', 'kettlebell', ['kettlebell'], ['hamstrings', 'glutes'], ['obliques'], {
    uni: true, diff: 2, alt: ['db-sl-rdl', 'kb-deadlift'],
    cues: ['Bell in the hand opposite the standing leg', 'Hinge as the free leg extends back', 'Keep the hips level; toes of the back leg point down', 'Stand by squeezing the standing-side glute'],
  }),
  X('back-extension', '45° back extension', 'accessory', 'hinge', 'bodyweight', ['machine'], ['glutes', 'lowerBack'], ['hamstrings'], {
    alt: ['bb-rdl', 'glute-bridge'],
    cues: ['Pad just below the hip crease', 'Lower with a flat back until you feel the hamstrings', 'Rise until the body is straight; don’t hyperextend', 'Hold a plate to make it harder'],
  }),
  X('leg-curl', 'Leg curl (machine)', 'isolation', 'legIso', 'machine', ['machine'], ['hamstrings'], ['calves'], {
    alt: ['db-rdl', 'sl-glute-bridge'],
    cues: ['Knees lined up with the pivot', 'Curl fully; squeeze', 'Lower slowly for the full stretch', 'Seated or lying both work'],
  }),

  // ───────── Ballistic (kettlebell) ─────────
  X('kb-swing', 'Kettlebell swing', 'power', 'ballistic', 'kettlebell', ['kettlebell'], ['glutes', 'hamstrings'], ['lowerBack', 'upperBack', 'abs', 'forearms'], {
    diff: 2, stress: ['lowerBack'], reps: [10, 15], alt: ['kb-swing-1arm', 'cable-pull-through'],
    cues: ['It’s a hinge, not a squat: hips back, shins nearly vertical', 'Hike the bell back high between the thighs', 'Snap the hips forward; the bell floats to chest height', 'Stand tall and brace at the top; arms are just ropes'],
  }),
  X('kb-swing-1arm', 'Single-arm kettlebell swing', 'power', 'ballistic', 'kettlebell', ['kettlebell'], ['glutes', 'hamstrings'], ['obliques', 'upperBack', 'forearms'], {
    uni: true, diff: 2, stress: ['lowerBack'], reps: [8, 12], alt: ['kb-swing'],
    cues: ['Same hinge as the two-hand swing', 'Resist the twist: shoulders stay square', 'Free arm moves with you or stays by your side', 'Reps per side'],
  }),
  X('kb-clean', 'Kettlebell clean', 'power', 'ballistic', 'kettlebell', ['kettlebell'], ['glutes', 'hamstrings'], ['upperBack', 'forearms', 'abs'], {
    uni: true, diff: 2, reps: [5, 8], alt: ['kb-swing-1arm'],
    cues: ['Start like a one-arm swing', 'Keep the bell close; elbow stays near the ribs', 'Punch the hand through so the bell lands softly on the forearm in the rack', 'If it bangs your wrist, it’s swinging too wide'],
  }),
  X('kb-snatch', 'Kettlebell snatch', 'power', 'ballistic', 'kettlebell', ['kettlebell'], ['glutes', 'hamstrings', 'upperBack'], ['frontDelts', 'forearms', 'abs'], {
    uni: true, diff: 3, stress: ['shoulders', 'lowerBack'], reps: [5, 8], alt: ['kb-swing-1arm', 'kb-clean'],
    cues: ['Hinge and hike like a swing', 'Hips drive the bell up; pull it close to the body', 'Punch through at the top so the bell lands gently behind the wrist', 'Learn swings and cleans first'],
  }),

  // ───────── Lunge / single leg ─────────
  X('db-bss', 'Dumbbell Bulgarian split squat', 'compound', 'lunge', 'dumbbell', ['dumbbell', 'bench'], ['quads', 'glutes'], ['adductors', 'hamstrings'], {
    uni: true, diff: 2, stress: ['knees'], alt: ['bw-split-squat', 'db-reverse-lunge', 'kb-bss'],
    cues: ['Back foot laces-down on a bench, front foot about a stride ahead', 'Drop the back knee straight down', 'Lean slightly forward for more glutes, upright for more quads', 'Drive through the front heel'],
  }),
  X('kb-bss', 'Kettlebell Bulgarian split squat', 'compound', 'lunge', 'kettlebell', ['kettlebell'], ['quads', 'glutes'], ['adductors'], {
    uni: true, diff: 2, stress: ['knees'], alt: ['db-bss', 'kb-goblet-reverse-lunge'],
    cues: ['Bell held goblet-style or at your side', 'Back foot on a bench, box or step', 'Lower straight down under control', 'Front knee tracks over the toes'],
  }),
  X('bw-split-squat', 'Bodyweight Bulgarian split squat', 'accessory', 'lunge', 'bodyweight', ['bodyweight'], ['quads', 'glutes'], ['adductors'], {
    uni: true, stress: ['knees'], alt: ['db-bss', 'bw-reverse-lunge'],
    cues: ['Back foot on a sturdy chair, step or couch', 'Slow 3-second lowering to make it hard enough', 'Back knee nearly touches the floor', 'Push up through the front foot'],
  }),
  X('db-reverse-lunge', 'Dumbbell reverse lunge', 'accessory', 'lunge', 'dumbbell', ['dumbbell'], ['quads', 'glutes'], ['adductors', 'hamstrings'], {
    uni: true, stress: ['knees'], alt: ['db-walking-lunge', 'db-bss', 'kb-goblet-reverse-lunge'],
    cues: ['Step back into a lunge', 'Both knees bend to about 90°', 'Front foot flat; push through it to return', 'Easier on the knees than forward lunges'],
  }),
  X('db-walking-lunge', 'Dumbbell walking lunge', 'accessory', 'lunge', 'dumbbell', ['dumbbell'], ['quads', 'glutes'], ['adductors', 'calves'], {
    uni: true, diff: 2, stress: ['knees'], alt: ['db-reverse-lunge'],
    cues: ['Long, controlled steps', 'Back knee drops toward the floor', 'Torso tall; push through the front foot into the next step', 'Count reps per leg'],
  }),
  X('kb-goblet-reverse-lunge', 'Kettlebell goblet reverse lunge', 'accessory', 'lunge', 'kettlebell', ['kettlebell'], ['quads', 'glutes'], ['abs', 'adductors'], {
    uni: true, stress: ['knees'], alt: ['db-reverse-lunge', 'kb-bss'],
    cues: ['Bell at the chest, held by the horns', 'Step back and lower the back knee', 'Stay tall; brace against the bell', 'Drive through the front foot'],
  }),
  X('bw-reverse-lunge', 'Bodyweight reverse lunge', 'accessory', 'lunge', 'bodyweight', ['bodyweight'], ['quads', 'glutes'], ['adductors'], {
    uni: true, alt: ['db-reverse-lunge', 'bw-split-squat'],
    cues: ['Step back, lower under control', 'Front knee over the mid-foot', 'Push back to standing'],
  }),
  X('db-step-up', 'Dumbbell step-up', 'accessory', 'lunge', 'dumbbell', ['dumbbell', 'bench'], ['quads', 'glutes'], ['calves'], {
    uni: true, alt: ['db-reverse-lunge', 'db-bss'],
    cues: ['Box or bench around knee height', 'Whole foot on the box', 'Drive up with the top leg; minimal push from the bottom foot', 'Step down slowly'],
  }),
  X('kb-lateral-lunge', 'Kettlebell goblet lateral lunge', 'accessory', 'lunge', 'kettlebell', ['kettlebell'], ['adductors', 'glutes', 'quads'], [], {
    uni: true, diff: 2, stress: ['knees'], alt: ['cossack-squat'],
    cues: ['Wide stance, bell at your chest', 'Shift to one side, sitting the hips back; other leg straight', 'Both feet flat', 'Push back to center'],
  }),

  // ───────── Calves ─────────
  X('standing-calf-raise', 'Standing calf raise (machine)', 'isolation', 'legIso', 'machine', ['machine'], ['calves'], [], {
    alt: ['db-calf-raise', 'seated-calf-raise'],
    cues: ['Balls of the feet on the edge', 'Drop the heels for a full stretch and pause', 'Rise as high as possible', 'No bouncing'],
  }),
  X('seated-calf-raise', 'Seated calf raise', 'isolation', 'legIso', 'machine', ['machine'], ['calves'], [], {
    alt: ['standing-calf-raise'],
    cues: ['Pad on the lower thighs', 'Full stretch at the bottom, pause', 'Rise high and squeeze'],
  }),
  X('db-calf-raise', 'Single-leg dumbbell calf raise', 'isolation', 'legIso', 'dumbbell', ['dumbbell'], ['calves'], [], {
    uni: true, alt: ['standing-calf-raise', 'bw-calf-raise'],
    cues: ['Stand on a step, dumbbell in one hand, other hand on a wall', 'Lower the heel below the step', 'Rise all the way up; pause'],
  }),
  X('bw-calf-raise', 'Single-leg calf raise', 'isolation', 'legIso', 'bodyweight', ['bodyweight'], ['calves'], [], {
    uni: true, alt: ['db-calf-raise'],
    cues: ['On a step if you have one', 'Full range, slow lowering', 'Hold a wall for balance'],
  }),

  // ───────── Biceps ─────────
  X('bb-curl', 'Barbell curl', 'isolation', 'elbowFlexion', 'barbell', ['barbell'], ['biceps'], ['forearms'], {
    stress: ['elbows', 'wrists'], alt: ['db-curl', 'cable-curl'],
    cues: ['Shoulder-width underhand grip', 'Elbows pinned at your sides', 'Curl up without swinging; squeeze', 'Lower all the way'],
  }),
  X('db-curl', 'Dumbbell curl', 'isolation', 'elbowFlexion', 'dumbbell', ['dumbbell'], ['biceps'], ['forearms'], {
    alt: ['bb-curl', 'cable-curl', 'hammer-curl'],
    cues: ['Palms forward, elbows by your sides', 'Curl and squeeze at the top', 'Slow lower to straight arms', 'Alternate arms or curl both together'],
  }),
  X('incline-db-curl', 'Incline dumbbell curl', 'isolation', 'elbowFlexion', 'dumbbell', ['dumbbell', 'bench'], ['biceps'], [], {
    diff: 2, alt: ['db-curl', 'cable-curl'],
    cues: ['Bench at about 45°, arms hanging straight down', 'Curl without moving the upper arm forward', 'Big stretch at the bottom'],
  }),
  X('hammer-curl', 'Hammer curl', 'isolation', 'elbowFlexion', 'dumbbell', ['dumbbell'], ['biceps', 'forearms'], [], {
    alt: ['db-curl', 'kb-curl'],
    cues: ['Palms facing each other', 'Curl up, elbows still', 'Builds the forearm and the outer arm'],
  }),
  X('cable-curl', 'Cable curl', 'isolation', 'elbowFlexion', 'cable', ['cable'], ['biceps'], ['forearms'], {
    alt: ['db-curl', 'bb-curl'],
    cues: ['Low pulley, straight bar or rope', 'Elbows pinned', 'Constant tension: no resting at the bottom'],
  }),
  X('kb-curl', 'Kettlebell curl', 'isolation', 'elbowFlexion', 'kettlebell', ['kettlebell'], ['biceps'], ['forearms'], {
    alt: ['db-curl', 'hammer-curl'],
    cues: ['Hold the bell by the horns with both hands, or one bell by the handle', 'Elbows by the sides', 'Curl and squeeze; slow lower'],
  }),
  X('band-curl', 'Band curl', 'isolation', 'elbowFlexion', 'band', ['band'], ['biceps'], [], {
    alt: ['db-curl'],
    cues: ['Stand on the band', 'Curl up, elbows still', 'Squeeze hard at the top, where the band is tightest'],
  }),

  // ───────── Triceps ─────────
  X('cable-pushdown', 'Cable triceps pushdown', 'isolation', 'elbowExtension', 'cable', ['cable'], ['triceps'], [], {
    alt: ['band-pushdown', 'db-overhead-extension'],
    cues: ['High pulley, rope or bar', 'Elbows pinned at your sides', 'Push down to straight arms; spread the rope at the bottom', 'Control the return'],
  }),
  X('overhead-cable-extension', 'Overhead cable triceps extension', 'isolation', 'elbowExtension', 'cable', ['cable'], ['triceps'], [], {
    stress: ['elbows'], alt: ['db-overhead-extension', 'cable-pushdown'],
    cues: ['Face away from the pulley, rope over your head', 'Elbows point forward and stay still', 'Extend until the arms are straight', 'Deep stretch at the back'],
  }),
  X('db-overhead-extension', 'Dumbbell overhead triceps extension', 'isolation', 'elbowExtension', 'dumbbell', ['dumbbell'], ['triceps'], [], {
    stress: ['elbows'], alt: ['overhead-cable-extension', 'kb-overhead-extension'],
    cues: ['Hold one dumbbell overhead with both hands', 'Lower behind your head, elbows pointing up', 'Extend back to straight arms', 'Seated helps keep the back still'],
  }),
  X('kb-overhead-extension', 'Kettlebell overhead triceps extension', 'isolation', 'elbowExtension', 'kettlebell', ['kettlebell'], ['triceps'], [], {
    stress: ['elbows'], alt: ['db-overhead-extension'],
    cues: ['Hold the bell by the horns, upside down, overhead', 'Lower behind the head; elbows stay forward', 'Extend fully'],
  }),
  X('bb-skullcrusher', 'Barbell skull crusher', 'isolation', 'elbowExtension', 'barbell', ['barbell', 'bench'], ['triceps'], [], {
    diff: 2, stress: ['elbows'], alt: ['db-overhead-extension', 'cable-pushdown'],
    cues: ['Lie on a bench, bar over your shoulders (an EZ bar is easier on the wrists)', 'Lower toward your forehead or just behind it', 'Upper arms stay still', 'Extend back up'],
  }),
  X('close-grip-bench', 'Close-grip bench press', 'accessory', 'horizontalPush', 'barbell', ['barbell', 'bench', 'rack'], ['triceps', 'chest'], ['frontDelts'], {
    diff: 2, stress: ['wrists', 'elbows'], alt: ['dip', 'diamond-push-up'],
    cues: ['Hands about shoulder width', 'Elbows tucked close to the body', 'Lower to the lower chest', 'Press up by locking out the triceps'],
  }),
  X('diamond-push-up', 'Close-hand push-up', 'accessory', 'elbowExtension', 'bodyweight', ['bodyweight'], ['triceps'], ['chest', 'frontDelts'], {
    diff: 2, stress: ['wrists', 'elbows'], alt: ['cable-pushdown', 'close-grip-bench'],
    cues: ['Hands under the chest, close together', 'Elbows brush the ribs on the way down', 'Body straight; press back up', 'Elevate the hands to make it easier'],
  }),
  X('band-pushdown', 'Band triceps pushdown', 'isolation', 'elbowExtension', 'band', ['band'], ['triceps'], [], {
    alt: ['cable-pushdown'],
    cues: ['Band anchored high (over a door or bar)', 'Elbows pinned', 'Push to straight arms and squeeze'],
  }),

  // ───────── Core ─────────
  X('plank', 'Plank', 'core', 'antiExtension', 'bodyweight', ['bodyweight'], ['abs'], ['obliques', 'frontDelts'], {
    measure: 'time', seconds: [30, 60], alt: ['dead-bug', 'hollow-hold'],
    cues: ['Forearms under the shoulders', 'Squeeze glutes and pull ribs toward hips', 'Straight line from head to heels', 'Stop when the hips start to sag'],
  }),
  X('side-plank', 'Side plank', 'core', 'rotation', 'bodyweight', ['bodyweight'], ['obliques'], ['abs', 'glutes'], {
    uni: true, measure: 'time', seconds: [20, 45], stress: ['shoulders'], alt: ['suitcase-carry-kb', 'pallof-press'],
    cues: ['Elbow under the shoulder', 'Hips lifted in line with the body', 'Top hip slightly forward', 'Knees down to make it easier'],
  }),
  X('dead-bug', 'Dead bug', 'core', 'antiExtension', 'bodyweight', ['bodyweight'], ['abs'], ['obliques'], {
    alt: ['plank', 'bird-dog'],
    cues: ['On your back, arms up, knees over hips', 'Press the low back gently into the floor', 'Slowly extend the opposite arm and leg', 'Return and switch; breathe out as you reach'],
  }),
  X('bird-dog', 'Bird dog', 'core', 'antiExtension', 'bodyweight', ['bodyweight'], ['abs', 'lowerBack'], ['glutes'], {
    uni: true, alt: ['dead-bug'],
    cues: ['Hands under shoulders, knees under hips', 'Reach the opposite arm and leg out long', 'Keep the hips level, like balancing a cup on your back', 'Pause, return, switch'],
  }),
  X('hollow-hold', 'Hollow body hold', 'core', 'antiExtension', 'bodyweight', ['bodyweight'], ['abs'], [], {
    diff: 2, measure: 'time', seconds: [20, 40], alt: ['plank', 'dead-bug'],
    cues: ['Low back pressed to the floor', 'Lift shoulders and legs; arms overhead', 'Bend the knees to make it easier', 'Stop when the low back lifts'],
  }),
  X('hanging-knee-raise', 'Hanging knee raise', 'core', 'flexion', 'bodyweight', ['pullupBar'], ['abs'], ['forearms'], {
    alt: ['cable-crunch', 'dead-bug'],
    cues: ['Hang with straight arms, shoulders active', 'Curl the knees up toward the chest, tilting the pelvis', 'Lower slowly; no swinging'],
  }),
  X('hanging-leg-raise', 'Hanging leg raise', 'core', 'flexion', 'bodyweight', ['pullupBar'], ['abs'], ['forearms'], {
    diff: 3, alt: ['hanging-knee-raise'],
    cues: ['Straight legs raise to hip height or higher', 'Curl the pelvis up at the top', 'Slow and controlled'],
  }),
  X('cable-crunch', 'Cable crunch', 'core', 'flexion', 'cable', ['cable'], ['abs'], [], {
    alt: ['hanging-knee-raise'],
    cues: ['Kneel facing a high pulley, rope by your head', 'Curl the ribs toward the hips', 'Hips stay still; the spine does the bending', 'Slow return'],
  }),
  X('pallof-press', 'Pallof press', 'core', 'rotation', 'cable', ['cable'], ['obliques', 'abs'], [], {
    uni: true, alt: ['band-pallof-press', 'side-plank'],
    cues: ['Stand side-on to a chest-height pulley', 'Press the handle straight out from your chest', 'Resist the pull: no twisting', 'Hold 2 seconds, return'],
  }),
  X('band-pallof-press', 'Band Pallof press', 'core', 'rotation', 'band', ['band'], ['obliques', 'abs'], [], {
    uni: true, alt: ['pallof-press'],
    cues: ['Band anchored at chest height, standing side-on', 'Press out and hold without rotating', 'Step further away to make it harder'],
  }),
  X('cable-woodchop', 'Cable woodchop', 'core', 'rotation', 'cable', ['cable'], ['obliques'], ['abs', 'glutes'], {
    uni: true, stress: ['lowerBack'], alt: ['pallof-press'],
    cues: ['Pulley high (or low for a lift)', 'Rotate through the hips and upper back together, arms long', 'Pivot the back foot', 'Control the return'],
  }),
  X('kb-windmill', 'Kettlebell windmill', 'core', 'rotation', 'kettlebell', ['kettlebell'], ['obliques'], ['hamstrings', 'frontDelts', 'glutes'], {
    uni: true, diff: 3, stress: ['shoulders', 'lowerBack'], alt: ['side-plank', 'tgu'],
    cues: ['Bell locked out overhead; eyes on it', 'Push the hip out to the bell side and hinge down', 'Slide the free hand down the inside of the leg', 'Start with no weight or a very light bell'],
  }),
  X('bear-crawl', 'Bear crawl', 'core', 'getUp', 'bodyweight', ['bodyweight'], ['abs', 'frontDelts'], ['quads', 'obliques'], {
    measure: 'time', seconds: [20, 40], stress: ['wrists'], alt: ['plank'],
    cues: ['Hands under shoulders, knees an inch off the floor', 'Crawl forward and back with small steps', 'Keep the back flat and hips low'],
  }),

  // ───────── Get-up ─────────
  X('tgu', 'Turkish get-up', 'compound', 'getUp', 'kettlebell', ['kettlebell'], ['frontDelts', 'obliques'], ['abs', 'glutes', 'triceps', 'upperBack'], {
    uni: true, diff: 3, stress: ['shoulders'], reps: [1, 3], rir: [3, 4], restSec: 60,
    alt: ['kb-windmill', 'kb-overhead-carry'],
    cues: ['Learn it with no weight first (balance a shoe on your fist)', 'Eyes stay on the bell; arm locked straight the whole time', 'Roll to elbow → hand → high bridge → sweep the leg → half-kneel → stand', 'Reverse every step slowly to lie back down'],
  }),

  // ───────── Carries ─────────
  X('farmer-carry-db', 'Farmer’s carry (dumbbells)', 'carry', 'carry', 'dumbbell', ['dumbbell'], ['forearms', 'upperBack'], ['abs', 'obliques', 'glutes'], {
    measure: 'time', alt: ['farmer-carry-kb', 'suitcase-carry-kb'],
    cues: ['Heavy dumbbells at your sides', 'Stand tall, shoulders down and back', 'Short, quick steps; walk or march in place', 'Set them down before your grip fails'],
  }),
  X('farmer-carry-kb', 'Farmer’s carry (kettlebells)', 'carry', 'carry', 'kettlebell', ['kettlebell'], ['forearms', 'upperBack'], ['abs', 'obliques', 'glutes'], {
    measure: 'time', alt: ['farmer-carry-db', 'suitcase-carry-kb'],
    cues: ['A heavy bell in each hand', 'Tall posture, ribs down', 'Steady steps; don’t let the bells swing'],
  }),
  X('suitcase-carry-kb', 'Suitcase carry', 'carry', 'carry', 'kettlebell', ['kettlebell'], ['obliques', 'forearms'], ['abs', 'upperBack'], {
    uni: true, measure: 'time', alt: ['farmer-carry-kb', 'side-plank'],
    cues: ['One heavy bell in one hand', 'Don’t lean: stay perfectly upright', 'Walk, then switch hands'],
  }),
  X('suitcase-carry-db', 'Suitcase carry (dumbbell)', 'carry', 'carry', 'dumbbell', ['dumbbell'], ['obliques', 'forearms'], ['abs', 'upperBack'], {
    uni: true, measure: 'time', alt: ['suitcase-carry-kb', 'farmer-carry-db'],
    cues: ['One heavy dumbbell in one hand', 'Stay upright; resist leaning', 'Switch hands each set'],
  }),
  X('kb-rack-carry', 'Kettlebell front-rack carry', 'carry', 'carry', 'kettlebell', ['kettlebell'], ['abs', 'upperBack'], ['obliques', 'frontDelts'], {
    measure: 'time', alt: ['farmer-carry-kb'],
    cues: ['One or two bells in the rack position', 'Elbows tucked, wrists straight', 'Breathe behind the brace; walk tall'],
  }),
  X('kb-overhead-carry', 'Kettlebell overhead carry', 'carry', 'carry', 'kettlebell', ['kettlebell'], ['frontDelts', 'upperBack'], ['obliques', 'abs', 'triceps'], {
    uni: true, diff: 2, measure: 'time', stress: ['shoulders'], alt: ['kb-rack-carry', 'tgu'],
    cues: ['Bell locked out overhead, biceps by the ear', 'Ribs down; don’t arch', 'Light weight; switch arms each set'],
  }),

  // ───────── Mobility (warm-ups and recovery) ─────────
  X('worlds-greatest-stretch', 'World’s greatest stretch', 'mobility', 'mobility', 'bodyweight', ['bodyweight'], ['glutes', 'adductors'], ['hamstrings', 'upperBack'], {
    uni: true, reps: [4, 6], area: ['hips', 'tSpine', 'hamstrings'], warmup: ['lower', 'full'],
    cues: ['Step into a deep lunge; same-side hand inside the front foot', 'Drop the elbow toward the instep', 'Rotate and reach the arm to the ceiling', 'Push hips back to stretch the front hamstring'],
  }),
  X('hip-90-90', '90/90 hip switch', 'mobility', 'mobility', 'bodyweight', ['bodyweight'], ['glutes'], ['adductors'], {
    reps: [6, 10], area: ['hips'], warmup: ['lower'],
    cues: ['Sit with both knees bent at 90°, one in front and one to the side', 'Rotate both knees to the other side', 'Sit tall; use your hands behind you if needed'],
  }),
  X('half-kneel-hip-flexor', 'Half-kneeling hip flexor stretch', 'mobility', 'mobility', 'bodyweight', ['bodyweight'], ['quads'], ['abs'], {
    uni: true, measure: 'time', seconds: [30, 45], area: ['hips'], warmup: [],
    cues: ['Kneel on one knee, the other foot forward', 'Tuck the pelvis under and squeeze the back glute', 'Shift forward slightly until the front of the hip stretches', 'Reach the same-side arm overhead for more'],
  }),
  X('ankle-rock', 'Knee-to-wall ankle rocks', 'mobility', 'mobility', 'bodyweight', ['bodyweight'], ['calves'], [], {
    uni: true, reps: [8, 12], area: ['ankles'], warmup: ['lower'],
    cues: ['Half-kneel facing a wall, front toes a few inches away', 'Drive the knee forward toward the wall', 'Heel stays down', 'Move further back as it gets easier'],
  }),
  X('deep-squat-hold', 'Deep squat hold', 'mobility', 'mobility', 'bodyweight', ['bodyweight'], ['adductors', 'glutes'], ['calves'], {
    measure: 'time', seconds: [30, 60], area: ['hips', 'ankles'], warmup: ['lower'],
    cues: ['Sink into the bottom of a squat', 'Hold onto something if you need to', 'Use your elbows to gently push the knees out', 'Breathe and shift side to side'],
  }),
  X('cossack-squat', 'Cossack squat', 'mobility', 'mobility', 'bodyweight', ['bodyweight'], ['adductors', 'glutes'], ['quads'], {
    uni: true, diff: 2, reps: [5, 8], stress: ['knees'], area: ['hips', 'ankles'], warmup: ['lower'],
    cues: ['Very wide stance', 'Sit down onto one leg; the other leg straight, toes up', 'Go only as deep as you can with the heel down', 'Shift side to side'],
  }),
  X('leg-swing', 'Leg swings', 'mobility', 'mobility', 'bodyweight', ['bodyweight'], ['hamstrings', 'adductors'], ['glutes'], {
    uni: true, reps: [10, 12], area: ['hips', 'hamstrings'], warmup: ['lower', 'full'],
    cues: ['Hold a wall; swing one leg forward and back', 'Then side to side', 'Gradually bigger range'],
  }),
  X('inchworm', 'Inchworm', 'mobility', 'mobility', 'bodyweight', ['bodyweight'], ['hamstrings'], ['frontDelts', 'abs'], {
    reps: [4, 6], area: ['hamstrings', 'full'], warmup: ['full', 'lower'],
    cues: ['Fold forward, hands to the floor (bend the knees as needed)', 'Walk the hands out to a push-up position', 'Walk the feet in toward the hands', 'Stand and repeat'],
  }),
  X('cat-cow', 'Cat-cow', 'mobility', 'mobility', 'bodyweight', ['bodyweight'], ['lowerBack'], ['abs'], {
    reps: [6, 10], area: ['tSpine'], warmup: ['full'],
    cues: ['On hands and knees', 'Round the spine up as you breathe out', 'Let it sink and lift the chest as you breathe in', 'Slow and smooth'],
  }),
  X('open-book', 'Thoracic open book', 'mobility', 'mobility', 'bodyweight', ['bodyweight'], ['upperBack'], ['chest'], {
    uni: true, reps: [6, 8], area: ['tSpine', 'shoulders'], warmup: ['upper'],
    cues: ['Lie on your side, knees bent to 90°, arms together in front', 'Open the top arm across to the other side, following it with your eyes', 'Keep the knees together', 'Pause and breathe, then return'],
  }),
  X('thread-the-needle', 'Thread the needle', 'mobility', 'mobility', 'bodyweight', ['bodyweight'], ['upperBack'], ['rearDelts'], {
    uni: true, reps: [6, 8], area: ['tSpine', 'shoulders'], warmup: ['upper'],
    cues: ['On hands and knees', 'Slide one arm under the body, rotating the upper back', 'Then reach it up to the ceiling', 'Hips stay over the knees'],
  }),
  X('wall-slide', 'Wall slides', 'mobility', 'mobility', 'bodyweight', ['bodyweight'], ['upperBack'], ['sideDelts'], {
    reps: [8, 12], area: ['shoulders'], warmup: ['upper'],
    cues: ['Back and forearms against a wall', 'Slide the arms up while keeping contact', 'Ribs stay down', 'Only as high as you can control'],
  }),
  X('band-dislocate', 'Band pass-through', 'mobility', 'mobility', 'band', ['band'], ['frontDelts', 'rearDelts'], ['chest'], {
    reps: [8, 12], stress: ['shoulders'], area: ['shoulders'], warmup: ['upper'],
    cues: ['Wide grip on a light band', 'Arms straight; lift over the head and behind', 'Bring it back in front', 'Narrow the grip slowly over weeks'],
  }),
  X('shoulder-cars', 'Shoulder circles (CARs)', 'mobility', 'mobility', 'bodyweight', ['bodyweight'], ['frontDelts', 'rearDelts'], ['sideDelts'], {
    uni: true, reps: [3, 5], area: ['shoulders'], warmup: ['upper', 'full'],
    cues: ['Stand tall; squeeze a fist', 'Draw the biggest slow circle you can with a straight arm', 'Ribs stay still; only the shoulder moves', 'Both directions'],
  }),
  X('scap-push-up', 'Scapular push-up', 'mobility', 'mobility', 'bodyweight', ['bodyweight'], ['upperBack'], ['chest'], {
    reps: [8, 12], stress: ['wrists'], area: ['shoulders'], warmup: ['upper'],
    cues: ['Push-up position, arms straight', 'Let the chest sink between the shoulder blades', 'Then push the floor away, spreading them', 'Elbows never bend'],
  }),
  X('kb-halo', 'Kettlebell halo', 'mobility', 'mobility', 'kettlebell', ['kettlebell'], ['frontDelts', 'upperBack'], ['triceps', 'abs'], {
    reps: [5, 8], area: ['shoulders', 'tSpine'], warmup: ['upper'],
    cues: ['Hold a light bell upside down by the horns', 'Circle it slowly around the head, close to the neck', 'Ribs down; don’t arch', 'Both directions'],
  }),
  X('hip-cars', 'Hip circles (CARs)', 'mobility', 'mobility', 'bodyweight', ['bodyweight'], ['glutes'], ['adductors'], {
    uni: true, reps: [3, 5], area: ['hips'], warmup: ['lower'],
    cues: ['Hold a wall; lift one knee', 'Draw the biggest slow circle you can with the knee', 'Keep the pelvis still', 'Both directions'],
  }),
  X('active-slr', 'Active straight-leg raise', 'mobility', 'mobility', 'bodyweight', ['bodyweight'], ['hamstrings'], ['abs'], {
    uni: true, reps: [6, 10], area: ['hamstrings'], warmup: ['lower'],
    cues: ['Lie on your back, both legs straight', 'Lift one leg as high as you can keeping both straight', 'Other leg pressed into the floor', 'Lower slowly'],
  }),
];
