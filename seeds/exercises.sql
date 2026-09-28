INSERT INTO exercises (
    id,
    name,
    slug,
    description,
    category,
    muscle_group,
    equipment,
    difficulty,
    instructions,
    is_active
) VALUES

-- CHEST
(
    'ex_chest_001',
    'Barbell Bench Press',
    'barbell-bench-press',
    'Compound chest exercise performed with a barbell.',
    'strength',
    'chest',
    'barbell',
    'intermediate',
    'Lie on the bench with your feet planted. Lower the bar toward your mid chest, then press it upward until your arms are extended.',
    1
),

(
    'ex_chest_002',
    'Incline Dumbbell Press',
    'incline-dumbbell-press',
    'Upper chest focused pressing exercise.',
    'strength',
    'chest',
    'dumbbell',
    'intermediate',
    'Set the bench to an incline. Press the dumbbells upward from chest level and lower them under control.',
    1
),

(
    'ex_chest_003',
    'Push Up',
    'push-up',
    'Bodyweight pressing exercise targeting the chest and triceps.',
    'bodyweight',
    'chest',
    'bodyweight',
    'beginner',
    'Start in a plank position. Lower your chest toward the floor while keeping your body straight, then push back up.',
    1
),

(
    'ex_chest_004',
    'Cable Chest Fly',
    'cable-chest-fly',
    'Cable isolation exercise for the chest.',
    'strength',
    'chest',
    'cable',
    'beginner',
    'Stand between the cable handles. Bring your hands together in front of your chest while keeping a slight bend in your elbows.',
    1
),

-- BACK
(
    'ex_back_001',
    'Lat Pulldown',
    'lat-pulldown',
    'Vertical pulling exercise targeting the lat muscles.',
    'strength',
    'back',
    'cable',
    'beginner',
    'Pull the bar toward your upper chest while keeping your torso stable. Slowly return the bar to the starting position.',
    1
),

(
    'ex_back_002',
    'Barbell Row',
    'barbell-row',
    'Compound horizontal pulling exercise.',
    'strength',
    'back',
    'barbell',
    'intermediate',
    'Hinge forward with a neutral spine. Pull the bar toward your lower chest and lower it under control.',
    1
),

(
    'ex_back_003',
    'Seated Cable Row',
    'seated-cable-row',
    'Cable rowing movement for the back.',
    'strength',
    'back',
    'cable',
    'beginner',
    'Sit upright and pull the handle toward your torso. Squeeze your shoulder blades together before returning.',
    1
),

(
    'ex_back_004',
    'Pull Up',
    'pull-up',
    'Bodyweight vertical pulling exercise.',
    'bodyweight',
    'back',
    'pull-up-bar',
    'advanced',
    'Hang from the bar and pull your body upward until your chin clears the bar. Lower yourself with control.',
    1
),

-- SHOULDERS
(
    'ex_shoulder_001',
    'Dumbbell Shoulder Press',
    'dumbbell-shoulder-press',
    'Overhead pressing movement targeting the shoulders.',
    'strength',
    'shoulders',
    'dumbbell',
    'beginner',
    'Press the dumbbells overhead from shoulder level and lower them slowly.',
    1
),

(
    'ex_shoulder_002',
    'Lateral Raise',
    'lateral-raise',
    'Isolation exercise for the side deltoids.',
    'strength',
    'shoulders',
    'dumbbell',
    'beginner',
    'Raise the dumbbells out to your sides until approximately shoulder height, then lower them slowly.',
    1
),

(
    'ex_shoulder_003',
    'Face Pull',
    'face-pull',
    'Cable exercise targeting the rear shoulders and upper back.',
    'strength',
    'shoulders',
    'cable',
    'beginner',
    'Pull the rope toward your face while rotating your hands outward. Return slowly.',
    1
),

-- BICEPS
(
    'ex_biceps_001',
    'Dumbbell Bicep Curl',
    'dumbbell-bicep-curl',
    'Basic biceps isolation exercise.',
    'strength',
    'biceps',
    'dumbbell',
    'beginner',
    'Keep your elbows close to your body and curl the dumbbells toward your shoulders.',
    1
),

(
    'ex_biceps_002',
    'Hammer Curl',
    'hammer-curl',
    'Neutral-grip curl targeting the biceps and forearms.',
    'strength',
    'biceps',
    'dumbbell',
    'beginner',
    'Hold the dumbbells with a neutral grip and curl them toward your shoulders.',
    1
),

(
    'ex_biceps_003',
    'EZ Bar Curl',
    'ez-bar-curl',
    'Barbell curl variation for the biceps.',
    'strength',
    'biceps',
    'ez-bar',
    'intermediate',
    'Curl the EZ bar toward your shoulders while keeping your elbows stationary.',
    1
),

-- TRICEPS
(
    'ex_triceps_001',
    'Cable Tricep Pushdown',
    'cable-tricep-pushdown',
    'Cable isolation exercise for the triceps.',
    'strength',
    'triceps',
    'cable',
    'beginner',
    'Push the cable attachment downward until your arms are extended, then return slowly.',
    1
),

(
    'ex_triceps_002',
    'Overhead Tricep Extension',
    'overhead-tricep-extension',
    'Overhead movement targeting the triceps.',
    'strength',
    'triceps',
    'dumbbell',
    'beginner',
    'Hold the weight overhead and lower it behind your head before extending your arms.',
    1
),

