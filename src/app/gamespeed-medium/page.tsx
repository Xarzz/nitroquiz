'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ASSET_LIST, TRACK_ASSETS, getAssetOffset } from '@/lib/gameAssets';
interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
}
import { supabase } from '@/lib/supabase';
import { getUser } from '@/lib/storage';

const Util = {
    toInt: (obj: any, def: number): number => { if (obj !== null) { const x = parseInt(obj, 10); if (!isNaN(x)) return x; } return Util.toInt(def, 0); },
    toFloat: (obj: any, def: number): number => { if (obj !== null) { const x = parseFloat(obj); if (!isNaN(x)) return x; } return Util.toFloat(def, 0.0); },
    limit: (value: number, min: number, max: number) => Math.max(min, Math.min(value, max)),
    randomInt: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
    randomChoice: (options: any[]) => options[Util.randomInt(0, options.length - 1)],
    percentRemaining: (n: number, total: number) => (n % total) / total,
    accelerate: (v: number, accel: number, dt: number) => v + (accel * dt),
    interpolate: (a: number, b: number, percent: number) => a + (b - a) * percent,
    easeIn: (a: number, b: number, percent: number) => a + (b - a) * Math.pow(percent, 2),
    easeInOut: (a: number, b: number, percent: number) => a + (b - a) * ((-Math.cos(percent * Math.PI) / 2) + 0.5),
    exponentialFog: (distance: number, density: number) => 1 / (Math.pow(Math.E, (distance * distance * density))),
    increase: (start: number, increment: number, max: number) => {
        let result = start + increment;
        while (result >= max) result -= max;
        while (result < 0) result += max;
        return result;
    },
    project: (p: Point, cameraX: number, cameraY: number, cameraZ: number, cameraDepth: number, width: number, height: number, roadWidth: number) => {
        p.camera.x = (p.world.x || 0) - cameraX;
        p.camera.y = (p.world.y || 0) - cameraY;
        p.camera.z = (p.world.z || 0) - cameraZ;
        p.screen.scale = cameraDepth / p.camera.z;
        p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
        p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y * height / 2));
        p.screen.w = Math.round(p.screen.scale * roadWidth * width / 2);
    },
    overlap: (x1: number, w1: number, x2: number, w2: number, percent: number = 1) => {
        const half1 = (percent || 1) * w1 / 2;
        const half2 = (percent || 1) * w2 / 2;
        return !(x1 - half1 > x2 + half2 || x1 + half1 < x2 - half2);
    }
};

// --- Types ---
interface Point {
    world: { x: number; y: number; z: number };
    camera: { x: number; y: number; z: number };
    screen: { scale: number; x: number; y: number; w: number };
}

interface Sprite {
    source: any;
    offset: number;
    offsetY?: number;
}

interface Car {
    offset: number;
    z: number;
    sprite: any;
    speed: number;
    percent: number;
    isRival?: boolean;
    type?: 'jne' | 'truck' | 'odong' | 'taxi';
    animTimer?: number;
    animFrame?: number;
}

interface Segment {
    index: number;
    p1: Point;
    p2: Point;
    color: { road: string; grass: string; rumble: string; strip: string };
    curve: number;
    fog: number;
    clip: number;
    looped: boolean;
    sprites: Sprite[];
    cars: Car[];
    zebra?: boolean;
}

// --- Constants ---
const FPS = 60;
const STEP = 1 / FPS;
const ROAD_WIDTH = 2000;
const SEGMENT_LENGTH = 200;
const RUMBLE_LENGTH = 3;
const LANES = 4;
const FIELD_OF_VIEW = 100;
const CAMERA_HEIGHT = 500;
const DRAW_DISTANCE = 300;
const FOG_DENSITY = 5;
const MAX_SPEED = SEGMENT_LENGTH / STEP;
const ACCEL = MAX_SPEED / 5;
const BREAKING = -MAX_SPEED * 2.5; // Stronger braking for mobile
const DECEL = -MAX_SPEED / 5;
const OFF_ROAD_DECEL = -MAX_SPEED / 2;
const OFF_ROAD_LIMIT = MAX_SPEED / 4;

const COLORS = {
    SKY: '#020617', // Deep Midnight Blue/Black
    TREE: '#064e3b',
    FOG: '#020617',
    LIGHT: { road: '#0a0d14', grass: '#1e293b', rumble: '#111827', strip: '#fbbf24', sidewalk: '#334155', curb: '#475569' }, // Neon Yellow Markings
    DARK: { road: '#05070a', grass: '#0f172a', rumble: '#0d1117', strip: '', sidewalk: '#1e293b', curb: '#334155' },
    START: { road: '#ffffff', grass: '#334155', rumble: '#ffffff', strip: '', sidewalk: '#ffffff', curb: '#ffffff' },
    FINISH: { road: '#000000', grass: '#111827', rumble: '#000000', strip: '', sidewalk: '#000000', curb: '#000000' }
};

