import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import './AIFilterBanner.css';

/** AI-themed banner (neural net, chips, analytics) with the "Filter with Advanced AI" button. */

/* ---------- neural network data (viewBox 1000 x 300) ---------- */
const NODES = [
  [50, 60],
  [140, 210],
  [220, 105],
  [300, 255],
  [380, 45],
  [460, 165],
  [540, 75],
  [620, 235],
  [700, 120],
  [780, 36],
  [840, 195],
  [920, 90],
  [970, 246],
  [100, 135],
  [660, 174],
  [250, 30],
  [520, 280],
  [890, 150],
  [420, 230],
  [740, 270]
];
const LINKS = [
  [0, 2],
  [2, 4],
  [2, 5],
  [1, 13],
  [13, 2],
  [5, 6],
  [5, 7],
  [6, 8],
  [8, 9],
  [8, 14],
  [14, 10],
  [10, 11],
  [11, 9],
  [10, 12],
  [3, 5],
  [1, 3],
  [7, 14],
  [0, 15],
  [15, 4],
  [16, 7],
  [16, 18],
  [18, 3],
  [18, 5],
  [17, 11],
  [17, 10],
  [19, 7],
  [19, 12],
  [6, 4]
];

/* scattered mini chips: [left %, top %, delay s, pink?] */
const MINI_CHIPS = [
  [3, 72, 0, false],
  [17, 6, 1.2, true],
  [44, 80, 0.6, false],
  [58, 4, 2, true],
  [97, 6, 0.9, false],
  [93, 82, 1.6, true],
  [70, 86, 2.4, false]
];

const PHRASES = ['interests & hobbies', 'personality', 'life goals', 'compatibility'];

/* radar: 6 axes */
const RADAR_LABELS = ['Age', 'Hobbies', 'Career', 'Values', 'Location', 'Vibe'];
const RADAR_VALUES = [0.9, 0.75, 0.6, 0.95, 0.7, 0.85];
const radarPoint = (i, r) => {
  const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
  return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r];
};
const poly = (r) => RADAR_LABELS.map((_, i) => radarPoint(i, r).join(',')).join(' ');

/* line chart points (viewBox 130 x 60) */
const LINE_PTS = [
  [0, 48],
  [18, 40],
  [36, 44],
  [54, 28],
  [72, 32],
  [90, 18],
  [108, 22],
  [130, 8]
];

function NeuralNet() {
  return (
    <svg className="ai-net" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {LINKS.map(([a, b], i) => (
        <line key={`l${i}`} className="link" x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} />
      ))}
      {LINKS.map(([a, b], i) => (
        <line
          key={`f${i}`}
          className="flow"
          style={{ animationDelay: `${(i % 7) * 0.3}s` }}
          x1={NODES[a][0]}
          y1={NODES[a][1]}
          x2={NODES[b][0]}
          y2={NODES[b][1]}
        />
      ))}
      {NODES.map(([x, y], i) => (
        <circle
          key={`n${i}`}
          cx={x}
          cy={y}
          r="6"
          className={`node${i % 3 === 1 ? ' pink' : i % 4 === 3 ? ' yellow' : ''}`}
          style={{ animationDelay: `${(i % 5) * 0.4}s` }}
        />
      ))}
    </svg>
  );
}