(
    'ex_triceps_003',
    'Close Grip Push Up',
    'close-grip-push-up',
    'Push-up variation emphasizing the triceps.',
    'bodyweight',
    'triceps',
    'bodyweight',
    'beginner',
    'Perform a push-up with your hands positioned closer together to increase triceps involvement.',
    1
),

-- LEGS
(
    'ex_legs_001',
    'Barbell Squat',
    'barbell-squat',
    'Compound lower-body exercise targeting the quads and glutes.',
    'strength',
    'legs',
    'barbell',
    'intermediate',
    'Place the bar across your upper back. Bend your knees and hips to lower your body, then drive through your feet to stand.',
    1
),

(
    'ex_legs_002',
    'Leg Press',
    'leg-press',
    'Machine-based compound leg exercise.',
    'strength',
    'legs',
    'machine',
    'beginner',
    'Place your feet on the platform and lower the weight under control before pressing it back.',
    1
),

(
    'ex_legs_003',
    'Romanian Deadlift',
    'romanian-deadlift',
    'Hip hinge movement targeting hamstrings and glutes.',
    'strength',
    'hamstrings',
    'barbell',
    'intermediate',
    'Keep your back neutral and push your hips backward while lowering the weight. Drive your hips forward to return.',
    1
),

(
    'ex_legs_004',
    'Walking Lunge',
    'walking-lunge',
    'Unilateral lower-body movement.',
    'strength',
    'legs',
    'bodyweight',
    'beginner',
    'Step forward and lower your body until both knees are bent, then push through the front foot and step forward.',
    1
),

(
    'ex_legs_005',
    'Leg Extension',
    'leg-extension',
    'Machine isolation exercise for the quadriceps.',
    'strength',
    'quadriceps',
    'machine',
    'beginner',
    'Extend your knees to raise the padded lever, then lower it slowly.',
    1
),

(
    'ex_legs_006',
    'Leg Curl',
    'leg-curl',
    'Machine isolation exercise for the hamstrings.',
    'strength',
    'hamstrings',
    'machine',
    'beginner',
    'Curl your heels toward your body against resistance, then return slowly.',
    1
),

-- GLUTES
(
    'ex_glutes_001',
    'Hip Thrust',
    'hip-thrust',
    'Glute-focused hip extension exercise.',
    'strength',
    'glutes',
    'barbell',
    'intermediate',
    'Position your upper back on a bench and drive your hips upward while squeezing your glutes.',
    1
),

(
    'ex_glutes_002',
    'Glute Bridge',
    'glute-bridge',
    'Bodyweight glute activation exercise.',
    'bodyweight',
    'glutes',
    'bodyweight',
    'beginner',
    'Lie on your back with knees bent. Drive your hips upward and squeeze your glutes at the top.',
    1
),

-- CORE
(
    'ex_core_001',
    'Plank',
    'plank',
    'Isometric core stability exercise.',
    'core',
    'core',
    'bodyweight',
    'beginner',
    'Hold a straight-body position supported by your forearms and toes while keeping your core engaged.',
    1
),

(
    'ex_core_002',
    'Crunch',
    'crunch',
    'Basic abdominal exercise.',
    'core',
    'core',
    'bodyweight',
    'beginner',
    'Lie on your back with knees bent. Curl your upper body toward your knees and return under control.',
    1
),

(
    'ex_core_003',
    'Hanging Knee Raise',
    'hanging-knee-raise',
    'Core exercise performed from a hanging position.',
    'core',
    'core',
    'pull-up-bar',
    'intermediate',
    'Hang from a bar and raise your knees toward your chest while controlling the movement.',
    1
),

-- CARDIO
(
    'ex_cardio_001',
    'Treadmill Walking',
    'treadmill-walking',
    'Low-impact cardiovascular exercise.',
    'cardio',
    'cardio',
    'treadmill',
    'beginner',
    'Walk at a comfortable pace while maintaining an upright posture.',
    1
),

(
    'ex_cardio_002',
    'Treadmill Running',
    'treadmill-running',
    'Cardiovascular running exercise.',
    'cardio',
    'cardio',
    'treadmill',
    'intermediate',
    'Run at a controlled pace while maintaining good posture and steady breathing.',
    1
),

(
    'ex_cardio_003',
    'Cycling',
    'cycling',
    'Indoor cycling exercise for cardiovascular fitness.',
    'cardio',
    'cardio',
    'stationary-bike',
    'beginner',
    'Maintain a steady cycling pace and adjust resistance according to your workout intensity.',
    1
),

(
    'ex_cardio_004',
    'Jumping Jacks',
    'jumping-jacks',
    'Full-body cardiovascular movement.',
    'cardio',
    'full-body',
    'bodyweight',
    'beginner',
    'Jump while moving your arms and legs outward, then return to the starting position.',
    1
),

-- FULL BODY
(
    'ex_fullbody_001',
    'Burpee',
    'burpee',
    'High-intensity full-body bodyweight movement.',
    'bodyweight',
    'full-body',
    'bodyweight',
    'intermediate',
    'Squat down, place your hands on the floor, extend your legs back, return to a squat and jump upward.',
    1
),

(
    'ex_fullbody_002',
    'Kettlebell Swing',
    'kettlebell-swing',
    'Dynamic hip hinge exercise for the posterior chain.',
    'strength',
    'full-body',
    'kettlebell',
    'intermediate',
    'Drive the kettlebell forward using your hips while maintaining a neutral spine.',
    1
);