import { useEffect, useRef, useState, useCallback } from "react";

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;
const BIRD_X = 100;
const BIRD_SIZE = 34;
const GRAVITY = 0.5;
const FLAP_STRENGTH = -9;
const PIPE_WIDTH = 72;
const PIPE_GAP = 160;
const PIPE_SPEED = 3;
const PIPE_INTERVAL = 1600;

interface Bird {
  y: number;
  velocity: number;
  rotation: number;
}

interface Pipe {
  x: number;
  topHeight: number;
  passed: boolean;
}

type GameState = "idle" | "playing" | "dead";

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rotation: number,
  frame: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);

  const wingY = Math.sin(frame * 0.3) * 4;

  ctx.fillStyle = "#FFD700";
  drawRoundedRect(ctx, -BIRD_SIZE / 2, -BIRD_SIZE / 2, BIRD_SIZE, BIRD_SIZE, 10);
  ctx.fill();

  ctx.fillStyle = "#FFA500";
  ctx.beginPath();
  ctx.ellipse(0, wingY, 14, 8, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#FFFDE7";
  ctx.beginPath();
  ctx.arc(6, -6, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath();
  ctx.arc(8, -7, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(9, -8, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#FF6B35";
  ctx.beginPath();
  ctx.moveTo(16, -3);
  ctx.lineTo(26, -1);
  ctx.lineTo(16, 3);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawPipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  topHeight: number
) {
  const grad = ctx.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
  grad.addColorStop(0, "#4CAF50");
  grad.addColorStop(0.5, "#66BB6A");
  grad.addColorStop(1, "#388E3C");

  ctx.fillStyle = grad;

  ctx.beginPath();
  drawRoundedRect(ctx, x, 0, PIPE_WIDTH, topHeight - 12, 6);
  ctx.fill();

  ctx.fillStyle = "#388E3C";
  ctx.fillRect(x - 6, topHeight - 28, PIPE_WIDTH + 12, 28);
  ctx.beginPath();
  drawRoundedRect(ctx, x - 6, topHeight - 28, PIPE_WIDTH + 12, 28, 6);
  ctx.fill();

  const bottomY = topHeight + PIPE_GAP;
  const bottomH = CANVAS_HEIGHT - bottomY;

  const grad2 = ctx.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
  grad2.addColorStop(0, "#4CAF50");
  grad2.addColorStop(0.5, "#66BB6A");
  grad2.addColorStop(1, "#388E3C");

  ctx.fillStyle = grad2;
  ctx.beginPath();
  drawRoundedRect(ctx, x, bottomY + 28, PIPE_WIDTH, bottomH - 28, 6);
  ctx.fill();

  ctx.fillStyle = "#388E3C";
  ctx.beginPath();
  drawRoundedRect(ctx, x - 6, bottomY, PIPE_WIDTH + 12, 28, 6);
  ctx.fill();
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  bgOffset: number,
  groundOffset: number
) {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  skyGrad.addColorStop(0, "#1a1a2e");
  skyGrad.addColorStop(0.4, "#16213e");
  skyGrad.addColorStop(0.7, "#0f3460");
  skyGrad.addColorStop(1, "#533483");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const stars = [
    [40, 60], [120, 30], [200, 80], [300, 20], [380, 55], [450, 35],
    [80, 120], [240, 100], [350, 90], [420, 110], [30, 150], [160, 170],
  ];
  for (const [sx, sy] of stars) {
    const twinkle = Math.sin(Date.now() * 0.002 + sx) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const cloudPositions = [
    [bgOffset % CANVAS_WIDTH, 100],
    [(bgOffset + 200) % CANVAS_WIDTH, 160],
    [(bgOffset + 350) % CANVAS_WIDTH, 80],
  ];
  for (const [cx, cy] of cloudPositions) {
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.arc(cx + 30, cy - 10, 30, 0, Math.PI * 2);
    ctx.arc(cx + 60, cy, 35, 0, Math.PI * 2);
    ctx.fill();
    if (cx > CANVAS_WIDTH - 100) {
      const overflow = cx + 100 - CANVAS_WIDTH;
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.beginPath();
      ctx.arc(cx - CANVAS_WIDTH, cy, 40, 0, Math.PI * 2);
      ctx.arc(cx - CANVAS_WIDTH + 30, cy - 10, 30, 0, Math.PI * 2);
      ctx.arc(cx - CANVAS_WIDTH + 60, cy, 35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const groundH = 80;
  const groundY = CANVAS_HEIGHT - groundH;

  const groundGrad = ctx.createLinearGradient(0, groundY, 0, CANVAS_HEIGHT);
  groundGrad.addColorStop(0, "#5D4037");
  groundGrad.addColorStop(0.3, "#795548");
  groundGrad.addColorStop(1, "#3E2723");
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY, CANVAS_WIDTH, groundH);

  ctx.fillStyle = "#8BC34A";
  ctx.fillRect(0, groundY, CANVAS_WIDTH, 14);

  const bumpW = 60;
  for (let i = 0; i < Math.ceil(CANVAS_WIDTH / bumpW) + 2; i++) {
    const bx = ((i * bumpW - groundOffset) % (CANVAS_WIDTH + bumpW)) - bumpW;
    ctx.fillStyle = "#9CCC65";
    ctx.beginPath();
    ctx.ellipse(bx + 30, groundY + 7, 28, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const lineSpacing = 40;
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 2;
  for (let i = 0; i < Math.ceil(CANVAS_WIDTH / lineSpacing) + 2; i++) {
    const lx = ((i * lineSpacing - groundOffset) % (CANVAS_WIDTH + lineSpacing)) - lineSpacing;
    ctx.beginPath();
    ctx.moveTo(lx, groundY + 16);
    ctx.lineTo(lx + 20, groundY + 16);
    ctx.stroke();
  }
}

export default function FlappyBird() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>("idle");
  const birdRef = useRef<Bird>({ y: CANVAS_HEIGHT / 2, velocity: 0, rotation: 0 });
  const pipesRef = useRef<Pipe[]>([]);
  const scoreRef = useRef(0);
  const bestScoreRef = useRef(0);
  const frameRef = useRef(0);
  const bgOffsetRef = useRef(0);
  const groundOffsetRef = useRef(0);
  const lastPipeTimeRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameState, setGameState] = useState<GameState>("idle");

  const resetGame = useCallback(() => {
    birdRef.current = { y: CANVAS_HEIGHT / 2, velocity: 0, rotation: 0 };
    pipesRef.current = [];
    scoreRef.current = 0;
    frameRef.current = 0;
    lastPipeTimeRef.current = 0;
    setDisplayScore(0);
    gameStateRef.current = "playing";
    setGameState("playing");
  }, []);

  const handleInput = useCallback(() => {
    if (gameStateRef.current === "idle") {
      resetGame();
    } else if (gameStateRef.current === "playing") {
      birdRef.current.velocity = FLAP_STRENGTH;
    } else if (gameStateRef.current === "dead") {
      resetGame();
    }
  }, [resetGame]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        handleInput();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleInput]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const GROUND_Y = CANVAS_HEIGHT - 80;

    function checkCollision(bird: Bird, pipes: Pipe[]): boolean {
      const bx = BIRD_X;
      const by = bird.y;
      const hitRadius = BIRD_SIZE / 2 - 4;

      if (by + hitRadius >= GROUND_Y) return true;
      if (by - hitRadius <= 0) return true;

      for (const pipe of pipes) {
        if (bx + hitRadius > pipe.x && bx - hitRadius < pipe.x + PIPE_WIDTH) {
          if (by - hitRadius < pipe.topHeight || by + hitRadius > pipe.topHeight + PIPE_GAP) {
            return true;
          }
        }
      }
      return false;
    }

    function spawnPipe() {
      const minH = 80;
      const maxH = CANVAS_HEIGHT - PIPE_GAP - GROUND_Y + CANVAS_HEIGHT - 160;
      const topHeight = Math.floor(Math.random() * (maxH - minH)) + minH;
      pipesRef.current.push({ x: CANVAS_WIDTH + 10, topHeight, passed: false });
    }

    function loop(timestamp: number) {
      if (!ctx) return;

      const state = gameStateRef.current;
      const bird = birdRef.current;

      bgOffsetRef.current -= 0.4;
      if (bgOffsetRef.current < -CANVAS_WIDTH) bgOffsetRef.current += CANVAS_WIDTH;

      if (state === "playing") {
        groundOffsetRef.current = (groundOffsetRef.current + PIPE_SPEED) % 60;

        bird.velocity += GRAVITY;
        bird.y += bird.velocity;
        bird.rotation = Math.max(-30, Math.min(90, bird.velocity * 5));

        if (timestamp - lastPipeTimeRef.current > PIPE_INTERVAL) {
          spawnPipe();
          lastPipeTimeRef.current = timestamp;
        }

        pipesRef.current = pipesRef.current.filter(p => p.x > -PIPE_WIDTH - 20);
        for (const pipe of pipesRef.current) {
          pipe.x -= PIPE_SPEED;
          if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
            pipe.passed = true;
            scoreRef.current += 1;
            setDisplayScore(scoreRef.current);
          }
        }

        if (checkCollision(bird, pipesRef.current)) {
          if (scoreRef.current > bestScoreRef.current) {
            bestScoreRef.current = scoreRef.current;
            setBestScore(bestScoreRef.current);
          }
          gameStateRef.current = "dead";
          setGameState("dead");
        }

        frameRef.current += 1;
      }

      drawBackground(ctx, bgOffsetRef.current, groundOffsetRef.current);

      for (const pipe of pipesRef.current) {
        drawPipe(ctx, pipe.x, pipe.topHeight);
      }

      drawBird(ctx, BIRD_X, bird.y, bird.rotation, frameRef.current);

      if (state === "idle") {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.save();
        ctx.textAlign = "center";
        ctx.shadowColor = "#FFD700";
        ctx.shadowBlur = 20;
        ctx.fillStyle = "#FFD700";
        ctx.font = "bold 56px 'Press Start 2P', monospace";
        ctx.fillText("FLAPPY", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80);
        ctx.fillStyle = "#FFF";
        ctx.font = "bold 40px 'Press Start 2P', monospace";
        ctx.fillText("BIRD", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "16px 'Press Start 2P', monospace";
        const blink = Math.floor(Date.now() / 500) % 2 === 0;
        if (blink) ctx.fillText("TAP / SPACE TO START", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
        ctx.restore();
      }

      if (state === "dead") {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.save();
        ctx.textAlign = "center";

        ctx.fillStyle = "#FF4444";
        ctx.shadowColor = "#FF0000";
        ctx.shadowBlur = 15;
        ctx.font = "bold 36px 'Press Start 2P', monospace";
        ctx.fillText("GAME OVER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 100);

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#FFD700";
        ctx.font = "bold 20px 'Press Start 2P', monospace";
        ctx.fillText(`SCORE: ${scoreRef.current}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

        ctx.fillStyle = "#AAD4FF";
        ctx.font = "14px 'Press Start 2P', monospace";
        ctx.fillText(`BEST: ${bestScoreRef.current}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);

        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = "13px 'Press Start 2P', monospace";
        const blink = Math.floor(Date.now() / 500) % 2 === 0;
        if (blink) ctx.fillText("TAP / SPACE TO RETRY", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80);
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(loop);
    }

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "#1a1a2e" }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
        rel="stylesheet"
      />
      <div className="flex items-center gap-6 mb-4">
        <div
          className="px-5 py-2 rounded-lg text-white font-bold"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, background: "rgba(255,255,255,0.1)" }}
        >
          Score: {displayScore}
        </div>
        <div
          className="px-5 py-2 rounded-lg text-yellow-300 font-bold"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, background: "rgba(255,255,255,0.1)" }}
        >
          Best: {bestScore}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onClick={handleInput}
        className="rounded-2xl cursor-pointer select-none"
        style={{
          boxShadow: "0 0 60px rgba(83,52,131,0.7), 0 0 120px rgba(255,215,0,0.1)",
          border: "2px solid rgba(255,255,255,0.1)",
          maxWidth: "100%",
          touchAction: "manipulation",
        }}
        onTouchStart={(e) => { e.preventDefault(); handleInput(); }}
      />

      <p
        className="mt-4 text-white/50 text-center"
        style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10 }}
      >
        {gameState === "idle"
          ? "Click, tap, or press SPACE to fly"
          : gameState === "playing"
          ? "Click or press SPACE to flap"
          : "Click or press SPACE to play again"}
      </p>
    </div>
  );
}