function MiniChip({ left, top, delay, pink }) {
  return (
    <svg
      className={`ai-mini-chip${pink ? ' pink' : ''}`}
      viewBox="0 0 40 40"
      aria-hidden="true"
      style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s` }}
    >
      {[13, 20, 27].map((p) => (
        <g key={p}>
          <line className="pin" x1={p} y1="3" x2={p} y2="9" />
          <line className="pin" x1={p} y1="31" x2={p} y2="37" />
          <line className="pin" x1="3" y1={p} x2="9" y2={p} />
          <line className="pin" x1="31" y1={p} x2="37" y2={p} />
        </g>
      ))}
      <rect className="core" x="9" y="9" width="22" height="22" rx="4" />
      <rect className="die" x="15" y="15" width="10" height="10" rx="2" />
    </svg>
  );
}

function AIChip() {
  const pins = [30, 45, 60, 75, 90];
  return (
    <svg className="ai-chip" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="aiChipGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00e5ff" />
          <stop offset="50%" stopColor="#b46bff" />
          <stop offset="100%" stopColor="#ff2fb3" />
        </linearGradient>
      </defs>
      <circle className="ring" cx="60" cy="60" r="56" />
      {pins.map((p) => (
        <g key={p}>
          <line className="pin" x1={p} y1="22" x2={p} y2="30" />
          <line className="pin" x1={p} y1="90" x2={p} y2="98" />
          <line className="pin" x1="22" y1={p} x2="30" y2={p} />
          <line className="pin" x1="90" y1={p} x2="98" y2={p} />
        </g>
      ))}
      <rect x="30" y="30" width="60" height="60" rx="12" fill="url(#aiChipGrad)" />
      <rect x="36" y="36" width="48" height="48" rx="8" fill="#070b24" />
      <text x="60" y="71" textAnchor="middle">
        AI
      </text>
    </svg>
  );
}

function Analytics({ matchPercent }) {
  const linePath = LINE_PTS.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  return (
    <div className="ai-analytics" aria-hidden="true">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="aiGaugeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00e5ff" />
            <stop offset="100%" stopColor="#ff2fb3" />
          </linearGradient>
          <linearGradient id="aiBarGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#7a3cff" />
            <stop offset="100%" stopColor="#00e5ff" />
          </linearGradient>
          <linearGradient id="aiAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,229,255,0.45)" />
            <stop offset="100%" stopColor="rgba(0,229,255,0)" />
          </linearGradient>
        </defs>
      </svg>

      <div className="ai-card">
        <div className="ai-card-label">Match Score</div>
        <svg className="ai-gauge" viewBox="0 0 100 100">
          <circle className="track" cx="50" cy="50" r="36" />
          <circle className="value" cx="50" cy="50" r="36" />
          <text x="50" y="54" textAnchor="middle">
            {matchPercent}%
          </text>
          <text className="small" x="50" y="67" textAnchor="middle">
            MATCH
          </text>
        </svg>
      </div>

      <div className="ai-card">
        <div className="ai-card-label">Profiles</div>
        <svg className="ai-bars" viewBox="0 0 130 60">
          {[38, 52, 30, 58, 44, 50, 34].map((h, i) => (
            <rect key={i} x={i * 19 + 2} y={60 - h} width="12" height={h} rx="3" />
          ))}
        </svg>
      </div>

      <div className="ai-card">
        <div className="ai-card-label">Compatibility</div>
        <svg className="ai-radar" viewBox="-14 -4 128 108">
          {[36, 24, 12].map((r) => (
            <polygon key={r} className="web" points={poly(r)} />
          ))}
          {RADAR_LABELS.map((_, i) => {
            const [x, y] = radarPoint(i, 36);
            return <line key={i} className="web" x1="50" y1="50" x2={x} y2={y} />;
          })}
          <polygon className="shape" points={RADAR_VALUES.map((v, i) => radarPoint(i, 36 * v).join(',')).join(' ')} />
          {RADAR_LABELS.map((label, i) => {
            const [x, y] = radarPoint(i, 46);
            return (
              <text key={label} x={x} y={y + 3} textAnchor="middle">
                {label}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="ai-card">
        <div className="ai-card-label">Trend</div>
        <svg className="ai-line" viewBox="0 0 130 60">
          {[15, 30, 45].map((y) => (
            <line key={y} className="grid" x1="0" y1={y} x2="130" y2={y} />
          ))}
          <path className="area" d={`${linePath} L130,60 L0,60 Z`} />
          <path className="stroke" d={linePath} />
          {LINE_PTS.map(([x, y]) => (
            <circle key={x} className="pt" cx={x} cy={y} r="2.5" />
          ))}
        </svg>
      </div>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9z" />
      <path d="M19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9z" opacity=".8" />
    </svg>
  );
}

export default function AIFilterBanner({
  onClick,
  buttonLabel = 'Filter with Advanced AI',
  title = 'AI-Powered Matchmaking',
  tags = ['Smart Matching', 'Compatibility Insights'],
  matchPercent = 92,
  showAnalytics = true,
  ...rest
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % PHRASES.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="ai-banner" aria-label="AI filter">
      <NeuralNet />
      {MINI_CHIPS.map(([l, t, d, p], i) => (
        <MiniChip key={i} left={l} top={t} delay={d} pink={p} />
      ))}
      <div className={`ai-banner-inner${showAnalytics ? '' : ' no-analytics'}`}>
        <AIChip />
        <div className="ai-banner-text">
          <div className="ai-top-row">
            <span className="ai-badge">
              <span className="dot" /> AI Engine Online
            </span>
            {tags.map((t) => (
              <span className="ai-tag" key={t}>
                {t}
              </span>
            ))}
          </div>
          <h2 className="ai-title">{title}</h2>
          <p className="ai-desc">
            Our AI looks at your <span className="typed">{PHRASES[idx]}</span> to find the singles you're most likely to click with.
          </p>
        </div>
        {showAnalytics && <Analytics matchPercent={matchPercent} />}
        <div className="ai-cta-row">
          <button type="button" className="ai-cta" onClick={onClick} {...guestDemoAllowProps()} {...rest}>
            <SparkleIcon />
            <span>{buttonLabel}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

MiniChip.propTypes = {
  left: PropTypes.number.isRequired,
  top: PropTypes.number.isRequired,
  delay: PropTypes.number.isRequired,
  pink: PropTypes.bool
};

Analytics.propTypes = {
  matchPercent: PropTypes.number.isRequired
};

AIFilterBanner.propTypes = {
  onClick: PropTypes.func.isRequired,
  buttonLabel: PropTypes.string,
  title: PropTypes.string,
  tags: PropTypes.arrayOf(PropTypes.string),
  matchPercent: PropTypes.number,
  showAnalytics: PropTypes.bool
};