export default function GameSpeedPage() {
    const router = useRouter();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Game State
    const [gameState, setGameState] = useState<'preparation' | 'countdown' | 'playing' | 'finished' | 'gameover'>('preparation');
    // Countdown Ref helper
    const countdownRef = useRef(3);
    const [countdown, setCountdown] = useState(3);
    const [stats, setStats] = useState({ speed: 0, nos: 100, lap: 1, totalLaps: 1 });

    // Countdown timer effect — uses setInterval, only triggers on gameState change
    useEffect(() => {
        if (gameState !== 'countdown') return;

        // Reset display to whatever the ref says it should be (5 or 3)
        setCountdown(countdownRef.current);

        const interval = setInterval(() => {
            setCountdown((prev) => {
                const next = prev - 1;
                if (next <= 0) {
                    clearInterval(interval);
                    setTimeout(() => { setGameState('playing'); }, 500);
                }
                return next;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [gameState]);
    const [viewMode, setViewMode] = useState<'first' | 'third'>('third');
    const [assetsLoaded, setAssetsLoaded] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [aspectRatio, setAspectRatio] = useState(1); // width/height ratio for responsive sizing
    const [miniMapMinimized, setMiniMapMinimized] = useState(false);
    const [isBraking, setIsBraking] = useState(false);
    const [isBoosting, setIsBoosting] = useState(false);
    const [mobileOrientationChoice, setMobileOrientationChoice] = useState<'portrait' | 'landscape' | null>(null);

    // Quiz Integration State
    const [allQuizQuestions, setAllQuizQuestions] = useState<QuizQuestion[]>([]);
    const [quizQuestionIndex, setQuizQuestionIndex] = useState(0); 
    const [totalQuizScore, setTotalQuizScore] = useState(0);
    const QUESTIONS_PER_ROUND = 3;

    const usePCLayout = !isMobile || mobileOrientationChoice === 'landscape';
    const isMobileLandscape = isMobile && mobileOrientationChoice === 'landscape';
    const isMobilePortrait = isMobile && mobileOrientationChoice === 'portrait';

    // Touch/Swipe refs for mobile controls
    const touchStartX = useRef<number | null>(null);
    const touchCurrentX = useRef<number | null>(null);
    const steeringTouchId = useRef<number | null>(null);
    const swipeThreshold = 30; // minimum swipe distance to trigger steer

    // Participant Update Helper - syncs player state to Supabase for host monitor
    const updateParticipantStatus = useCallback(async (updates: Record<string, any>) => {
        const sessId = typeof window !== 'undefined' ? localStorage.getItem('nitroquiz_game_sessionId') : null;
        const user = getUser();
        if (sessId && user) {
            try {
                await supabase.from('participants').update(updates)
                    .eq('session_id', sessId)
                    .eq('nickname', user.username);
            } catch (error) {
                console.error('Failed to sync participant status:', error);
            }
        }
    }, []);



    // Auto-start game logic - skip preparation screen after loading
    useEffect(() => {
        if (mounted && assetsLoaded && gameState === 'preparation') {
            // Wait for orientation choice on mobile
            if (!isMobile || mobileOrientationChoice) {
                // Short delay for visual transition
                const timer = setTimeout(() => {
                    countdownRef.current = 3;
                    setGameState('countdown');
                }, 800);
                return () => clearTimeout(timer);
            }
        }
    }, [mounted, assetsLoaded, gameState, isMobile, mobileOrientationChoice]);

    // Refs for game loop
    const state = useRef({
        segments: [] as Segment[],
        cars: [] as Car[],
        position: 0,
        playerX: 0,
        playerZ: 0,
        speed: 0,
        trackLength: 0,
        sprites: { car: null, bg: null, obstacle: null } as any,
        keyLeft: false,
        keyRight: false,
        keyFaster: false,
        keySlower: false,
        keyBoost: false,
        nos: 100,
        currentLap: 1,
        totalLaps: 1,
        countdown: 5,
        cameraDepth: 1 / Math.tan((FIELD_OF_VIEW / 2) * Math.PI / 180),
        viewMode: 'third' as 'first' | 'third',
        bgOffset: 0,
        analogSteer: 0, // -1 to 1 for smoother mobile steering
        // NOS Animation State
        nosPhase: 'idle' as 'idle' | 'startup' | 'loop' | 'ending',
        nosFrame: 0,
        nosFrameTimer: 0,
        nosWasPressed: false,
        // Starting Sequence - Revving State
        revvingFrame: 0, // 0 atau 1 untuk toggle antara start_1 dan start_2
        revvingTimer: 0,
        // MC / Forward Animation State
        mcFrame: 0,
        mcTimer: 0,
    });


    const animationFrameRef = useRef<number>(0);
    const miniMapRef = useRef<HTMLCanvasElement>(null);


    // --- Loading Assets ---
    useEffect(() => {
        // Ensure difficulty is stored for quiz return flow
        localStorage.setItem('nitroquiz_game_difficulty', 'medium');
        
        // Pre-fetch quiz page in background so transition is instant
        router.prefetch('/quiz');

        // Reset sprites to force reload on mount/remount
        state.current.sprites = { ...state.current.sprites };

        const loadAssets = async () => {
            console.log("Starting asset load...");
            let character = null;
            try {
                const stored = localStorage.getItem('edurace_selected_character');
                if (stored) {
                    character = JSON.parse(stored);
                }
            } catch (e) {
                console.error("Failed to load character", e);
            }

            const assetList = ASSET_LIST;

            const promises: Promise<void>[] = [];

            // Extend asset list with obstacles for medium mode
            const obstacles = [
                { name: 'obstacle1', src: '/assets/material/pembatas_jalan/1penghalang.webp' },
                { name: 'obstacle2', src: '/assets/material/pembatas_jalan/1roadbarrier.webp' }
            ];

            // Load from ASSET_LIST + obstacles (named assets)
            [...ASSET_LIST, ...obstacles].forEach(item => {
                promises.push(new Promise<void>((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        (img as any).assetName = item.name;
                        // Simpan dengan key 'name' (untuk akses global)
                        state.current.sprites[item.name] = img;
                        resolve();
                    };
                    img.onerror = () => {
                        // Fallback logic
                        const cvs = document.createElement('canvas');
                        cvs.width = 128; cvs.height = 128;
                        const ctx = cvs.getContext('2d');
                        if (ctx) {
                            ctx.fillStyle = '#444';
                            ctx.fillRect(0, 0, 128, 128);
                            const finalCvs = cvs as any;
                            finalCvs.assetName = item.name;
                            state.current.sprites[item.name] = finalCvs;
                        }
                        resolve();
                    };
                    img.src = item.src;
                }));
            });

            // Load from TRACK_ASSETS (direct src assets)
            // Use a specific prefix or exact match logic if needed, 
            // but here we just ensure the image is loaded into the sprite map keyed by its src path.
            // Only load unique sources that aren't already covered (though re-loading is safe-ish, better to check)

            // To properly support the new direct 'src' usage in TRACK_ASSETS without re-defining them in ASSET_LIST:
            const uniqueSources = Array.from(new Set(TRACK_ASSETS.map(item => item.src))).filter(Boolean);
            
            uniqueSources.forEach(src => {
                promises.push(new Promise<void>((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        (img as any).assetName = src; // Use src as name for these
                        // Simpan dengan key 'src' 
                        state.current.sprites[src] = img;
                        resolve();
                    };
                    img.onerror = () => {
                        // Fallback
                        const cvs = document.createElement('canvas');
                        cvs.width = 128; cvs.height = 128;
                        const ctx = cvs.getContext('2d');
                        if (ctx) {
                            ctx.fillStyle = '#f0f'; // Pink for error
                            ctx.fillRect(0, 0, 128, 128);
                            state.current.sprites[src] = cvs;
                        }
                        resolve();
                    };
                    img.src = src;
                }));
            });

            await Promise.all(promises);

            // Initialize road immediately after assets are loaded to ensure segments exist before first render
            // Always reset road to ensure new assets/sequences are applied
            resetRoad();
            setAssetsLoaded(true);
        };
        loadAssets();
    }, []);

    // --- Game Logic functions ---
    const findSegment = (z: number) => {
        if (!state.current.segments || state.current.segments.length === 0) {
            // Return dummy segment with all required properties to prevent crashes
            return {
                index: 0,
                p1: { world: { x: 0, y: 0, z: 0 }, camera: { x: 0, y: 0, z: 0 }, screen: { scale: 0, x: 0, y: 0, w: 0 } },
                p2: { world: { x: 0, y: 0, z: 0 }, camera: { x: 0, y: 0, z: 0 }, screen: { scale: 0, x: 0, y: 0, w: 0 } },
                curve: 0,
                color: COLORS.LIGHT,
                sprites: [],
                cars: [],
                clip: 0,
                fog: 0,
                looped: false
            } as Segment;
        }
        return state.current.segments[Math.floor(z / SEGMENT_LENGTH) % state.current.segments.length];
    };

    const addSegment = (curve: number, y: number) => {
        const n = state.current.segments.length;
        const lastY = n === 0 ? 0 : state.current.segments[n - 1].p2.world.y;

        state.current.segments.push({
            index: n,
            p1: { world: { x: 0, y: lastY, z: n * SEGMENT_LENGTH }, camera: { x: 0, y: 0, z: 0 }, screen: { scale: 0, x: 0, y: 0, w: 0 } },
            p2: { world: { x: 0, y: y, z: (n + 1) * SEGMENT_LENGTH }, camera: { x: 0, y: 0, z: 0 }, screen: { scale: 0, x: 0, y: 0, w: 0 } },
            curve: curve,
            sprites: [],
            cars: [],
            color: Math.floor(n / RUMBLE_LENGTH) % 2 ? COLORS.DARK : COLORS.LIGHT,
            fog: 0,
            clip: 0,
            looped: false
        });
    };

    const addRoad = (enter: number, hold: number, leave: number, curve: number, y: number) => {
        const startY = state.current.segments.length === 0 ? 0 : state.current.segments[state.current.segments.length - 1].p2.world.y;
        const endY = startY + (Util.toInt(y, 0) * SEGMENT_LENGTH);
        const total = enter + hold + leave;
        for (let n = 0; n < enter; n++) addSegment(Util.easeIn(0, curve, n / enter), Util.easeInOut(startY, endY, n / total));
        for (let n = 0; n < hold; n++) addSegment(curve, Util.easeInOut(startY, endY, (enter + n) / total));
        for (let n = 0; n < leave; n++) addSegment(Util.easeInOut(curve, 0, n / leave), Util.easeInOut(startY, endY, (enter + hold + n) / total));
    };

    const ROAD_CONF = {
        LENGTH: { NONE: 0, SHORT: 25, MEDIUM: 50, LONG: 100 },
        HILL: { NONE: 0, LOW: 20, MEDIUM: 40, HIGH: 60 },
        CURVE: { NONE: 0, EASY: 2, MEDIUM: 4, HARD: 6 }
    };

    const addStraight = (num?: number) => {
        num = num || ROAD_CONF.LENGTH.MEDIUM;
        addRoad(num, num, num, 0, 0);
    };

    const addCurve = (num?: number, curve?: number, height?: number) => {
        num = num || ROAD_CONF.LENGTH.MEDIUM;
        curve = curve || ROAD_CONF.CURVE.MEDIUM;
        height = height || ROAD_CONF.HILL.NONE;
        addRoad(num, num, num, curve, height);
    };

    const addSCurves = () => {
        addRoad(ROAD_CONF.LENGTH.MEDIUM, ROAD_CONF.LENGTH.MEDIUM, ROAD_CONF.LENGTH.MEDIUM, -ROAD_CONF.CURVE.EASY, ROAD_CONF.HILL.NONE);
        addRoad(ROAD_CONF.LENGTH.MEDIUM, ROAD_CONF.LENGTH.MEDIUM, ROAD_CONF.LENGTH.MEDIUM, ROAD_CONF.CURVE.MEDIUM, ROAD_CONF.HILL.MEDIUM);
        addRoad(ROAD_CONF.LENGTH.MEDIUM, ROAD_CONF.LENGTH.MEDIUM, ROAD_CONF.LENGTH.MEDIUM, ROAD_CONF.CURVE.EASY, -ROAD_CONF.HILL.LOW);
        addRoad(ROAD_CONF.LENGTH.MEDIUM, ROAD_CONF.LENGTH.MEDIUM, ROAD_CONF.LENGTH.MEDIUM, -ROAD_CONF.CURVE.EASY, ROAD_CONF.HILL.MEDIUM);
        addRoad(ROAD_CONF.LENGTH.MEDIUM, ROAD_CONF.LENGTH.MEDIUM, ROAD_CONF.LENGTH.MEDIUM, -ROAD_CONF.CURVE.MEDIUM, -ROAD_CONF.HILL.MEDIUM);
    };

    const addBumps = () => {
        addRoad(10, 10, 10, 0, 5);
        addRoad(10, 10, 10, 0, -2);
        addRoad(10, 10, 10, 0, -5);
        addRoad(10, 10, 10, 0, 8);
        addRoad(10, 10, 10, 0, 5);
        addRoad(10, 10, 10, 0, -7);
        addRoad(10, 10, 10, 0, 5);
        addRoad(10, 10, 10, 0, -2);
    };

    const addDownhillToEnd = (num: number) => {
        num = num || 200;
        const lastY = state.current.segments.length === 0 ? 0 : state.current.segments[state.current.segments.length - 1].p2.world.y;
        addRoad(num, num, num, -ROAD_CONF.CURVE.EASY, -lastY / SEGMENT_LENGTH);
    };

    const resetRoad = () => {
        state.current.segments = [];
        
        // --- MEDIUM DIFFICULTY TRACK LAYOUT ---
        // A much more twisty track with more curves, s-curves, and hills
        addStraight(ROAD_CONF.LENGTH.SHORT);
        addCurve(ROAD_CONF.LENGTH.MEDIUM, ROAD_CONF.CURVE.EASY, ROAD_CONF.HILL.NONE);
        addStraight(ROAD_CONF.LENGTH.SHORT);
        
        // Start difficult part
        addSCurves();
        addBumps();
        
        addCurve(ROAD_CONF.LENGTH.LONG, -ROAD_CONF.CURVE.MEDIUM, ROAD_CONF.HILL.MEDIUM);
        addStraight(ROAD_CONF.LENGTH.MEDIUM);
        
        addSCurves();
        
        addCurve(ROAD_CONF.LENGTH.LONG, ROAD_CONF.CURVE.HARD, -ROAD_CONF.HILL.MEDIUM);
        addCurve(ROAD_CONF.LENGTH.LONG, -ROAD_CONF.CURVE.HARD, ROAD_CONF.HILL.HIGH);
        addBumps();
        
        addStraight(ROAD_CONF.LENGTH.MEDIUM);
        
        addDownhillToEnd(250);

        const len = state.current.segments.length;

        // --- HYBRID ASSET PLACEMENT ---
        // 1. Manual Placement (Prioritas Utama)
        // Load manual configuration from TRACK_ASSETS

        // Map to keep track of occupied spots to avoid overlap
        // Keys: "segmentIndex_side" (e.g., "150_left")
        const occupied: { [key: string]: boolean } = {};

        TRACK_ASSETS.forEach(item => {
            const segIdx = item.z;
            if (segIdx < len) {
                if (item.src) {
                    // Try to get sprite by direct src key first
                    let sprite = state.current.sprites[item.src];

                    if (sprite) {
                        // Use item.src for keyword matching (e.g. 'pohon')
                        const offset = item.offset !== undefined ? item.offset : getAssetOffset(item.side, item.src);
                        state.current.segments[segIdx].sprites.push({ source: sprite, offset: offset, offsetY: -1 });

                        // Mark occupied (give some buffer space)
                        occupied[`${segIdx}_${item.side}`] = true;
                        occupied[`${segIdx + 1}_${item.side}`] = true;
                        occupied[`${segIdx + 2}_${item.side}`] = true;

                        // Special logic: Zebra Crossing for Traffic Lights
                        if (item.src.includes('lampulalulintas')) {
                            // Add zebra cross for next 10 segments
                            for (let z = 0; z < 10; z++) {
                                if (state.current.segments[segIdx + z]) {
                                    state.current.segments[segIdx + z].zebra = true;
                                }
                            }
                        }
                    }
                }
            }
        });


        state.current.trackLength = len * SEGMENT_LENGTH;

        // Initial NPCs Spawning (Now using Trucks)
        state.current.cars = [];
        for (let n = 0; n < 20; n++) {
            const z = (n + 1) * (len * SEGMENT_LENGTH / 20);
            const offset = Util.randomChoice([-0.8, -0.4, 0.4, 0.8]);
            const speed = MAX_SPEED / 4 + Math.random() * (MAX_SPEED / 2);

            // Random choice: 0=Truck, 1=JNE, 2=Odong, 3=Taxi
            const vehicleTypeRnd = Math.random();
            let vehicleType: 'truck' | 'jne' | 'odong' | 'taxi' = 'truck';
            let vehicleSprite = state.current.sprites.truck2;

            if (vehicleTypeRnd < 0.25) {
                vehicleType = 'truck';
                vehicleSprite = state.current.sprites.truck_straight_0 || state.current.sprites.truck2;
            } else if (vehicleTypeRnd < 0.5) {
                vehicleType = 'jne';
                vehicleSprite = state.current.sprites.jne_straight_1;
            } else if (vehicleTypeRnd < 0.75) {
                vehicleType = 'odong';
                vehicleSprite = state.current.sprites.odong_straight;
            } else {
                vehicleType = 'taxi';
                vehicleSprite = state.current.sprites.taxi_straight || state.current.sprites.truck2;
                console.log("Spawning TAXI - sprite exists:", !!state.current.sprites.taxi_straight);
            }

            const car: Car = {
                offset: offset,
                z: z,
                sprite: vehicleSprite,
                speed: speed,
                percent: 0,
                type: vehicleType,
                animTimer: (vehicleType === 'jne' || vehicleType === 'odong' || vehicleType === 'taxi' || vehicleType === 'truck') ? Math.random() * 100 : 0,
                animFrame: 0
            };
            state.current.cars.push(car);
            findSegment(z).cars.push(car);
        }

        // Add Stationary Obstacles for Medium Mode
        for (let n = 0; n < 25; n++) {
            // Start spawning obstacles after the first 20 segments to give
            // the player some time to react, and distribute them across the track length
            const zLength = len * SEGMENT_LENGTH;
            const startOffset = 20 * SEGMENT_LENGTH;
            const z = startOffset + Math.random() * (zLength - startOffset - 1000);
            
            // Random lane placement (-0.8 to 0.8)
            const offset = (Math.random() * 1.6) - 0.8; 
            
            const isBarrier = Math.random() > 0.5;
            const obstacleSprite = isBarrier ? state.current.sprites.obstacle2 : state.current.sprites.obstacle1;

            const obstacle: Car = {
                offset: offset,
                z: z,
                sprite: obstacleSprite || state.current.sprites.truck2,
                speed: 0,
                percent: 0,
                type: 'obstacle' as any // Treating obstacle as a 0-speed NPC car for collision
            };
            state.current.cars.push(obstacle);
            findSegment(z).cars.push(obstacle);
        }

        // Spawn Rival Opponent
        const rivalCar: Car = {
            offset: -0.4,
            z: 200 * SEGMENT_LENGTH, // Start ahead of player bit
            sprite: state.current.sprites.car_rival || state.current.sprites.npc_car,
            speed: MAX_SPEED * 0.7, // Stable speed, like a normal NPC
            percent: 0,
            isRival: true
        };
        state.current.cars.push(rivalCar);
        findSegment(rivalCar.z).cars.push(rivalCar);

        // Color finish line only (START line removed as per request)
        for (let n = 0; n < RUMBLE_LENGTH; n++) {
            if (len - 1 - n >= 0) state.current.segments[len - 1 - n].color = COLORS.FINISH;
        }

        state.current.trackLength = len * SEGMENT_LENGTH;
    };

    // --- Rendering Helpers ---
    const renderSegment = (ctx: CanvasRenderingContext2D, width: number, lanes: number, x1: number, y1: number, w1: number, x2: number, y2: number, w2: number, fog: number, color: any, zebra: boolean = false) => {
        const r1 = w1 / Math.max(6, 2 * lanes);
        const r2 = w2 / Math.max(6, 2 * lanes);

        ctx.fillStyle = color.grass;
        ctx.fillRect(0, y2, width, y1 - y2);

        // Add some "Dirt/Soil" noise texture
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        for (let i = 0; i < 20; i++) {
            const rx = Math.random() * width;
            const ry = y2 + Math.random() * (y1 - y2);
            const rw = 1 + Math.random() * 3;
            ctx.fillRect(rx, ry, rw, 1);
        }

        // Rumble
        ctx.fillStyle = color.rumble;
        ctx.beginPath();
        ctx.moveTo(x1 - w1 - r1, y1);
        ctx.lineTo(x1 - w1, y1);
        ctx.lineTo(x2 - w2, y2);
        ctx.lineTo(x2 - w2 - r2, y2);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x1 + w1 + r1, y1);
        ctx.lineTo(x1 + w1, y1);
        ctx.lineTo(x2 + w2, y2);
        ctx.lineTo(x2 + w2 + r2, y2);
        ctx.closePath();
        ctx.fill();

        // Sidewalk (Detailed gray tiles)
        const sw1 = w1 * 0.5; // Sidewalk width relative to road
        const sw2 = w2 * 0.5;
        const cw1 = w1 * 0.05; // Curb width
        const cw2 = w2 * 0.05;

        // Draw Left Sidewalk (Base)
        ctx.fillStyle = color.sidewalk;
        ctx.beginPath();
        ctx.moveTo(x1 - w1 - r1 - sw1, y1);
        ctx.lineTo(x1 - w1 - r1, y1);
        ctx.lineTo(x2 - w2 - r2, y2);
        ctx.lineTo(x2 - w2 - r2 - sw2, y2);
        ctx.closePath();
        ctx.fill();

        // Draw Right Sidewalk (Base)
        ctx.beginPath();
        ctx.moveTo(x1 + w1 + r1 + sw1, y1);
        ctx.lineTo(x1 + w1 + r1, y1);
        ctx.lineTo(x2 + w2 + r2, y2);
        ctx.lineTo(x2 + w2 + r2 + sw2, y2);
        ctx.closePath();
        ctx.fill();

        // Curb (Edge of sidewalk)
        ctx.fillStyle = color.curb;
        // Left Curb
        ctx.beginPath();
        ctx.moveTo(x1 - w1 - r1 - cw1, y1);
        ctx.lineTo(x1 - w1 - r1, y1);
        ctx.lineTo(x2 - w2 - r2, y2);
        ctx.lineTo(x2 - w2 - r2 - cw2, y2);
        ctx.closePath();
        ctx.fill();
        // Right Curb
        ctx.beginPath();
        ctx.moveTo(x1 + w1 + r1 + cw1, y1);
        ctx.lineTo(x1 + w1 + r1, y1);
        ctx.lineTo(x2 + w2 + r2, y2);
        ctx.lineTo(x2 + w2 + r2 + cw2, y2);
        ctx.closePath();
        ctx.fill();

        // Road Area
        ctx.fillStyle = color.road;
        ctx.beginPath();
        ctx.moveTo(x1 - w1, y1);
        ctx.lineTo(x2 - w2, y2);
        ctx.lineTo(x2 + w2, y2);
        ctx.lineTo(x1 + w1, y1);
        ctx.closePath();
        ctx.fill();


        // Zebra Cross
        if (zebra) {
            ctx.fillStyle = '#ffffff';
            const stripes = 10;
            const stripeW1 = (w1 * 2) / stripes;
            const stripeW2 = (w2 * 2) / stripes;
            for (let i = 0; i < stripes; i++) {
                if (i % 2 === 0) {
                    ctx.beginPath();
                    ctx.moveTo(x1 - w1 + i * stripeW1, y1);
                    ctx.lineTo(x1 - w1 + (i + 1) * stripeW1, y1);
                    ctx.lineTo(x2 - w2 + (i + 1) * stripeW2, y2);
                    ctx.lineTo(x2 - w2 + i * stripeW2, y2);
                    ctx.fill();
                }
            }
        }

        // Lane
        if (color.strip) {
            ctx.fillStyle = color.strip;
            const laneW1 = w1 * 2 / lanes;
            const laneW2 = w2 * 2 / lanes;
            const laneX1 = x1 - w1 + laneW1;
            const laneX2 = x2 - w2 + laneW2;
            for (let i = 1; i < lanes; i++) {
                ctx.beginPath();
                ctx.moveTo(x1 - w1 + i * laneW1 - w1 / 30, y1);
                ctx.lineTo(x1 - w1 + i * laneW1 + w1 / 30, y1);
                ctx.lineTo(x2 - w2 + i * laneW2 + w2 / 30, y2);
                ctx.lineTo(x2 - w2 + i * laneW2 - w2 / 30, y2);
                ctx.fill();
            }
        }
    };

    const renderSprite = (ctx: CanvasRenderingContext2D, width: number, height: number, resolution: number, roadWidth: number, sprite: any, scale: number, destX: number, destY: number, offsetX: number, offsetY: number, clipY: number) => {
        if (!sprite) return;

        const name = (sprite as any).assetName;

        // Menghitung worldWidth secara dinamis berdasarkan ukuran sprite mobil pemain
        // Diubah rasionya menjadi 1.0 agar ukuran NPC pas dengan karakter pemain ketika didekati
        const baseCar = state.current.sprites.car;
        const playerRefWidth = baseCar ? baseCar.width : 300;
        const carWorldWidth = playerRefWidth * 1.0;

        let worldWidth = carWorldWidth * 0.75; // NPC mobil disesuaikan (jangan terlalu besar)
        if (name?.includes('lampulalulintas') || name === 'traffic_light') worldWidth = carWorldWidth * 4.7;
        else if (name?.includes('truck')) worldWidth = carWorldWidth * 1.1; // Truk sedikit lebih besar dari mobil
        else if (name?.includes('car_rival') || name === 'foward-opponent') worldWidth = carWorldWidth * 0.75; // Rival sama dengan NPC
        else if (name?.includes('odong') || name?.includes('taxi')) worldWidth = carWorldWidth * 0.8; 
        else if (name?.includes('kiri_') || name?.includes('kanan_')) worldWidth = carWorldWidth * 25.0; // Bangunan dikembalikan ke ukuran besar
        else if (name?.includes('pohon')) worldWidth = carWorldWidth * 15.0; // Pohon dikembalikan besar
        else if (name?.includes('bush') || name?.includes('semak')) worldWidth = carWorldWidth * 2.35;
        else if (name?.includes('bench') || name?.includes('bangku')) worldWidth = carWorldWidth * 2.8;
        else if (name?.includes('barrier') || name?.includes('pembatas_jalan')) worldWidth = carWorldWidth * 2.8;
        else if (name?.includes('cone') || name?.includes('penghalang')) worldWidth = carWorldWidth * 0.95;
        else if (name?.includes('obstacle') || name?.includes('construction')) worldWidth = carWorldWidth * 1.1;

        const destW = scale * worldWidth * (width / 2);
        const destH = destW * (sprite.height / sprite.width);

        // Allow objects to grow naturally as they get closer (no clamping limits)
        let clampedW = destW;
        let clampedH = destH;

        destX = destX + (clampedW * (offsetX || 0));
        // Improved vertical positioning - sprites sit on the road
        destY = destY + (clampedH * Math.min(offsetY || 0, -0.5));

        const clipH = clipY ? Math.max(0, destY + clampedH - clipY) : 0;
        if (clipH < clampedH && clampedH > 1) {
            ctx.save();
            ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height - (sprite.height * clipH / clampedH), destX, destY, clampedW, clampedH - clipH);
            ctx.restore();
        }
    };

    const renderPlayer = (ctx: CanvasRenderingContext2D, width: number, height: number, resolution: number, roadWidth: number, speedPercent: number, scale: number, destX: number, destY: number, steer: number, updown: number, viewMode: 'first' | 'third') => {
        const { keyLeft, keyRight, keyFaster, sprites } = state.current;

        // Starting Sequence - Revving Animation saat Countdown & Preparation
        const isPreparing = gameState === 'preparation';
        const isCountdown = gameState === 'countdown';
        const isAtStart = isPreparing || isCountdown;

        // Update revving animation timer - Play when gas is pressed at start OR when braking
        if ((isAtStart && keyFaster) || state.current.keySlower) {
            state.current.revvingTimer += 16; // ~60fps
            if (state.current.revvingTimer >= 80) { // Fast toggle for revving/braking effect
                state.current.revvingTimer = 0;
                state.current.revvingFrame = state.current.revvingFrame === 0 ? 1 : 0;
            }
        }

        // Update MC Animation timer - Play when driving (Forward, Left, or Right)
        if (!isAtStart && (keyFaster || keyLeft || keyRight) && !state.current.keySlower) {
            state.current.mcTimer += 16;
            if (state.current.mcTimer >= 80) {
                state.current.mcTimer = 0;
                state.current.mcFrame = (state.current.mcFrame + 1) % 4;
            }
        }

        if (viewMode === 'first') {
            let sprite = sprites.mc_1st_straight_0 || sprites.car_1st;

            if (keyLeft) {
                // Turn Left Animation (0-1)
                const frame = state.current.mcFrame % 2;
                sprite = sprites[`mc_1st_left_${frame}`] || sprite;
            } else if (keyRight) {
                // Turn Right Animation (0-1)
                const frame = state.current.mcFrame % 2;
                sprite = sprites[`mc_1st_right_${frame}`] || sprite;
            } else if (keyFaster) {
                // Straight Animation (0, 1, 3)
                // Note: 2 is missing in file provided, so we cycle 0->1->3
                const straightFrames = [0, 1, 3];
                const frameIdx = state.current.mcFrame % straightFrames.length;
                const suffix = straightFrames[frameIdx];
                sprite = sprites[`mc_1st_straight_${suffix}`] || sprite;
            } else {
                // Idle
                sprite = sprites.mc_1st_straight_0 || sprite;
            }

            if (!sprite) return;

            // 1st Person POV: Cockpit/Hands
            // "Full Screen" scaling: Scale to fit width
            const destW = width;
            const destH = destW * (sprite.height / sprite.width);

            // Centered horizontally, pushed lower to show more road
            // Dynamic Sway logic for 1st person to make it feel alive
            const sway = Math.sin(Date.now() / 200) * 5;
            const x = (steer * -30) + sway;
            const y = height - (destH * 0.8) + Math.abs(sway); // Posisi stabil dengan sedikit bounce

            // Dashboard red glow for 1st person
            if (state.current.keySlower) {
                ctx.save();
                const grd = ctx.createLinearGradient(0, height, 0, height - 150);
                grd.addColorStop(0, 'rgba(255, 0, 0, 0.4)');
                grd.addColorStop(1, 'rgba(255, 0, 0, 0)');
                ctx.fillStyle = grd;
                ctx.fillRect(0, height - 150, width, 150);
                ctx.restore();
            }

            // Render sprite apa adanya tanpa tilt
            ctx.drawImage(sprite, x, y, destW, destH);
            return;
        }

        // --- 3rd Person POV ---

        let sprite = sprites.car;

        // Pilih sprite berdasarkan kondisi
        if (isAtStart && keyFaster) {
            // Tampilkan animasi revving saat menekan gas di awal
            sprite = state.current.revvingFrame === 0 ? sprites.start_1 : sprites.start_2;
        } else if (state.current.keySlower) {
            // Animasi Pengereman (Braking)
            sprite = state.current.revvingFrame === 0 ? sprites.rem_1 : sprites.rem_2;
        } else if (keyLeft) {
            // Turn Left Animation (0-3)
            sprite = sprites[`mc_left_${state.current.mcFrame}`];
        } else if (keyRight) {
            // Turn Right Animation (0-3)
            sprite = sprites[`mc_right_${state.current.mcFrame}`];
        } else if (keyFaster) {
            // Normal Forward Driving (MC Animation 0-3)
            sprite = sprites[`mc_straight_${state.current.mcFrame}`];
        } else {
            // IDLE / Coasting (No WASD pressed) - Use standard forward-sonic
            sprite = sprites.car;
        }

        if (!sprite) return;

        // Calculate base dimensions from the main car sprite (foward-sonic.png)
        const baseCar = sprites.car;
        const playerScale = (width / 1920) * 1.5;
        const baseW = baseCar ? baseCar.width * playerScale : 200;
        const baseH = baseCar ? baseCar.height * playerScale : 100;

        const isNitro = state.current.keyBoost && state.current.nos > 0;
        const wasPressed = state.current.nosWasPressed;

        // NOS Animation State Machine - transisi normal dan cepat
        const FRAME_DURATION = 5; // ULTRA FAST: 5ms per frame (approx 200fps playback speed)
        state.current.nosFrameTimer += 16;

        // Define frame sequences for the new 1-83 sequence
        // Startup: 1-30, Loop: 31-83
        const STARTUP_FRAMES = Array.from({ length: 30 }, (_, i) => i + 1);
        const LOOP_FRAMES = Array.from({ length: 53 }, (_, i) => i + 31);

        let currentNosSprite: any = null;

        if (isNitro) {
            // NOS is being pressed
            if (!wasPressed) {
                // If we were reversing (ending), try to resume from current frame
                if (state.current.nosPhase === 'ending') {
                    // Current frame is absolute 1-83
                    const currentAbsolute = state.current.nosFrame;
                    if (currentAbsolute > 30) {
                        // Resume in loop
                        state.current.nosPhase = 'loop';
                        // Find index in LOOP_FRAMES (31-83)
                        const idx = LOOP_FRAMES.indexOf(currentAbsolute);
                        state.current.nosFrame = idx >= 0 ? idx : 0;
                    } else {
                        // Resume in startup
                        state.current.nosPhase = 'startup';
                        // Find index in STARTUP_FRAMES (1-30)
                        const idx = STARTUP_FRAMES.indexOf(currentAbsolute);
                        state.current.nosFrame = idx >= 0 ? idx : 0;
                    }
                } else {
                    // Fresh start
                    state.current.nosPhase = 'startup';
                    state.current.nosFrame = 0;
                    state.current.nosFrameTimer = 0;
                }
            }

            // Using while loop to catch up if frame duration is smaller than update deltas
            if (state.current.nosPhase === 'startup') {
                while (state.current.nosFrameTimer >= FRAME_DURATION) {
                    state.current.nosFrameTimer -= FRAME_DURATION;
                    state.current.nosFrame++;
                    if (state.current.nosFrame >= STARTUP_FRAMES.length) {
                        state.current.nosPhase = 'loop';
                        state.current.nosFrame = 0;
                        break;
                    }
                }
                const frameNum = STARTUP_FRAMES[state.current.nosFrame];
                currentNosSprite = sprites[`nos_${frameNum}`];
            }

            if (state.current.nosPhase === 'loop') {
                while (state.current.nosFrameTimer >= FRAME_DURATION) {
                    state.current.nosFrameTimer -= FRAME_DURATION;
                    state.current.nosFrame = (state.current.nosFrame + 1) % LOOP_FRAMES.length;
                }
                const frameNum = LOOP_FRAMES[state.current.nosFrame];
                currentNosSprite = sprites[`nos_${frameNum}`];
            }

            state.current.nosWasPressed = true;
        } else {
            // NOS is released
            if (wasPressed) {
                // Just released - switch to reverse mode (using 'ending' phase)
                let startReverseFrame = 1;
                if (state.current.nosPhase === 'startup') {
                    startReverseFrame = STARTUP_FRAMES[state.current.nosFrame] || 1;
                } else if (state.current.nosPhase === 'loop') {
                    startReverseFrame = LOOP_FRAMES[state.current.nosFrame] || 31;
                } else if (state.current.nosPhase === 'ending') {
                    startReverseFrame = state.current.nosFrame;
                }

                state.current.nosPhase = 'ending';
                // Store absolute frame number directly in nosFrame for ending phase
                state.current.nosFrame = startReverseFrame;
                state.current.nosFrameTimer = 0;
            }

            if (state.current.nosPhase === 'ending') {
                // Play backwards from current frame to 1
                while (state.current.nosFrameTimer >= FRAME_DURATION) {
                    state.current.nosFrameTimer -= FRAME_DURATION;
                    state.current.nosFrame--;
                    if (state.current.nosFrame < 1) {
                        state.current.nosPhase = 'idle';
                        state.current.nosFrame = 0;
                        break;
                    }
                }

                if (state.current.nosPhase === 'ending') {
                    const frameNum = state.current.nosFrame;
                    // Ensure we have a valid frame number (1-83)
                    if (frameNum >= 1) {
                        currentNosSprite = sprites[`nos_${frameNum}`];
                    }
                }
            }

            state.current.nosWasPressed = false;
        }

        // Determine which sprite to draw
        const finalSprite = currentNosSprite || sprite;

        let finalW, finalH;

        if (currentNosSprite) {
            // For NOS animation (folder gif), force use of base car dimensions to maintain original size
            // This fixes the issue where they became too small
            finalW = baseW;
            finalH = baseH;
        } else {
            // Check if the current sprite is one of the MC animation frames that needs scaling down
            // We use assetName attached to the image object
            const sName = (finalSprite as any)?.assetName || '';
            const isMcStraight = sName.startsWith('mc_straight_');
            const isMcTurn = sName.startsWith('mc_left_') || sName.startsWith('mc_right_');

            let correctiveScale = 1.0;
            if (isMcStraight) correctiveScale = 1.0;
            else if (isMcTurn) correctiveScale = 1.0; // Adjusted to match mc_straight

            // Use the natural dimensions for MC/others to avoid distortion
            finalW = finalSprite.width * playerScale * correctiveScale;
            finalH = finalSprite.height * playerScale * correctiveScale;
        }

        // Optional: If the resulting sprite is drastically different in size from the base car, 
        // one might want to normalize it, but usually preserving aspect ratio is priority.
        // For now, we trust the assets have reasonable relative resolutions.

        const finalX = width / 2 - finalW / 2 + (steer * 50);
        const finalY = height - finalH - 35;

        // Render sprite apa adanya tanpa tilt - gambar sudah memiliki posisi miring sendiri
        ctx.drawImage(finalSprite, finalX, finalY, finalW, finalH);


    };

    // --- Core Updates ---
    const update = (dt: number) => {
        const { keyLeft, keyRight, keyFaster, keySlower, keyBoost, segments, playerX, speed, trackLength } = state.current;
        let { position, playerZ } = state.current;

        const playerSegment = findSegment(position + playerZ);
        const speedPercent = speed / MAX_SPEED;
        const dx = dt * 2 * speedPercent;

        // Move - TIDAK bergerak saat countdown
        if (gameState !== 'countdown') {
            position = Util.increase(position, dt * speed, trackLength);
            state.current.position = position;
        }

        // Steer
        let nextPlayerX = playerX;
        if (isMobile && mobileOrientationChoice === 'portrait') {
            // Analog steering for mobile portrait based on swipe distance
            nextPlayerX = playerX + (state.current.analogSteer * dx * 3.0); // Boosted for portrait
        } else {
            // Traditional key steering for PC or Mobile Landscape
            // Directly check state.current to ensure latest values on touch/pointer devices
            const steerForce = (isMobile ? 2.5 : 1.0); // Stronger steer for touch buttons
            if (state.current.keyLeft) nextPlayerX = playerX - (dx * steerForce);
            else if (state.current.keyRight) nextPlayerX = playerX + (dx * steerForce);
        }

        // Centrifugal
        nextPlayerX = nextPlayerX - (dx * speedPercent * playerSegment.curve * 0.2); // Dikurangi untuk centrifugal lebih halus

        // Pembatas jalan (Batas maksimum tidak bisa dipalu / keluar lintasan terlalu jauh)
        nextPlayerX = Util.limit(nextPlayerX, -1.5, 1.5);

        // Speed & NOS Logic
        let nextSpeed = speed;
        let nextNos = state.current.nos;

        const GAS_LIMIT = MAX_SPEED * 0.9;    // ~180 KPH
        const BOOST_LIMIT = MAX_SPEED * 1.1;  // ~220 KPH
        const REVVING_LIMIT = MAX_SPEED * 0.2; // ~40 KPH

        if (gameState === 'countdown') {
            if (keyFaster) {
                nextSpeed = Util.accelerate(speed, ACCEL * 0.5, dt);
                nextSpeed = Math.min(nextSpeed, REVVING_LIMIT);
            } else {
                nextSpeed = Util.accelerate(speed, DECEL, dt);
            }
        } else {
            // physics calculation
            const tryingToBoost = keyBoost && nextNos > 0;

            if (keySlower) {
                // BRAKING / STOPPING - Higher priority than Gas for mobile auto-forward
                nextSpeed = Util.accelerate(speed, BREAKING, dt);
            } else if (tryingToBoost) {
                // NOS BOOSTING
                nextSpeed = Util.accelerate(speed, ACCEL * 2.5, dt);
                nextNos = Math.max(0, nextNos - dt * 25); // Consumption

                if (nextSpeed >= BOOST_LIMIT - 300) {
                    const jitter = (Math.random() - 0.5) * 200;
                    nextSpeed = Util.limit(nextSpeed + jitter, 0, BOOST_LIMIT);
                }
            } else if (keyFaster) {
                // NORMAL GAS
                nextSpeed = Util.accelerate(speed, ACCEL, dt);
                if (nextSpeed > GAS_LIMIT) {
                    nextSpeed = Util.accelerate(nextSpeed, DECEL, dt);
                    nextSpeed = Math.max(nextSpeed, GAS_LIMIT);
                }
            } else {
                // IDLE
                nextSpeed = Util.accelerate(speed, DECEL, dt);
            }

            // Regen Logic - Only if NOT holding boost key and NOT braking
            if (!keyBoost && !keySlower) {
                if (keyFaster) nextNos = Math.min(100, nextNos + dt * 2); // Slow regen while driving
                else nextNos = Math.min(100, nextNos + dt * 8); // Fast regen while idle
            }
        }

        state.current.nos = nextNos;

        // Check offroad
        if ((nextPlayerX < -1) || (nextPlayerX > 1)) {
            if (nextSpeed > OFF_ROAD_LIMIT) {
                nextSpeed = Util.accelerate(nextSpeed, OFF_ROAD_DECEL, dt);
            }

            for (let n = 0; n < playerSegment.sprites.length; n++) {
                const sprite = playerSegment.sprites[n];
                const spriteW = 0.1;
                if (Util.overlap(nextPlayerX, 0.1, sprite.offset, spriteW)) {
                    nextSpeed = MAX_SPEED / 5;
                    position = Util.increase(playerSegment.p1.world.z, -playerZ, trackLength);
                    break;
                }
            }
        }

        // Road Boundary Limit (Acts as invisible barrier)
        nextPlayerX = Util.limit(nextPlayerX, -1.5, 1.5);
        // Speed cannot go below 0 — no reverse driving allowed
        nextSpeed = Util.limit(nextSpeed, 0, MAX_SPEED);

        state.current.playerX = nextPlayerX;
        state.current.speed = nextSpeed;

        // Update NPC Cars
        for (let n = 0; n < state.current.cars.length; n++) {
            const car = state.current.cars[n];
            const oldSeg = findSegment(car.z);
            car.z = Util.increase(car.z, dt * car.speed, trackLength);
            car.percent = Util.percentRemaining(car.z, SEGMENT_LENGTH);
            const newSeg = findSegment(car.z);
            if (oldSeg !== newSeg) {
                const idx = oldSeg.cars.indexOf(car);
                if (idx !== -1) oldSeg.cars.splice(idx, 1);
                newSeg.cars.push(car);
            }

            // NPC-Player Collision
            if (newSeg.index === playerSegment.index) {
                if (Util.overlap(nextPlayerX, 0.4, car.offset, 0.4)) {
                    if (nextSpeed > car.speed) {
                        const impact = nextSpeed - car.speed;
                        // "Mental ke belakang" — kurangi kecepatan tapi jangan 0, biar bisa langsung gas lagi
                        nextSpeed = nextSpeed * 0.3;
                        position = Util.increase(position, -200, trackLength); // "duk" mundur sedikit
                        
                        // Mild horizontal push
                        const dir = nextPlayerX > car.offset ? 1 : -1;
                        nextPlayerX += dir * 0.15;
                    }
                }
            }

            // Re-spawn far behind cars to ahead
            if (car.z < position && (position - car.z) > trackLength / 2) {
                car.z = Util.increase(car.z, trackLength, trackLength);
            }

            // --- NPC Animation Logic (JNE, Truck, Odong, Taxi) ---
            if (car.type === 'truck') {
                car.animTimer = (car.animTimer || 0) + dt * 1000;
                if (car.animTimer > 150) { // Cycle every 150ms
                    car.animTimer = 0;
                    car.animFrame = car.animFrame === 0 ? 1 : 0;
                }

                const currentSeg = findSegment(car.z);
                const curve = currentSeg.curve;

                if (curve < -0.5) {
                    car.sprite = car.animFrame === 0 ? state.current.sprites.truck_left_0 : state.current.sprites.truck_left_1;
                } else if (curve > 0.5) {
                    car.sprite = car.animFrame === 0 ? state.current.sprites.truck_right_0 : state.current.sprites.truck_right_1;
                } else {
                    car.sprite = car.animFrame === 0 ? state.current.sprites.truck_straight_0 : state.current.sprites.truck_straight_1;
                }
            } else if (car.type === 'jne') {
                car.animTimer = (car.animTimer || 0) + dt * 1000;
                if (car.animTimer > 100) { // Toggle every 100ms
                    car.animTimer = 0;
                    car.animFrame = car.animFrame === 0 ? 1 : 0;
                }

                // Determine direction based on road curve
                // Note: car.z was just updated above
                const currentSeg = findSegment(car.z);
                const curve = currentSeg.curve;

                let dir = 'straight';
                if (curve < -0.5) dir = 'left';
                else if (curve > 0.5) dir = 'right';

                // Select Sprite based on Dir + Frame
                if (dir === 'left') {
                    car.sprite = car.animFrame === 0 ? state.current.sprites.jne_left_1 : state.current.sprites.jne_left_2;
                } else if (dir === 'right') {
                    car.sprite = car.animFrame === 0 ? state.current.sprites.jne_right_1 : state.current.sprites.jne_right_2;
                } else {
                    car.sprite = car.animFrame === 0 ? state.current.sprites.jne_straight_1 : state.current.sprites.jne_straight_2;
                }
            } else if (car.type === 'odong') {
                // Odong-odong Animation Logic
                car.animTimer = (car.animTimer || 0) + dt * 1000;
                if (car.animTimer > 150) { // Slightly slower animation for odong (150ms)
                    car.animTimer = 0;
                    car.animFrame = car.animFrame === 0 ? 1 : 0;
                }

                // Odong-odong Directional Logic
                const currentSeg = findSegment(car.z);
                const curve = currentSeg.curve;

                if (curve < -0.5) {
                    const s1 = state.current.sprites.odong_left;
                    const s2 = state.current.sprites['1odong_left'];
                    car.sprite = (car.animFrame === 1 && s2) ? s2 : s1;
                } else if (curve > 0.5) {
                    const s1 = state.current.sprites.odong_right;
                    const s2 = state.current.sprites['1odong_right'];
                    car.sprite = (car.animFrame === 1 && s2) ? s2 : s1;
                } else {
                    const s1 = state.current.sprites.odong_straight;
                    const s2 = state.current.sprites['1odong_straight'];
                    car.sprite = (car.animFrame === 1 && s2) ? s2 : s1;
                }
            } else if (car.type === 'taxi') {
                // Taxi Animation Logic
                car.animTimer = (car.animTimer || 0) + dt * 1000;
                if (car.animTimer > 150) { // Cycle every 150ms
                    car.animTimer = 0;
                    car.animFrame = car.animFrame === 0 ? 1 : 0;
                }

                // Taxi Directional Logic
                const currentSeg = findSegment(car.z);
                const curve = currentSeg.curve;

                if (curve < -0.5) {
                    const s1 = state.current.sprites.taxi_left || state.current.sprites.taxi_straight || state.current.sprites.truck2;
                    const s2 = state.current.sprites['1taxi_left'];
                    car.sprite = (car.animFrame === 1 && s2) ? s2 : s1;
                } else if (curve > 0.5) {
                    const s1 = state.current.sprites.taxi_right || state.current.sprites.taxi_straight || state.current.sprites.truck2;
                    const s2 = state.current.sprites['1taxi_right'];
                    car.sprite = (car.animFrame === 1 && s2) ? s2 : s1;
                } else {
                    const s1 = state.current.sprites.taxi_straight || state.current.sprites.truck2;
                    const s2 = state.current.sprites['1taxi_straight'];
                    car.sprite = (car.animFrame === 1 && s2) ? s2 : s1;
                }
            }
        }

        // --- PARALLAX BACKGROUND UPDATE ---
        // We move the background offset here so it's time-based and synced with speed
        state.current.bgOffset = state.current.bgOffset || 0;
        // playerSegment is already defined above
        const curveFactor = (playerSegment.curve || 0) * (speed / MAX_SPEED);
        const steerFactor = (state.current.keyLeft ? -1 : state.current.keyRight ? 1 : 0) * (speed / MAX_SPEED) * 2;

        // Update offset based on dt (time) for smooth movement across frame rates
        state.current.bgOffset += (curveFactor + steerFactor) * dt * 0.1;

        // Use the updated position and speed
        state.current.position = position;
        state.current.playerX = nextPlayerX;
        state.current.speed = nextSpeed;

        // --- Dynamic FOV / Tunnel Vision Effect when NOS is active ---
        // Narrower FOV/Higher Depth for mobile portrait to make road look bigger
        const mobileDepthFactor = (isMobile && aspectRatio < 1) ? 1.4 : 1.0;
        const baseDepth = (1 / Math.tan((FIELD_OF_VIEW / 2) * Math.PI / 180)) * mobileDepthFactor;
        const targetDepth = (keyBoost && nextNos > 0) ? baseDepth * 1.5 : baseDepth; // 50% more depth = Narrower road

        // Smoothly interpolate cameraDepth (lerp)
        state.current.cameraDepth = state.current.cameraDepth + (targetDepth - state.current.cameraDepth) * dt * 5;

        // Update playerZ as it depends on cameraDepth
        state.current.playerZ = (CAMERA_HEIGHT * state.current.cameraDepth);
        playerZ = state.current.playerZ;

        const currentRound = Math.floor(quizQuestionIndex / QUESTIONS_PER_ROUND) + 1;
        const totalRounds = Math.max(1, Math.ceil(allQuizQuestions.length / QUESTIONS_PER_ROUND));

        // HUD update
        setStats({
            speed: Math.floor(speed / 100),
            nos: Math.floor(state.current.nos),
            lap: currentRound,
            totalLaps: totalRounds
        });

        // Lap & Finish line check
        if (position > trackLength - playerZ && gameState !== 'finished') {
            state.current.speed = 0;
            // Check if we have quiz questions remaining (from state or localStorage)
            let hasQuizRemaining = allQuizQuestions.length > 0 && quizQuestionIndex < allQuizQuestions.length;
            if (!hasQuizRemaining) {
                // Fallback: check localStorage directly
                try {
                    const storedQ = localStorage.getItem('nitroquiz_game_questions');
                    const storedIdx = parseInt(localStorage.getItem('nitroquiz_game_questionIndex') || '0', 10);
                    if (storedQ) {
                        const parsed = JSON.parse(storedQ);
                        if (Array.isArray(parsed) && storedIdx < parsed.length) {
                            hasQuizRemaining = true;
                        }
                    }
                } catch(e) {}
            }
            
            if (hasQuizRemaining) {
                // Save current state to localStorage before redirect
                localStorage.setItem('nitroquiz_game_questionIndex', quizQuestionIndex.toString());
                localStorage.setItem('nitroquiz_game_score', totalQuizScore.toString());
                router.push('/quiz');
            } else {
                setGameState('finished');
                endGame();
            }
        }
    };

    const render = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Nonaktifkan image smoothing untuk menghilangkan blur
        ctx.imageSmoothingEnabled = false;

        const width = canvas.width;
        const height = canvas.height;
        const { segments, position, playerZ, playerX, speed, sprites } = state.current;

        // Break early if segments are not initialized to prevent crashes
        if (!segments || segments.length === 0) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
            return;
        }

        // Clear and Sky
        ctx.fillStyle = COLORS.SKY;
        ctx.fillRect(0, 0, width, height);

        const baseSegment = findSegment(position);
        const basePercent = Util.percentRemaining(position, SEGMENT_LENGTH);
        const playerSegment = findSegment(position + playerZ);
        const playerPercent = Util.percentRemaining(position + playerZ, SEGMENT_LENGTH);
        const playerY = Util.interpolate(playerSegment.p1.world.y, playerSegment.p2.world.y, playerPercent);
        const speedPercent = speed / MAX_SPEED;

        // Background (Fixed Perspective Parallax - Full Cover)
        const bgAsset = isMobile && sprites.bg_mobile ? sprites.bg_mobile : sprites.bg;

        if (bgAsset) {
            const bg = bgAsset;
            const bgW = bg.width;
            const bgH = bg.height;

            // 1. Scale to cover screen with extra width for movement
            const extraParallax = isMobile ? 1.5 : 1.3;
            const scaleX = (width / bgW) * extraParallax;
            const scaleY = (height / bgH);
            const layerScale = Math.max(scaleX, scaleY);

            const scaledW = bgW * layerScale;
            const scaledH = bgH * layerScale;

            // 2. Parallax Positioning (Offset calculated in update())
            state.current.bgOffset = state.current.bgOffset || 0;

            // 3. Dynamic Clamping to prevent black bars
            const maxOverflowX = (scaledW - width) / 2;
            const maxAllowedFactor = maxOverflowX / scaledW;
            state.current.bgOffset = Util.limit(state.current.bgOffset, -maxAllowedFactor, maxAllowedFactor);

            // 4. Position and Render
            const finalScrollX = ((width - scaledW) / 2) - (state.current.bgOffset * scaledW);
            const finalScrollY = (height - scaledH) / 2;

            ctx.save();
            ctx.drawImage(bg, finalScrollX, finalScrollY, scaledW, scaledH);
            ctx.restore();
        }

        let maxy = height;
        let x = 0;
        let dx = - (baseSegment.curve * basePercent);

        // Camera Height based on POV
        // Higher camera (850) for 1st person to see over the dashboard
        const currentCameraHeight = state.current.viewMode === 'first' ? 850 : CAMERA_HEIGHT;

        // Render Segments
        for (let n = 0; n < DRAW_DISTANCE; n++) {
            const segment = segments[(baseSegment.index + n) % segments.length];
            segment.looped = segment.index < baseSegment.index;
            segment.fog = Util.exponentialFog(n / DRAW_DISTANCE, FOG_DENSITY);
            segment.clip = maxy;

            Util.project(segment.p1, (playerX * ROAD_WIDTH) - x, playerY + currentCameraHeight, position - (segment.looped ? state.current.trackLength : 0), state.current.cameraDepth, width, height, ROAD_WIDTH);
            Util.project(segment.p2, (playerX * ROAD_WIDTH) - x - dx, playerY + currentCameraHeight, position - (segment.looped ? state.current.trackLength : 0), state.current.cameraDepth, width, height, ROAD_WIDTH);

            x = x + dx;
            dx = dx + segment.curve;

            if ((segment.p1.camera.z <= state.current.cameraDepth) ||
                (segment.p2.screen.y >= segment.p1.screen.y) ||
                (segment.p2.screen.y >= maxy)) continue;

            renderSegment(ctx, width, LANES,
                segment.p1.screen.x, segment.p1.screen.y, segment.p1.screen.w,
                segment.p2.screen.x, segment.p2.screen.y, segment.p2.screen.w,
                segment.fog, segment.color, segment.zebra || false);

            maxy = segment.p1.screen.y;
        }

        // Render Sprites & Player
        for (let n = (DRAW_DISTANCE - 1); n > 0; n--) {
            const segment = segments[(baseSegment.index + n) % segments.length];

            for (let i = 0; i < segment.sprites.length; i++) {
                const sprite = segment.sprites[i];
                const spriteScale = segment.p1.screen.scale;
                const spriteX = segment.p1.screen.x + (spriteScale * sprite.offset * ROAD_WIDTH * width / 2);
                const spriteY = segment.p1.screen.y;
                if (segment.p1.screen.scale > 0.00001) {
                    renderSprite(ctx, width, height, height / 480, ROAD_WIDTH, sprite.source, spriteScale, spriteX, spriteY, (sprite.offset < 0 ? -1 : 0), (sprite.offsetY || -1), segment.clip);
                }
            }

            for (let i = 0; i < segment.cars.length; i++) {
                const car = segment.cars[i];
                const spriteScale = Util.interpolate(segment.p1.screen.scale, segment.p2.screen.scale, car.percent);
                const spriteX = Util.interpolate(segment.p1.screen.x, segment.p2.screen.x, car.percent) + (spriteScale * car.offset * ROAD_WIDTH * width / 2);
                const spriteY = Util.interpolate(segment.p1.screen.y, segment.p2.screen.y, car.percent);
                if (spriteScale > 0.00001) {
                    renderSprite(ctx, width, height, height / 480, ROAD_WIDTH, car.sprite, spriteScale, spriteX, spriteY, (car.offset < 0 ? -1 : 0), -1, segment.clip);
                }
            }

            if (segment == playerSegment && state.current.viewMode === 'third') {
                renderPlayer(ctx, width, height, height / 480, ROAD_WIDTH, speed / MAX_SPEED,
                    state.current.cameraDepth / playerZ,
                    width / 2, height / 2,
                    (state.current.keyLeft ? -1 : state.current.keyRight ? 1 : 0),
                    playerSegment.p2.world.y - playerSegment.p1.world.y,
                    'third');
            }
        }

        // Render 1st person POV as an overlay (drawn last to be on top)
        if (state.current.viewMode === 'first') {
            renderPlayer(ctx, width, height, height / 480, ROAD_WIDTH, speed / MAX_SPEED,
                1, width / 2, height / 2,
                (state.current.keyLeft ? -1 : state.current.keyRight ? 1 : 0),
                0, 'first');
        }

        // Speed Effects (Calculated in CSS Filter for performance)
    };

    // --- Manual Road Init removed here and moved to loadAssets for better sync ---


    useEffect(() => {
        setMounted(true);
        if (!assetsLoaded) return;

        state.current.playerZ = (CAMERA_HEIGHT * state.current.cameraDepth);

        // Start game loop
        let lastTime = performance.now();
        let miniMapUpdateTime = 0;

        const loop = (time: number) => {
            if (gameState === 'playing' || gameState === 'countdown') {
                const dt = Math.min(1, (time - lastTime) / 1000);
                update(dt);
            }
            render();

            // Update mini map at 10 FPS
            if (time - miniMapUpdateTime > 100) {
                drawMiniMap();
                miniMapUpdateTime = time;
            }

            lastTime = time;
            animationFrameRef.current = requestAnimationFrame(loop);
        };

        animationFrameRef.current = requestAnimationFrame(loop);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [assetsLoaded, gameState === 'playing']); // Only re-run if playing state changes meaningfully for loop



    // Event Listeners
    useEffect(() => {
        const togglePOV = () => {
            const next = state.current.viewMode === 'first' ? 'third' : 'first';
            console.log("Toggling POV to:", next);
            state.current.viewMode = next;
            setViewMode(next);
        };

        const handleDown = (e: KeyboardEvent) => {
            switch (e.key.toLowerCase()) {
                case 'arrowleft': case 'a': state.current.keyLeft = true; break;
                case 'arrowright': case 'd': state.current.keyRight = true; break;
                case 'arrowup': case 'w': state.current.keyFaster = true; break;
                case 'arrowdown': case 's': state.current.keySlower = true; break;
                case ' ': e.preventDefault(); state.current.keyBoost = true; break;
                case 't': togglePOV(); break;
            }
        };
        const handleUp = (e: KeyboardEvent) => {
            switch (e.key.toLowerCase()) {
                case 'arrowleft': case 'a': state.current.keyLeft = false; break;
                case 'arrowright': case 'd': state.current.keyRight = false; break;
                case 'arrowup': case 'w': state.current.keyFaster = false; break;
                case 'arrowdown': case 's': state.current.keySlower = false; break;
                case ' ': e.preventDefault(); state.current.keyBoost = false; break;
            }
        };

        window.addEventListener('keydown', handleDown);
        window.addEventListener('keyup', handleUp);
        return () => {
            window.removeEventListener('keydown', handleDown);
            window.removeEventListener('keyup', handleUp);
        };
    }, []);

    // Touch/Swipe controls for mobile steering (Multi-touch support)
    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            // Look for a touch that is NOT on a button
            let hitsButton = false;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const target = touch.target as HTMLElement;
                if (target.tagName === 'BUTTON' || target.closest('button')) {
                    hitsButton = true;
                } else if (!hitsButton && steeringTouchId.current === null) {
                    steeringTouchId.current = touch.identifier;
                    touchStartX.current = touch.clientX;
                    touchCurrentX.current = touch.clientX;
                }
            }

            // Only prevent default for multi-touch if we aren't hitting UI buttons
            if (e.touches.length > 1 && !hitsButton) e.preventDefault();
        };

        const handleTouchMove = (e: TouchEvent) => {
            // ALWAYS prevent default in move to stop scrolling/zooming while playing
            if (e.cancelable) e.preventDefault();

            if (steeringTouchId.current === null) return;

            // Find the touch that started our steering
            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                if (touch.identifier === steeringTouchId.current) {
                    touchCurrentX.current = touch.clientX;
                    const deltaX = touchCurrentX.current - (touchStartX.current || 0);

                    // Calculate analog steering value (-1.0 to 1.0)
                    const maxRange = window.innerWidth / 3;
                    state.current.analogSteer = Util.limit(deltaX / maxRange, -1, 1);

                    // Keep boolean state for animation/logic compatibility
                    if (deltaX < -20) {
                        state.current.keyLeft = true;
                        state.current.keyRight = false;
                    } else if (deltaX > 20) {
                        state.current.keyRight = true;
                        state.current.keyLeft = false;
                    } else {
                        state.current.keyLeft = false;
                        state.current.keyRight = false;
                    }
                    break;
                }
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (steeringTouchId.current === null) return;

            // Check if our tracked touch ended
            let mappedTouchEnded = false;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === steeringTouchId.current) {
                    mappedTouchEnded = true;
                    break;
                }
            }

            if (mappedTouchEnded) {
                steeringTouchId.current = null;
                touchStartX.current = null;
                touchCurrentX.current = null;
                state.current.analogSteer = 0;
                state.current.keyLeft = false;
                state.current.keyRight = false;
            }
        };

        // Only add swipe handlers if mobile AND in portrait mode
        if (isMobile && mobileOrientationChoice === 'portrait') {
            window.addEventListener('touchstart', handleTouchStart, { passive: false });
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleTouchEnd, { passive: false });
            window.addEventListener('touchcancel', handleTouchEnd, { passive: false });
        }

        // --- ANTI-ZOOM LOGIC FOR MOBILE ---
        const preventZoom = (e: TouchEvent) => {
            const target = e.target as HTMLElement;
            const isButton = target.tagName === 'BUTTON' || target.closest('button');

            if (e.touches.length > 1 && !isButton) {
                e.preventDefault(); // Prevent pinch zoom, but don't block button clicks
            }
        };

        let lastTouchEnd = 0;
        const preventDoubleTapZoom = (e: TouchEvent) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault(); // Prevent double-tap zoom
            }
            lastTouchEnd = now;
        };

        if (isMobile) {
            window.addEventListener('touchstart', preventZoom, { passive: false });
            window.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
            // For iOS
            (window as any).addEventListener('gesturestart', (e: any) => e.preventDefault(), { passive: false });
        }

        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('touchcancel', handleTouchEnd);

            if (isMobile) {
                window.removeEventListener('touchstart', preventZoom);
                window.removeEventListener('touchend', preventDoubleTapZoom);
            }
        };
    }, [isMobile, mobileOrientationChoice]);

    // Resize handling with mobile detection and aspect ratio
    useEffect(() => {
        const setSize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
            }
            const w = window.innerWidth;
            const h = window.innerHeight;
            const ratio = w / h;
            setAspectRatio(ratio);

            // Detect mobile: small width OR portrait mode with touch support
            const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            const isPortrait = ratio < 1;
            const isSmallScreen = w < 768;
            const detectedMobile = (isSmallScreen || isPortrait) && hasTouchSupport;

            setIsMobile(detectedMobile);

            // Orientation Hint
            if (detectedMobile && mobileOrientationChoice === 'landscape' && isPortrait) {
                // If they chose landscape but are in portrait, try to lock or just let it resize
                if (screen.orientation && (screen.orientation as any).lock) {
                    (screen.orientation as any).lock('landscape').catch(() => { });
                }
            }

            // On mobile, auto-forward is always enabled (car drives automatically)
            if (detectedMobile && gameState === 'playing') {
                state.current.keyFaster = true;
            }
        };
        window.addEventListener('resize', setSize);
        if (mounted) setSize();
        return () => window.removeEventListener('resize', setSize);
    }, [mounted, gameState, mobileOrientationChoice]);

    // Mobile auto-forward: Keep gas pressed while playing on mobile
    useEffect(() => {
        if (isMobile && gameState === 'playing') {
            state.current.keyFaster = true;
        }
    }, [isMobile, gameState]);

    const drawMiniMap = () => {
        const canvas = miniMapRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { segments, position, trackLength } = state.current;

        // DPR Scaling
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const logicalW = 240;
        const logicalH = 180;
        // Padding removed here, defined locally for precise control

        if (canvas.width !== logicalW * dpr || canvas.height !== logicalH * dpr) {
            canvas.width = logicalW * dpr;
            canvas.height = logicalH * dpr;
            canvas.style.width = `${logicalW}px`;
            canvas.style.height = `${logicalH}px`;
        }

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, logicalW, logicalH);

        // 1. Scanner Background (Dark Blue/Black)
        ctx.fillStyle = 'rgba(10, 15, 25, 0.95)';
        ctx.beginPath();
        if ((ctx as any).roundRect) {
            (ctx as any).roundRect(0, 0, logicalW, logicalH, 20);
        } else {
            ctx.rect(0, 0, logicalW, logicalH);
        }
        ctx.fill();

        // 2. Scanner Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i < logicalW; i += 30) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, logicalH); ctx.stroke();
        }
        for (let i = 0; i < logicalH; i += 30) {
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(logicalW, i); ctx.stroke();
        }

        // 3. Scanner Text Overlay - REMOVED
        // Separator Line - REMOVED


        // 4. Track Line Projection
        if (!segments || segments.length < 10) {
            ctx.restore();
            return;
        }

        const points: { x: number, z: number }[] = [];
        let xPos = 0, zPos = 0, heading = -Math.PI / 2;

        for (let i = 0; i < segments.length; i += 5) {
            const s = segments[i];
            heading += (s.curve * 0.012);
            xPos += Math.cos(heading) * 10;
            zPos += Math.sin(heading) * 10;
            points.push({ x: xPos, z: zPos });
        }

        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.z < minZ) minZ = p.z;
            if (p.z > maxZ) maxZ = p.z;
        });

        const trackW = maxX - minX || 1;
        const trackH = maxZ - minZ || 1;

        // Custom Margins to Maximize Size
        const marginSide = 40; // More centered (pressed in)
        const marginTop = 30;
        const marginBot = 30;

        const availW = logicalW - (marginSide * 2);
        const availH = logicalH - marginTop - marginBot;

        const scale = Math.min(availW / trackW, availH / trackH) * 0.95; // Scale up slightly to 95%

        const tx = (px: number) => logicalW / 2 + (px - (minX + maxX) / 2) * scale;
        // Center Y in the available vertical space (shifted down by marginTop)
        const centerY = marginTop + (availH / 2);
        const ty = (pz: number) => centerY + (pz - (minZ + maxZ) / 2) * scale;

        // Draw Blue Neon Track
        // Draw Blue Neon Track
        ctx.beginPath();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 5; // Slightly bolder
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#3b82f6';
        ctx.moveTo(tx(points[0].x), ty(points[0].z));
        for (let i = 1; i < points.length; i++) ctx.lineTo(tx(points[i].x), ty(points[i].z));
        ctx.stroke();

        // Overlay Lighter Core for track
        ctx.beginPath();
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1.5; // Thinner core
        ctx.shadowBlur = 0;
        ctx.moveTo(tx(points[0].x), ty(points[0].z));
        for (let i = 1; i < points.length; i++) ctx.lineTo(tx(points[i].x), ty(points[i].z));
        ctx.stroke();

        // 5. Markers
        const startP = points[0];
        const endP = points[points.length - 1];

        // START Label
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.font = '800 10px sans-serif';
        ctx.fillText('START', tx(startP.x) + 14, ty(startP.z) + 3);

        // START Icon (Start Line)
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(tx(startP.x) - 10, ty(startP.z));
        ctx.lineTo(tx(startP.x) + 10, ty(startP.z));
        ctx.stroke();

        // FINISH Label
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText('FINISH', tx(endP.x) - 18, ty(endP.z) + 3);

        // FINISH Icon (Line dashed)
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 6;
        ctx.setLineDash([3, 3]);
        ctx.moveTo(tx(endP.x) - 10, ty(endP.z));
        ctx.lineTo(tx(endP.x) + 10, ty(endP.z));
        ctx.stroke();
        ctx.setLineDash([]);

        // 6. Player Position (Red Dot with White Outline)
        const playerIdx = Math.floor((position / trackLength) * points.length);
        const pPoint = points[Math.min(playerIdx, points.length - 1)] || points[0];
        const px = tx(pPoint.x);
        const py = ty(pPoint.z);

        // Rivals
        state.current.cars.forEach(car => {
            if (car.isRival) {
                const rivalIdx = Math.floor((car.z / trackLength) * points.length);
                const rPoint = points[rivalIdx % points.length];
                const rx = tx(rPoint.x);
                const ry = ty(rPoint.z);

                // Rival Icon (Blue, matching player style)
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(59, 130, 246, 0.8)'; // Blue glow
                ctx.fillStyle = '#3b82f6'; // Blue fill
                ctx.beginPath();
                ctx.arc(rx, ry, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });

        // Player Pulse
        const pulse = (Date.now() % 1000) / 1000;
        ctx.beginPath();
        ctx.arc(px, py, 6 + pulse * 10, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239, 68, 68, ${0.5 - pulse * 0.5})`;
        ctx.fill();

        // Player Icon
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'white';
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    };

    const hasEndedRef = useRef(false);
    const endGame = useCallback(async () => {
        if (hasEndedRef.current) return;
        hasEndedRef.current = true;

        const roomCode = typeof window !== 'undefined' ? localStorage.getItem('nitroquiz_game_roomCode') : null;
        const participantId = typeof window !== 'undefined' ? localStorage.getItem('nitroquiz_game_participantId') : null;

        // 1. Mark player as finished in Supabase
        if (participantId) {
            try {
                await supabase.from('participants').update({
                    finished_at: new Date().toISOString()
                }).eq('id', participantId);
            } catch (e) {
                console.error("Failed to update participant finish state:", e);
            }
        }
        
        // 2. Return to standard orientation
        try {
            if (screen.orientation && (screen.orientation as any).unlock) {
                (screen.orientation as any).unlock();
            }
            if (document.exitFullscreen && document.fullscreenElement) {
                document.exitFullscreen().catch(() => { });
            }
        } catch (e) {
            console.error("Failed to unlock orientation:", e);
        }

        // 3. Clean up session data from localStorage
        localStorage.removeItem('nitroquiz_game_questions');
        localStorage.removeItem('nitroquiz_game_questionIndex');
        localStorage.removeItem('nitroquiz_game_score');
        localStorage.removeItem('nitroquiz_game_roomCode');
        localStorage.removeItem('nitroquiz_game_sessionId');
        localStorage.removeItem('nitroquiz_game_quizId');
        localStorage.removeItem('nitroquiz_game_difficulty');
        
        // 4. Redirect to Podium (Host's monitor will also see we are finished)
        if (roomCode) {
            window.location.href = `/player/${roomCode}/podium`;
        } else {
            window.location.href = '/';
        }
    }, []);

    // Auto-complete game immediately when finished
    useEffect(() => {
        if (gameState === 'finished') {
            endGame();
        }
    }, [gameState, endGame]);

    // Load quiz questions from localStorage (preloaded by player lobby)
    useEffect(() => {
        try {
            const stored = localStorage.getItem('nitroquiz_game_questions');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Normalize questions to QuizQuestion format
                    // DB format: { answers: [{id:"0", answer:"text"}, ...], correct: "3", question: "..." }
                    const normalized: QuizQuestion[] = parsed.map((q: any, idx: number) => {
                        let options: string[] = [];
                        let correctAnswer = 0;

                        // Handle DB format: answers is array of {id, answer} objects
                        if (Array.isArray(q.answers) && q.answers.length > 0 && typeof q.answers[0] === 'object' && q.answers[0].answer) {
                            options = q.answers.map((a: any) => a.answer || '');
                            // correct is a string ID matching answers[].id
                            if (q.correct !== undefined) {
                                const correctId = String(q.correct);
                                const correctIdx = q.answers.findIndex((a: any) => String(a.id) === correctId);
                                correctAnswer = correctIdx >= 0 ? correctIdx : 0;
                            }
                        }
                        // Handle simple format: options is string[]
                        else if (Array.isArray(q.options)) {
                            options = q.options;
                            correctAnswer = typeof q.correctAnswer === 'number' ? q.correctAnswer
                                : typeof q.correct_answer === 'number' ? q.correct_answer
                                    : typeof q.answer === 'number' ? q.answer : 0;
                        }
                        // Handle other formats
                        else if (Array.isArray(q.choices)) {
                            options = q.choices;
                            correctAnswer = typeof q.correctAnswer === 'number' ? q.correctAnswer : 0;
                        }

                        return {
                            id: q.id || `q-${idx}`,
                            question: q.question || q.text || q.pertanyaan || '',
                            options,
                            correctAnswer,
                        };
                    });
                    console.log('[GameSpeed] Loaded quiz questions:', normalized.length, 'Sample:', normalized[0]);
                    setAllQuizQuestions(normalized);
                    
                    // Sync current progress from localStorage
                    const storedIndex = localStorage.getItem('nitroquiz_game_questionIndex');
                    const storedScore = localStorage.getItem('nitroquiz_game_score');
                    if (storedIndex) setQuizQuestionIndex(parseInt(storedIndex, 10));
                    if (storedScore) setTotalQuizScore(parseInt(storedScore, 10));
                }
            }
        } catch (e) {
            console.error('Failed to load quiz questions:', e);
        }
    }, []);

    // Auto-complete game immediately when finished
    useEffect(() => {
        if (gameState === 'finished') {
            endGame();
        }
    }, [gameState, endGame]);

    return (
        <div style={{
            width: '100%',
            height: '100%',
            background: '#020617',
            overflow: 'hidden',
            fontFamily: 'var(--font-rajdhani)',
            userSelect: 'none',
            touchAction: 'none',
            WebkitUserSelect: 'none',
            filter: (stats.speed > 150 ? `blur(${((stats.speed - 150) / 60) + (state.current.keyBoost && stats.nos > 0 ? 2 : 0)}px) ` : (state.current.keyBoost && stats.nos > 0 ? 'blur(2px) ' : '')) + 'contrast(1.05) brightness(1) saturate(1.1)', // Milder Lighter Blur
            transition: 'filter 0.4s ease'
        }}>
            {/* Main Game Canvas */}
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

            {/* Loading Overlay - Unified Establishing Signal Style */}
            {mounted && !assetsLoaded && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 3000,
                    backgroundColor: '#0a0a0f', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', color: 'white',
                    fontFamily: 'var(--font-rajdhani)'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                            width: '64px', height: '64px', 
                            border: '4px solid rgba(45, 106, 242, 0.3)', 
                            borderTopColor: '#2d6af2', 
                            borderRadius: '50%', 
                            margin: '0 auto 1.5rem auto',
                            animation: 'spin 1s linear infinite' 
                        }} />
                        <p style={{ 
                            marginTop: '1rem', 
                            color: '#2d6af2', 
                            fontSize: '1.25rem', 
                            letterSpacing: '0.2em', 
                            textTransform: 'uppercase', 
                            fontWeight: 700,
                            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                        }}>
                            Establishing Signal...
                        </p>
                    </div>
                    <style>{`
                        @keyframes spin { to { transform: rotate(360deg); } }
                        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
                    `}</style>
                </div>
            )}

            {/* Mobile Orientation Choice Overlay - Premium UI */}
            {mounted && isMobile && assetsLoaded && !mobileOrientationChoice && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: '#020617',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2500,
                    color: 'white',
                    fontFamily: 'var(--font-rajdhani)',
                    padding: '1.5rem',
                }}>
                    {/* Grid lines BG */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
                        background: 'linear-gradient(transparent 0%, rgba(45,106,242,0.05) 1px, transparent 1px), linear-gradient(90deg, transparent 0%, rgba(45,106,242,0.05) 1px, transparent 1px)',
                        backgroundSize: '50px 50px',
                        transform: 'perspective(500px) rotateX(60deg)',
                        transformOrigin: 'bottom',
                        opacity: 0.4, pointerEvents: 'none',
                    }} />

                    {/* Title */}
                    <div style={{ textAlign: 'center', marginBottom: '2rem', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem', filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.3))' }}>🏎️</div>
                        <h2 style={{
                            fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase',
                            letterSpacing: '0.3em', color: 'white', margin: 0,
                            textShadow: '0 0 20px rgba(45,106,242,0.5)',
                        }}>SELECT VIEW</h2>
                        <p style={{ fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '0.5rem' }}>
                            Choose your racing perspective
                        </p>
                    </div>

                    {/* Cards */}
                    <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '340px', position: 'relative', zIndex: 1 }}>
                        {/* Portrait Card */}
                        <button
                            onClick={() => setMobileOrientationChoice('portrait')}
                            style={{
                                flex: 1, padding: '1.5rem 1rem',
                                background: 'linear-gradient(135deg, rgba(45,106,242,0.15) 0%, rgba(45,106,242,0.05) 100%)',
                                border: '2px solid rgba(45,106,242,0.4)',
                                borderRadius: '1.25rem', color: 'white',
                                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                alignItems: 'center', gap: '0.75rem',
                                transition: 'all 0.2s',
                            }}
                        >
                            <div style={{
                                width: '3rem', height: '4.5rem', borderRadius: '0.5rem',
                                border: '2px solid #2d6af2', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(45,106,242,0.1)',
                                boxShadow: '0 0 20px rgba(45,106,242,0.2)',
                            }}>
                                <span style={{ fontSize: '1.25rem' }}>📱</span>
                            </div>
                            <span style={{ fontSize: '0.9rem', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Portrait</span>
                            <span style={{ fontSize: '0.6rem', color: '#64748b', letterSpacing: '0.1em' }}>SWIPE TO STEER</span>
                        </button>

                        {/* Landscape Card */}
                        <button
                            onClick={() => {
                                setMobileOrientationChoice('landscape');
                                if (document.documentElement.requestFullscreen) {
                                    document.documentElement.requestFullscreen().catch(() => { });
                                }
                                if (screen.orientation && (screen.orientation as any).lock) {
                                    (screen.orientation as any).lock('landscape').catch(() => { });
                                }
                            }}
                            style={{
                                flex: 1, padding: '1.5rem 1rem',
                                background: 'linear-gradient(135deg, rgba(0,255,157,0.1) 0%, rgba(0,255,157,0.03) 100%)',
                                border: '2px solid rgba(0,255,157,0.4)',
                                borderRadius: '1.25rem', color: 'white',
                                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                alignItems: 'center', gap: '0.75rem',
                                transition: 'all 0.2s',
                            }}
                        >
                            <div style={{
                                width: '4.5rem', height: '3rem', borderRadius: '0.5rem',
                                border: '2px solid #00ff9d', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(0,255,157,0.08)',
                                boxShadow: '0 0 20px rgba(0,255,157,0.15)',
                            }}>
                                <span style={{ fontSize: '1.25rem', transform: 'rotate(90deg)' }}>📱</span>
                            </div>
                            <span style={{ fontSize: '0.9rem', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Landscape</span>
                            <span style={{ fontSize: '0.6rem', color: '#64748b', letterSpacing: '0.1em' }}>BUTTON CONTROLS</span>
                        </button>
                    </div>
                </div>
            )}

            {/* UI Overlay - Using explicitly inline styles to bypass Tailwind generation issues */}
            {mounted && assetsLoaded && (isMobile ? !!mobileOrientationChoice : true) && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        pointerEvents: 'none',
                        zIndex: 200,
                        padding: isMobile ? '0.75rem' : '2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        fontFamily: 'sans-serif',
                        color: 'white',
                        touchAction: 'none'
                    }}
                >

                    {/* Header: Stats & Map */}
                    <div style={{ display: 'flex', flexDirection: usePCLayout ? 'row' : 'column', justifyContent: 'space-between', alignItems: usePCLayout ? 'start' : 'center', width: '100%', gap: '1rem' }}>
                        {/* Velocity & Points - Premium Glassmorphism */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: usePCLayout ? 'auto' : '100%' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: usePCLayout ? 'flex-start' : 'center' }}>
                                <div style={{
                                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                                    backdropFilter: 'blur(15px)',
                                    padding: isMobileLandscape ? '0.6rem 1rem' : (usePCLayout ? '1.5rem 2.5rem' : '0.4rem 0.6rem'),
                                    borderRadius: usePCLayout ? '2rem' : '0.8rem',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    flex: usePCLayout ? 'none' : 1,
                                    textAlign: usePCLayout ? 'left' : 'center'
                                }}>
                                    <div style={{ fontSize: isMobileLandscape ? '8px' : (usePCLayout ? '10px' : '7px'), color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '0.3em', fontWeight: 900, marginBottom: '0.1rem' }}>Speedometer</div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', justifyContent: usePCLayout ? 'flex-start' : 'center' }}>
                                        <span style={{
                                            fontSize: isMobileLandscape ? '1.8rem' : (usePCLayout ? '4.5rem' : '1.75rem'),
                                            fontWeight: 900,
                                            fontFamily: 'var(--font-rajdhani)',
                                            color: '#fff',
                                            fontStyle: 'italic',
                                            textShadow: '0 0 15px rgba(255,255,255,0.7)'
                                        }}>
                                            {stats.speed}
                                        </span>
                                        <span style={{ fontSize: isMobileLandscape ? '0.7rem' : (usePCLayout ? '1rem' : '0.6rem'), color: '#60a5fa', fontWeight: 800 }}>KPH</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        const next = state.current.viewMode === 'first' ? 'third' : 'first';
                                        state.current.viewMode = next;
                                        setViewMode(next);
                                    }}
                                    style={{
                                        pointerEvents: 'auto',
                                        backgroundColor: 'rgba(59, 130, 246, 0.25)',
                                        backdropFilter: 'blur(15px)',
                                        width: isMobileLandscape ? '3rem' : (usePCLayout ? '5rem' : '2.5rem'),
                                        height: isMobileLandscape ? '3rem' : (usePCLayout ? '5rem' : '2.5rem'),
                                        borderRadius: usePCLayout ? '1.25rem' : '0.6rem',
                                        border: '2px solid rgba(59, 130, 246, 0.5)',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                                        gap: '2px'
                                    }}
                                >
                                    <span style={{ fontSize: isMobileLandscape ? '1.2rem' : (usePCLayout ? '1.8rem' : '1rem'), filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.5))' }}>
                                        {viewMode === 'first' ? '🎥' : '👤'}
                                    </span>
                                    {usePCLayout && <span style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', opacity: 0.8 }}>POV (T)</span>}
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: '0.3rem', width: usePCLayout ? 'auto' : '100%' }}>
                                <div style={{
                                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                                    backdropFilter: 'blur(15px)',
                                    padding: isMobileLandscape ? '0.5rem 0.8rem' : (usePCLayout ? '0.6rem 1rem' : '0.4rem 0.75rem'),
                                    borderRadius: usePCLayout ? '1.25rem' : '0.8rem',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: usePCLayout ? '0.75rem' : '0.5rem',
                                    flex: usePCLayout ? 'none' : 1
                                }}>
                                    <span style={{ color: '#60a5fa', fontWeight: 900, fontSize: isMobileLandscape ? '0.7rem' : (usePCLayout ? '0.7rem' : '0.6rem'), textShadow: '0 0 10px rgba(59, 130, 246, 0.8)' }}>NOS</span>
                                    <div style={{ flex: 1, minWidth: isMobileLandscape ? '70px' : (usePCLayout ? '80px' : '30px'), height: usePCLayout ? '6px' : '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ width: `${stats.nos}%`, height: '100%', backgroundColor: '#3b82f6', boxShadow: '0 0 10px #3b82f6' }} />
                                    </div>
                                </div>
                                <div style={{
                                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                                    backdropFilter: 'blur(15px)',
                                    padding: isMobileLandscape ? '0.5rem 0.8rem' : (isMobile ? '0.4rem 0.75rem' : '0.6rem 1rem'),
                                    borderRadius: usePCLayout ? '1.25rem' : '0.8rem',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    flex: 'none'
                                }}>
                                    <span style={{ color: '#4ade80', fontWeight: 900, fontSize: isMobileLandscape ? '0.7rem' : (usePCLayout ? '0.7rem' : '0.6rem'), textShadow: '0 0 10px rgba(74, 222, 128, 0.8)' }}>LAP</span>
                                    <span style={{ fontSize: isMobileLandscape ? '1rem' : (usePCLayout ? '1.25rem' : '0.8rem'), fontWeight: 900, color: '#fff' }}>{stats.lap}/{stats.totalLaps}</span>
                                </div>
                            </div>
                        </div>

                        {/* Mini Map - Enlarge for Mobile with Minimize capability */}
                        <div
                            onClick={() => isMobile && setMiniMapMinimized(!miniMapMinimized)}
                            style={{
                                position: 'relative',
                                pointerEvents: 'auto',
                                alignSelf: usePCLayout ? 'auto' : 'flex-end',
                                cursor: 'pointer',
                                transition: 'all 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                                zIndex: 300
                            }}
                        >
                            <div style={{
                                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                backdropFilter: 'blur(10px)',
                                padding: isMobile ? '0.25rem' : '0.4rem',
                                borderRadius: isMobile ? '0.6rem' : '1rem',
                                transform: (isMobile && miniMapMinimized) ? 'scale(0.35)' : (isMobile ? 'scale(0.85)' : 'none'),
                                transformOrigin: 'top right',
                                marginTop: (isMobile && !usePCLayout) ? '0.5rem' : '0',
                                marginRight: (isMobile && !usePCLayout) ? '0.5rem' : '0',
                                position: 'relative',
                                transition: 'transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                                border: isMobile ? '2px solid rgba(255,255,255,0.2)' : 'none'
                            }}>
                                <canvas
                                    ref={miniMapRef}
                                    style={{ borderRadius: usePCLayout ? '0.75rem' : '0.4rem', display: 'block' }}
                                />

                                {isMobile && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '-8px',
                                        left: '-8px',
                                        width: '32px',
                                        height: '32px',
                                        backgroundColor: '#3b82f6',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '16px',
                                        border: '2px solid white',
                                        boxShadow: '0 0 15px rgba(59, 130, 246, 0.7)',
                                        transform: miniMapMinimized ? 'scale(2.2)' : 'none',
                                        transformOrigin: 'bottom left',
                                        transition: 'transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                                        zIndex: 10
                                    }}>
                                        <div style={{ position: 'relative', width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <div style={{ position: 'absolute', width: '100%', height: '2px', backgroundColor: 'white', borderRadius: '1px' }} />
                                            {miniMapMinimized && <div style={{ position: 'absolute', width: '2px', height: '100%', backgroundColor: 'white', borderRadius: '1px' }} />}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer: Controls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', pointerEvents: 'none', paddingBottom: usePCLayout ? '1rem' : '2rem' }}>

                        {/* Mobile Portrait: Swipe Indicator + Left Controls */}
                        {!usePCLayout ? (
                            <>
                                {/* Left side - NOS Button */}
                                <div style={{ display: 'flex', gap: '0.75rem', pointerEvents: 'auto' }}>
                                    <button
                                        style={{
                                            width: '4.5rem', height: '4.5rem',
                                            background: stats.nos > 0
                                                ? 'radial-gradient(circle at center, #3b82f6 0%, #1e40af 100%)'
                                                : 'rgba(255, 255, 255, 0.05)',
                                            borderRadius: '50%',
                                            border: stats.nos > 0 ? '3px solid #60a5fa' : '2px solid rgba(255, 255, 255, 0.1)',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', opacity: stats.nos > 0 ? 1 : 0.5, color: 'white',
                                            fontWeight: 900,
                                            boxShadow: stats.nos > 0 ? '0 0 25px rgba(59, 130, 246, 0.6), inset 0 0 15px rgba(255, 255, 255, 0.3)' : 'none',
                                            transition: 'all 0.1s ease',
                                            transform: isBoosting ? 'scale(0.92)' : 'scale(1)',
                                            fontFamily: 'var(--font-rajdhani)',
                                            touchAction: 'none'
                                        }}
                                        onPointerDown={(e) => { e.preventDefault(); state.current.keyBoost = true; setIsBoosting(true); }}
                                        onPointerUp={(e) => { e.preventDefault(); state.current.keyBoost = false; setIsBoosting(false); }}
                                        onPointerCancel={(e) => { e.preventDefault(); state.current.keyBoost = false; setIsBoosting(false); }}
                                        onPointerLeave={() => { state.current.keyBoost = false; setIsBoosting(false); }}
                                    >
                                        <span style={{ fontSize: '1.2rem', fontStyle: 'italic', letterSpacing: '-0.05em' }}>NITRO</span>
                                        <div style={{ width: '60%', height: '2px', backgroundColor: 'rgba(255,255,255,0.4)', marginTop: '2px' }} />
                                    </button>
                                </div>



                                {/* Right side - Brake Button */}
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', pointerEvents: 'auto' }}>
                                    <button
                                        style={{
                                            width: '4.5rem', height: '4.5rem',
                                            background: isBraking
                                                ? 'radial-gradient(circle at center, #ef4444 0%, #991b1b 100%)'
                                                : 'rgba(239, 68, 68, 0.1)',
                                            backdropFilter: 'blur(8px)',
                                            borderRadius: '50%',
                                            border: '3px solid #ef4444',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', color: isBraking ? 'white' : '#ef4444',
                                            fontWeight: 900,
                                            textShadow: isBraking ? '0 0 10px white' : '0 0 8px rgba(239, 68, 68, 0.8)',
                                            boxShadow: isBraking
                                                ? '0 0 30px rgba(239, 68, 68, 0.8), inset 0 0 15px rgba(255, 255, 255, 0.3)'
                                                : '0 0 10px rgba(239, 68, 68, 0.2)',
                                            transition: 'all 0.1s ease',
                                            transform: isBraking ? 'scale(0.92)' : 'scale(1)',
                                            fontFamily: 'var(--font-rajdhani)',
                                            touchAction: 'none'
                                        }}
                                        onPointerDown={(e) => { e.preventDefault(); state.current.keySlower = true; setIsBraking(true); }}
                                        onPointerUp={(e) => { e.preventDefault(); state.current.keySlower = false; setIsBraking(false); }}
                                        onPointerCancel={(e) => { e.preventDefault(); state.current.keySlower = false; setIsBraking(false); }}
                                        onPointerLeave={() => { state.current.keySlower = false; setIsBraking(false); }}
                                    >
                                        <span style={{ fontSize: '1.2rem', fontStyle: 'italic', letterSpacing: '0.05em' }}>BRAKE</span>
                                        <div style={{ width: '60%', height: '2px', backgroundColor: isBraking ? 'rgba(255,255,255,0.4)' : 'rgba(239,68,68,0.4)', marginTop: '2px' }} />
                                    </button>
                                </div>
                            </>
                        ) : (
                            /* PC: Original controls with steering buttons and GO */
                            <>
                                {/* Steering Controls - Compact Round */}
                                <div style={{ display: 'flex', gap: '0.6rem', pointerEvents: 'auto' }}>
                                    <button
                                        style={{
                                            width: isMobileLandscape ? '3.5rem' : '5rem',
                                            height: isMobileLandscape ? '3.5rem' : '5rem',
                                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                            backdropFilter: 'blur(10px)',
                                            borderRadius: '50%',
                                            border: isMobileLandscape ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', outline: 'none'
                                        }}
                                        onPointerDown={(e) => { e.preventDefault(); state.current.keyLeft = true; }}
                                        onPointerUp={(e) => { e.preventDefault(); state.current.keyLeft = false; }}
                                        onPointerCancel={(e) => { e.preventDefault(); state.current.keyLeft = false; }}
                                        onPointerLeave={(e) => { state.current.keyLeft = false; }}
                                    >
                                        <span style={{ fontSize: isMobileLandscape ? '1rem' : '1.25rem', color: 'white', filter: 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.8))' }}>◀</span>
                                    </button>
                                    <button
                                        style={{
                                            width: isMobileLandscape ? '3.5rem' : '5rem',
                                            height: isMobileLandscape ? '3.5rem' : '5rem',
                                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                            backdropFilter: 'blur(10px)',
                                            borderRadius: '50%',
                                            border: isMobileLandscape ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', outline: 'none'
                                        }}
                                        onPointerDown={(e) => { e.preventDefault(); state.current.keyRight = true; }}
                                        onPointerUp={(e) => { e.preventDefault(); state.current.keyRight = false; }}
                                        onPointerCancel={(e) => { e.preventDefault(); state.current.keyRight = false; }}
                                        onPointerLeave={(e) => { state.current.keyRight = false; }}
                                    >
                                        <span style={{ fontSize: isMobileLandscape ? '1rem' : '1.25rem', color: 'white', filter: 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.8))' }}>▶</span>
                                    </button>
                                </div>

                                {/* Right Controls (Action) */}
                                <div style={{ display: 'flex', gap: isMobileLandscape ? '0.5rem' : '0.75rem', alignItems: 'flex-end', pointerEvents: 'auto' }}>
                                    {/* Brake Button - Compact */}
                                    <button
                                        style={{
                                            width: isMobileLandscape ? '3.2rem' : '4.5rem',
                                            height: isMobileLandscape ? '3.2rem' : '4.5rem',
                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                            backdropFilter: 'blur(8px)',
                                            borderRadius: '50%',
                                            border: isMobileLandscape ? '1px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.3)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', color: '#ef4444', fontWeight: 900,
                                            fontSize: isMobileLandscape ? '0.5rem' : '0.6rem',
                                            textShadow: '0 0 8px rgba(239, 68, 68, 0.8)'
                                        }}
                                        onPointerDown={(e) => { e.preventDefault(); state.current.keySlower = true; }}
                                        onPointerUp={(e) => { e.preventDefault(); state.current.keySlower = false; }}
                                        onPointerCancel={(e) => { e.preventDefault(); state.current.keySlower = false; }}
                                        onPointerLeave={(e) => { state.current.keySlower = false; }}
                                    >
                                        STOP
                                    </button>

                                    {/* Gas Button - Compact Circle */}
                                    <button
                                        style={{
                                            width: isMobileLandscape ? '5.5rem' : '7.5rem',
                                            height: isMobileLandscape ? '5.5rem' : '7.5rem',
                                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                            borderRadius: '50%',
                                            border: isMobileLandscape ? '2px solid rgba(255, 255, 255, 0.3)' : '3px solid rgba(255, 255, 255, 0.1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', color: 'white', fontWeight: 900,
                                            fontSize: isMobileLandscape ? '1.1rem' : '1.25rem',
                                            boxShadow: isMobileLandscape ? '0 0 15px rgba(16, 185, 129, 0.4)' : 'none'
                                        }}
                                        onPointerDown={(e) => { e.preventDefault(); state.current.keyFaster = true; }}
                                        onPointerUp={(e) => { e.preventDefault(); state.current.keyFaster = false; }}
                                        onPointerCancel={(e) => { e.preventDefault(); state.current.keyFaster = false; }}
                                        onPointerLeave={(e) => { state.current.keyFaster = false; }}
                                    >
                                        <span style={{ filter: 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.8))' }}>GO</span>
                                    </button>

                                    {/* NOS Button - Compact */}
                                    <button
                                        style={{
                                            width: isMobileLandscape ? '3.8rem' : '5rem',
                                            height: isMobileLandscape ? '3.8rem' : '5rem',
                                            background: stats.nos > 0 ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'rgba(255, 255, 255, 0.05)',
                                            borderRadius: '50%',
                                            border: isMobileLandscape ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', opacity: stats.nos > 0 ? 1 : 0.5, color: 'white', fontWeight: 900,
                                            fontSize: isMobileLandscape ? '0.7rem' : '0.8rem',
                                            boxShadow: stats.nos > 0 && isMobileLandscape ? '0 0 15px rgba(59, 130, 246, 0.4)' : 'none'
                                        }}
                                        onPointerDown={(e) => { e.preventDefault(); state.current.keyBoost = true; }}
                                        onPointerUp={(e) => { e.preventDefault(); state.current.keyBoost = false; }}
                                        onPointerCancel={(e) => { e.preventDefault(); state.current.keyBoost = false; }}
                                        onPointerLeave={(e) => { state.current.keyBoost = false; }}
                                    >
                                        <span style={{ filter: 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.8))' }}>NOS</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <style jsx global>{`
                @keyframes countdown-scale {
                    0% { transform: scale(0.8); opacity: 0; }
                    50% { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>

            {/* Preparation Overlay - Citynight Premium Style */}
            {/* Preparation Overlay - Citynight Premium Style */}
            {mounted && assetsLoaded && gameState === 'preparation' && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2, 6, 23, 0.9)', color: 'white', fontFamily: 'var(--font-rajdhani)', padding: isMobileLandscape ? '0.5rem' : '0' }}>
                    <div style={{
                        backgroundColor: '#0f172a',
                        padding: isMobileLandscape ? '1rem 2rem' : (usePCLayout ? '3.5rem' : '1.5rem'),
                        borderRadius: usePCLayout ? '2rem' : '1.5rem',
                        border: '2px solid #3b82f6',
                        textAlign: 'center',
                        boxShadow: '0 0 60px rgba(59, 130, 246, 0.3)',
                        maxWidth: isMobileLandscape ? '28rem' : '38rem',
                        width: isMobileLandscape ? '80%' : '90%'
                    }}>
                        <img src="/assets/logo/logo1.png" alt="Logo" style={{ height: isMobileLandscape ? '2rem' : (usePCLayout ? '6rem' : '3rem'), width: 'auto', marginBottom: '0.25rem', display: 'block', margin: '0 auto 0.25rem' }} />
                        <h1 style={{ fontSize: isMobileLandscape ? '1.6rem' : (usePCLayout ? '4rem' : '2.5rem'), fontWeight: 950, fontStyle: 'italic', marginBottom: '0.15rem', color: '#fff' }}>GET READY!</h1>
                        <p style={{ color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4em', marginBottom: isMobileLandscape ? '0.5rem' : (usePCLayout ? '3rem' : '1.5rem'), fontSize: isMobileLandscape ? '0.55rem' : (usePCLayout ? '1rem' : '0.7rem') }}>City Night Protocol Active</p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: isMobileLandscape ? '0.5rem' : (usePCLayout ? '1.5rem' : '0.75rem'), marginBottom: isMobileLandscape ? '0.5rem' : (usePCLayout ? '3rem' : '1.5rem') }}>
                            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: isMobileLandscape ? '0.5rem' : (usePCLayout ? '1.5rem' : '1rem'), borderRadius: '1rem', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                <div style={{ fontSize: isMobileLandscape ? '0.55rem' : '0.65rem', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.1rem' }}>Distance</div>
                                <div style={{ fontSize: isMobileLandscape ? '1rem' : (usePCLayout ? '2.5rem' : '1.5rem'), fontWeight: 900, color: '#3b82f6' }}>{stats.totalLaps} LAPS</div>
                            </div>
                            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: isMobileLandscape ? '0.5rem' : (usePCLayout ? '1.5rem' : '1rem'), borderRadius: '1rem', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                <div style={{ fontSize: isMobileLandscape ? '0.55rem' : '0.65rem', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.1rem' }}>Nitro Fuel</div>
                                <div style={{ fontSize: isMobileLandscape ? '1rem' : (usePCLayout ? '2.5rem' : '1.5rem'), fontWeight: 900, color: '#10b981' }}>{stats.nos}%</div>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                countdownRef.current = 3;
                                setGameState('countdown');
                            }}
                            style={{
                                width: '100%',
                                padding: isMobileLandscape ? '0.7rem 0' : (usePCLayout ? '1.75rem 0' : '1.25rem 0'),
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                color: '#fff',
                                borderRadius: '1.25rem',
                                fontWeight: 900,
                                fontSize: isMobileLandscape ? '1rem' : (usePCLayout ? '1.75rem' : '1.25rem'),
                                cursor: 'pointer',
                                border: '2px solid rgba(255, 255, 255, 0.3)',
                                boxShadow: '0 0 30px rgba(59, 130, 246, 0.4)'
                            }}
                        >
                            START ENGINE
                        </button>
                    </div>
                </div>
            )}

            {/* Countdown Overlay - 3 traffic lights (red, yellow, green) */}
            {mounted && assetsLoaded && gameState === 'countdown' && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.88)',
                    backdropFilter: 'blur(8px)',
                    fontFamily: 'var(--font-rajdhani)',
                    gap: usePCLayout ? '2rem' : '1.25rem',
                }}>
                    {/* Racing lights - 3 circles: Red, Yellow, Green */}
                    <div style={{ display: 'flex', gap: usePCLayout ? '1.25rem' : '0.75rem' }}>
                        {[
                            { color: '#ef4444', activeAt: 3 },
                            { color: '#facc15', activeAt: 2 },
                            { color: '#00ff9d', activeAt: 1 },
                        ].map((light, i) => {
                            const isGo = countdown <= 0;
                            const isLit = isGo || countdown <= light.activeAt;
                            const displayColor = isGo ? '#00ff9d' : light.color;

                            return (
                                <div
                                    key={i}
                                    style={{
                                        width: usePCLayout ? '3rem' : '2rem',
                                        height: usePCLayout ? '3rem' : '2rem',
                                        borderRadius: '50%',
                                        border: `2px solid ${isLit ? displayColor : '#374151'}`,
                                        backgroundColor: isLit ? displayColor : 'rgba(55, 65, 81, 0.3)',
                                        boxShadow: isLit ? `0 0 25px ${displayColor}` : 'none',
                                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                        transform: isLit ? 'scale(1.15)' : 'scale(1)',
                                    }}
                                />
                            );
                        })}
                    </div>

                    {/* Countdown number */}
                    <div
                        key={countdown}
                        style={{
                            fontSize: usePCLayout ? '8rem' : '5rem',
                            fontWeight: 900,
                            lineHeight: 1,
                            color: countdown === 3 ? '#ef4444' : countdown === 2 ? '#facc15' : '#00ff9d',
                            textShadow: `0 0 60px currentColor`,
                            animation: 'countdown-pop 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)',
                            willChange: 'transform, opacity',
                        }}
                    >
                        {countdown > 0 ? countdown : 'GO!'}
                    </div>

                    {/* Subtitle */}
                    {countdown > 0 && (
                        <div style={{
                            fontSize: usePCLayout ? '1rem' : '0.7rem',
                            letterSpacing: '0.3em', textTransform: 'uppercase',
                            color: '#64748b', fontWeight: 900,
                        }}>
                            RACE STARTING
                        </div>
                    )}

                    <style>{`
                        @keyframes countdown-pop {
                            0% { transform: scale(1.5); opacity: 0; }
                            60% { transform: scale(0.95); opacity: 1; }
                            100% { transform: scale(1); opacity: 1; }
                        }
                    `}</style>
                </div>
            )}

            {/* Transitioning to Quiz or Results Overlay */}
            {gameState === 'finished' && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    backgroundColor: '#020617', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', color: '#00ff9d',
                    fontFamily: 'var(--font-rajdhani)', textAlign: 'center'
                }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', animation: 'pulse 1.5s infinite' }}>
                        BALAPAN SELESAI!
                    </div>
                    <div style={{ fontSize: '1rem', color: '#94a3b8', maxWidth: '300px' }}>
                        Menyiapkan hasil klasemen dan mengarahkan...
                    </div>
                </div>
            )}
            <style>{`@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }`}</style>
        </div>
    );
}

