import type { AxisScore } from "../types/session";

const SIZE = 420;
const CENTER = SIZE / 2;
const MAX_RADIUS = 108;
const LEVELS = 3; // rubric axes are 0-3

function pointFor(index: number, total: number, value: number, maxValue: number): [number, number] {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const r = (value / maxValue) * MAX_RADIUS;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

export default function RadarChart({ axes }: { axes: AxisScore[] }) {
  const total = axes.length;
  const dataPoints = axes.map((a, i) => pointFor(i, total, a.score, 3));
  const dataPath = dataPoints.map((p) => p.join(",")).join(" ");

  const gridPolygons = Array.from({ length: LEVELS }, (_, levelIdx) => {
    const level = levelIdx + 1;
    const pts = axes.map((_, i) => pointFor(i, total, level, LEVELS).join(",")).join(" ");
    return pts;
  });

  const labelPoints = axes.map((a, i) => {
    const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
    const r = MAX_RADIUS + 40;
    const words = a.axisLabel.split(" ");
    return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle), words };
  });

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-labelledby="radar-title radar-desc" className="w-full">
      <title id="radar-title">Competency radar</title>
      <desc id="radar-desc">
        {axes.map((a) => `${a.axisLabel} ${a.score} out of 3`).join(", ")}
      </desc>

      <g fill="none" stroke="#E3E7E7" strokeWidth={1}>
        {gridPolygons.map((pts, i) => (
          <polygon key={i} points={pts} />
        ))}
      </g>

      <g stroke="#E3E7E7" strokeWidth={1}>
        {axes.map((_, i) => {
          const [x, y] = pointFor(i, total, LEVELS, LEVELS);
          return <line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} />;
        })}
      </g>

      <polygon points={dataPath} fill="#0E7C6B" fillOpacity={0.22} stroke="#0E7C6B" strokeWidth={2} />
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3.2} fill="#0E7C6B" />
      ))}

      <g fontFamily="Inter Tight, sans-serif" fontSize={11} fontWeight={500} fill="#11201E">
        {labelPoints.map((lp, i) => {
          const anchor = Math.abs(lp.x - CENTER) < 8 ? "middle" : lp.x > CENTER ? "start" : "end";
          const lineOffset = ((lp.words.length - 1) / 2) * -13;
          return (
            <text key={i} x={lp.x} y={lp.y} textAnchor={anchor} dominantBaseline="middle">
              {lp.words.map((word, wi) => (
                <tspan key={wi} x={lp.x} dy={wi === 0 ? lineOffset : 13}>
                  {word}
                </tspan>
              ))}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
